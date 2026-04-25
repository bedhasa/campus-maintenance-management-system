<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\OtpVerificationMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

class OtpVerificationController extends Controller
{
    private const OTP_EXPIRY_MINUTES = 5;
    private const OTP_EXPIRY_SECONDS = 300;

    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'otp' => ['required', 'string', 'regex:/^\d{6}$/'],
        ]);

        $email = mb_strtolower(trim($validated['email']));
        $attemptKey = $this->attemptKey('verify', $email, $request->ip());

        if (RateLimiter::tooManyAttempts($attemptKey, 5)) {
            return response()->json([
                'success' => false,
                'message' => 'Too many invalid OTP attempts. Please try again later.',
            ], 429);
        }

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();
        if (!$user) {
            RateLimiter::hit($attemptKey, 300);
            return $this->invalidResponse();
        }

        if ($user->is_verified) {
            RateLimiter::clear($attemptKey);
            return response()->json([
                'success' => true,
                'message' => 'Account already verified.',
            ]);
        }

        if (!$user->otp || !$user->otp_expires_at || now()->greaterThan($user->otp_expires_at)) {
            RateLimiter::hit($attemptKey, 300);
            return response()->json([
                'success' => false,
                'message' => 'OTP has expired. Please request a new code.',
            ], 422);
        }

        if (!Hash::check($validated['otp'], $user->otp)) {
            RateLimiter::hit($attemptKey, 300);
            return $this->invalidResponse();
        }

        $user->forceFill([
            'is_verified' => true,
            'otp' => null,
            'otp_expires_at' => null,
        ])->save();

        RateLimiter::clear($attemptKey);

        return response()->json([
            'success' => true,
            'message' => 'OTP verified successfully.',
        ]);
    }

    public function resend(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
        ]);

        $email = mb_strtolower(trim($validated['email']));
        $cooldownKey = $this->attemptKey('resend', $email, $request->ip());

        if (RateLimiter::tooManyAttempts($cooldownKey, 1)) {
            return response()->json([
                'success' => false,
                'message' => 'Please wait before requesting another OTP.',
            ], 429);
        }

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to resend OTP. Please check your email address.',
            ], 422);
        }

        if ($user->is_verified) {
            return response()->json([
                'success' => false,
                'message' => 'Your account is already verified.',
            ], 409);
        }

        $otp = (string) random_int(100000, 999999);
        $user->forceFill([
            'otp' => Hash::make($otp),
            'otp_expires_at' => now()->addMinutes(self::OTP_EXPIRY_MINUTES),
        ])->save();
        Log::info('OTP generated', ['email' => $user->email, 'otp' => $otp]);

        if ($this->isDevOtpMode()) {
            return response()->json([
                'success' => true,
                'message' => 'OTP generated (DEV MODE)',
                'otp' => $otp,
                'expires_in' => self::OTP_EXPIRY_SECONDS,
            ]);
        }

        // Production email flow is intentionally ready but disabled for test mode.
        // try {
        //     Mail::to($user->email)->send(new OtpVerificationMail($otp, $user));
        // } catch (\Throwable $exception) {
        //     Log::error('OTP email send failed during resend', [
        //         'user_id' => $user->id,
        //         'email' => $user->email,
        //         'error' => $exception->getMessage(),
        //     ]);
        //
        //     return response()->json([
        //         'success' => false,
        //         'message' => 'Unable to send OTP email. Please verify mail credentials and try again.',
        //     ], 422);
        // }

        RateLimiter::hit($cooldownKey, 60);

        return response()->json([
            'success' => true,
            'message' => 'OTP regenerated successfully.',
        ]);
    }

    private function invalidResponse(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Invalid OTP or email address.',
        ], 422);
    }

    private function attemptKey(string $prefix, string $email, ?string $ip): string
    {
        return sprintf('otp:%s:%s:%s', $prefix, $email, $ip ?? 'unknown');
    }

    private function isDevOtpMode(): bool
    {
        return config('app.env') === 'local';
    }
}
