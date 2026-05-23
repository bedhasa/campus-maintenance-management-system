<?php

namespace App\Support;

class FrontendUrl
{
    public static function base(): string
    {
        return rtrim((string) config('app.frontend_url', 'http://localhost:3000'), '/');
    }

    public static function path(string $path = ''): string
    {
        $normalizedPath = trim($path);

        if ($normalizedPath === '') {
            return self::base();
        }

        return self::base().'/'.ltrim($normalizedPath, '/');
    }

    public static function login(): string
    {
        return self::path('/login');
    }

    public static function resetPassword(string $token, string $email): string
    {
        return self::path('/reset-password').'?token='.rawurlencode($token).'&email='.rawurlencode($email);
    }

    public static function verifyOtp(string $email): string
    {
        return self::path('/verify-otp').'?email='.rawurlencode($email);
    }
}
