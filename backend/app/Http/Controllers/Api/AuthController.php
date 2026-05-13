<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\OtpVerificationMail;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use App\Services\ActivityLogger;

class AuthController extends Controller
{
    private const OTP_EXPIRY_MINUTES = 5;
    private const OTP_EXPIRY_SECONDS = 300;
    private const UNIVERSITY_ID_REGEX = '/^((NaScR|SoScR)\/\d{4}\/\d{2}|SIA\/\d{4})$/';

    private function resolveAbilitiesAndSelection($roles): array
    {
        $roleNames = $roles->pluck('name')->map(fn ($name) => strtolower((string) $name))->values();
        $hasSupervisor = $roleNames->contains('supervisor');
        $hasAdmin = $roleNames->contains('admin');

        if ($hasSupervisor && $hasAdmin) {
            $abilities = ['role:supervisor', 'role:admin'];
            return [$abilities, false];
        }

        if ($roles->count() === 1) {
            return [['role:' . $roles->first()->name], false];
        }

        return [['role:select'], true];
    }

    private function profilePictureUrl(?string $path): ?string
    {
        if (!$path) return null;
        $url = Storage::disk('public')->url($path);
        return str_starts_with($url, 'http') ? $url : url($url);
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'fname' => ['required', 'string', 'max:255'],
            'lname' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => [
                'required',
                'string',
                'confirmed',
                PasswordRule::min(8)->letters()->mixedCase()->numbers()->symbols(),
            ],
            'university_id_number' => ['required', 'string', 'max:255', 'regex:' . self::UNIVERSITY_ID_REGEX],
            'dept_id' => ['required', 'integer', 'exists:departments,id'],
            'phone' => ['required', 'string', 'max:50'],
            'role_ids' => ['sometimes', 'array', 'min:1'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
        ]);

        $normalizedEmail = Str::lower(trim($validated['email']));
        $normalizedUniversityId = trim($validated['university_id_number']);
        $normalizedUsername = trim($validated['username']);

        $duplicateErrors = [];

        if (User::whereRaw('LOWER(email) = ?', [$normalizedEmail])->exists()) {
            $duplicateErrors['email'] = ['The email has already been registered.'];
        }

        if (User::where('username', $normalizedUsername)->exists()) {
            $duplicateErrors['username'] = ['The username has already been taken.'];
        }

        if (User::where('university_id_number', $normalizedUniversityId)->exists()) {
            $duplicateErrors['university_id_number'] = ['The university ID has already been registered.'];
        }

        if ($duplicateErrors !== []) {
            throw ValidationException::withMessages($duplicateErrors);
        }

        $plainOtp = null;

        $user = DB::transaction(function () use ($validated, $normalizedEmail, $normalizedUniversityId, $normalizedUsername, &$plainOtp) {
            $user = User::create([
                'fname' => trim($validated['fname']),
                'lname' => trim($validated['lname']),
                'username' => $normalizedUsername,
                'email' => $normalizedEmail,
                'password' => Hash::make($validated['password']),
                'university_id_number' => $normalizedUniversityId,
                'dept_id' => $validated['dept_id'],
                'phone' => trim($validated['phone']),
                'is_verified' => false,
            ]);

            if (!empty($validated['role_ids'])) {
                $user->roles()->sync($validated['role_ids']);
            } elseif (Role::count() === 1) {
                $user->roles()->sync([Role::query()->value('id')]);
            }

            $plainOtp = $this->issueOtpForUser($user);

            return $user->fresh(['roles', 'department']);
        });

        try {
            $this->sendOtpEmail($user, $plainOtp);
        } catch (\Throwable $exception) {
            Log::error('OTP email send failed during registration', [
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Registration saved, but the OTP email could not be sent. Please verify your email configuration and try resending the OTP.',
            ], 422);
        }

        $response = [
            'success' => true,
            'message' => 'Registration successful. Your account is pending OTP verification.',
            'status' => 'pending_verification',
            'expires_in' => self::OTP_EXPIRY_SECONDS,
        ];

        if ($this->isDevOtpMode() && $plainOtp) {
            $response['otp'] = $plainOtp;
        }

        return response()->json($response, 201);
    }

    public function login(Request $request)
{
    $validated = $request->validate([
        'login' => ['required', 'string'],
        'password' => ['required', 'string'],
    ]);

    // Detect if login is email or username
    $loginType = filter_var($validated['login'], FILTER_VALIDATE_EMAIL)
        ? 'email'
        : 'username';

    // Find user by email OR username
    $user = User::where($loginType, $validated['login'])->first();

    if (!$user || !Hash::check($validated['password'], $user->password)) {
        ActivityLogger::log(
            $user?->id,
            'auth',
            'login',
            'failed',
            null,
            'Failed login attempt.',
            ['login' => $validated['login'], 'login_type' => $loginType],
            $request
        );
        throw ValidationException::withMessages([
            'login' => ['The provided credentials are incorrect.'],
        ]);
    }

    if (!$user->is_verified) {
        $message = $user->otp_expires_at && now()->greaterThan($user->otp_expires_at)
            ? 'Your OTP has expired. Please request a new one.'
            : 'Your account is not verified. Please verify the OTP sent to your email.';

        return response()->json([
            'success' => false,
            'message' => $message,
            'email' => $user->email,
        ], 403);
    }

    // Optional: prevent inactive users (only if the column exists)
    if (array_key_exists('is_active', $user->getAttributes()) && !$user->is_active) {
        ActivityLogger::log(
            $user->id,
            'auth',
            'login',
            'failed',
            null,
            'Login blocked: inactive account.',
            ['login' => $validated['login'], 'login_type' => $loginType],
            $request
        );
        return response()->json([
            'success' => false,
            'message' => 'Your account is inactive. Please contact support.'
        ], 403);
    }

    $user->load(['roles', 'department']);
    $roles = $user->roles;

    [$abilities, $requiresRoleSelection] = $this->resolveAbilitiesAndSelection($roles);

    $token = $user->createToken('auth_token', $abilities)->plainTextToken;

    ActivityLogger::log(
        $user->id,
        'auth',
        'login',
        'success',
        null,
        'User logged in.',
        ['abilities' => $abilities],
        $request
    );

    return response()->json([
        'success' => true,
        'message' => 'Login successful.',
        'token' => $token,
        'requires_role_selection' => $requiresRoleSelection,
        'user' => $this->userPayload($user, $abilities),
    ]);
}

    public function logout(Request $request)
    {
        $user = $request->user();
        if ($user && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        ActivityLogger::log(
            $user?->id,
            'auth',
            'logout',
            'success',
            null,
            'User logged out.',
            null,
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Logged out.',
        ]);
    }

    private function issueOtpForUser(User $user): string
    {
        $otp = (string) random_int(100000, 999999);

        $user->forceFill([
            'otp' => Hash::make($otp),
            'otp_expires_at' => now()->addMinutes(self::OTP_EXPIRY_MINUTES),
            'is_verified' => false,
        ])->save();

        return $otp;
    }

    private function sendOtpEmail(User $user, string $plainOtp): void
    {
        Mail::to($user->email)->send(new OtpVerificationMail($plainOtp, $user));
    }

    private function isDevOtpMode(): bool
    {
        return config('app.env') === 'local';
    }

    public function user(Request $request)
    {
        $user = $request->user()->load(['roles', 'department']);

        return response()->json([
            'success' => true,
            'user' => $this->userPayload($user, $request->user()->currentAccessToken()?->abilities ?? []),
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email', 'exists:users,email'],
        ]);

        $email = Str::lower(trim($validated['email']));
        $status = Password::sendResetLink(['email' => $email]);

        return response()->json([
            'success' => $status === Password::RESET_LINK_SENT,
            'message' => $status === Password::RESET_LINK_SENT
                ? 'Password reset link sent. Please check your email.'
                : __($status),
        ], $status === Password::RESET_LINK_SENT ? 200 : 422);
    }

    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email', 'exists:users,email'],
            'password' => [
                'required',
                'string',
                'confirmed',
                PasswordRule::min(8)->letters()->mixedCase()->numbers()->symbols(),
            ],
        ]);

        $validated['email'] = Str::lower(trim($validated['email']));
        // Defensive normalization for links where `+` could be transformed into space.
        $validated['token'] = str_replace(' ', '+', trim($validated['token']));

        $status = Password::reset(
            $validated,
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();
            }
        );

        return response()->json([
            'success' => $status === Password::PASSWORD_RESET,
            'message' => $status === Password::PASSWORD_RESET
                ? 'Your password has been reset successfully.'
                : __($status),
        ], $status === Password::PASSWORD_RESET ? 200 : 422);
    }

    public function selectRole(Request $request)
    {
        $validated = $request->validate([
            'role_id' => ['required', 'integer', 'exists:roles,id'],
        ]);

        $user = $request->user()->load(['roles', 'department']);
        $role = $user->roles->firstWhere('id', $validated['role_id']);

        if (!$role) {
            return response()->json([
                'success' => false,
                'message' => 'Role not assigned to user.',
            ], 403);
        }

        if ($user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        $abilities = ['role:' . $role->name];
        $token = $user->createToken('auth_token', $abilities)->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Role selected successfully.',
            'token' => $token,
            'user' => $this->userPayload($user, $abilities),
        ]);
    }

    private function userPayload(User $user, array $abilities): array
    {
        $activeRole = null;
        $abilityRoleMap = [];
        foreach ($abilities as $ability) {
            if (Str::startsWith($ability, 'role:') && $ability !== 'role:select') {
                $roleName = Str::after($ability, 'role:');
                $abilityRoleMap[] = $roleName;
            }
        }

        if (in_array('supervisor', $abilityRoleMap, true)) {
            $activeRole = 'supervisor';
        } elseif (!empty($abilityRoleMap)) {
            $activeRole = $abilityRoleMap[0];
        }

        return [
            'id' => $user->id,
            'fname' => $user->fname,
            'lname' => $user->lname,
            'username' => $user->username,
            'email' => $user->email,
            'university_id_number' => $user->university_id_number,
            'dept_id' => $user->dept_id,
            'department' => $user->department ? [
                'id' => $user->department->id,
                'name' => $user->department->name,
                'faculty' => $user->department->faculty,
            ] : null,
            'phone' => $user->phone,
            'profile_picture_url' => $this->profilePictureUrl($user->profile_picture),
            'roles' => $user->roles->map(fn ($role) => [
                'id' => $role->id,
                'name' => $role->name,
                'description' => $role->description,
            ])->values(),
            'active_role' => $activeRole,
        ];
    }
}
