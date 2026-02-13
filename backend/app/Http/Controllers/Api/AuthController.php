<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'fname' => ['required', 'string', 'max:255'],
            'lname' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255', 'unique:users,username'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
            'university_id_number' => ['required', 'string', 'max:255'],
            'dept_id' => ['required', 'integer', 'exists:departments,id'],
            'phone' => ['required', 'string', 'max:50'],
            'role_ids' => ['sometimes', 'array', 'min:1'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
        ]);

        $user = User::create([
            'fname' => $validated['fname'],
            'lname' => $validated['lname'],
            'username' => $validated['username'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'university_id_number' => $validated['university_id_number'],
            'dept_id' => $validated['dept_id'],
            'phone' => $validated['phone'],
        ]);

        if (!empty($validated['role_ids'])) {
            $user->roles()->sync($validated['role_ids']);
        } elseif (Role::count() === 1) {
            $user->roles()->sync([Role::first()->id]);
        }

        $user->load(['roles', 'department']);
        $roles = $user->roles;
        $abilities = $roles->count() === 1
            ? ['role:' . $roles->first()->name]
            : ['role:select'];

        $token = $user->createToken('auth_token', $abilities)->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Registration successful.',
            'token' => $token,
            'requires_role_selection' => $roles->count() > 1,
            'user' => $this->userPayload($user, $abilities),
        ], 201);
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
        throw ValidationException::withMessages([
            'login' => ['The provided credentials are incorrect.'],
        ]);
    }

    // Optional: prevent inactive users (only if the column exists)
    if (array_key_exists('is_active', $user->getAttributes()) && !$user->is_active) {
        return response()->json([
            'success' => false,
            'message' => 'Your account is inactive. Please contact support.'
        ], 403);
    }

    $user->load(['roles', 'department']);
    $roles = $user->roles;

    $abilities = $roles->count() === 1
        ? ['role:' . $roles->first()->name]
        : ['role:select'];

    $token = $user->createToken('auth_token', $abilities)->plainTextToken;

    return response()->json([
        'success' => true,
        'message' => 'Login successful.',
        'token' => $token,
        'requires_role_selection' => $roles->count() > 1,
        'user' => $this->userPayload($user, $abilities),
    ]);
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

        $status = Password::sendResetLink(['email' => $validated['email']]);

        return response()->json([
            'success' => $status === Password::RESET_LINK_SENT,
            'message' => __($status),
        ], $status === Password::RESET_LINK_SENT ? 200 : 422);
    }

    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email', 'exists:users,email'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

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
            'message' => __($status),
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
        foreach ($abilities as $ability) {
            if (Str::startsWith($ability, 'role:') && $ability !== 'role:select') {
                $activeRole = Str::after($ability, 'role:');
                break;
            }
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
            'roles' => $user->roles->map(fn ($role) => [
                'id' => $role->id,
                'name' => $role->name,
                'description' => $role->description,
            ])->values(),
            'active_role' => $activeRole,
        ];
    }
}
