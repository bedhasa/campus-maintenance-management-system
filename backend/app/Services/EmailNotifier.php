<?php

namespace App\Services;

use App\Mail\UserNotificationMail;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EmailNotifier
{
    public static function sendToUser(?User $user, string $subject, string $message): void
    {
        if (!$user || empty($user->email)) {
            return;
        }

        try {
            Mail::to($user->email)->send(new UserNotificationMail($user, $subject, $message));
        } catch (\Throwable $exception) {
            Log::warning('Email notification send failed', [
                'user_id' => $user->id,
                'email' => $user->email,
                'subject' => $subject,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
