<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword as BaseResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordNotification extends BaseResetPassword
{
    public function toMail($notifiable): MailMessage
    {
        $resetUrl = $this->resetUrl($notifiable);
        $displayName = $notifiable->display_name ?? $notifiable->email;
        $appName = (string) config('app.name', 'CMMS');

        return (new MailMessage)
            ->subject($appName.' Password Reset')
            ->greeting('Hello '.$displayName.',')
            ->line('We received a request to reset your password.')
            ->action('Reset Password', $resetUrl)
            ->line('This password reset link will expire in '.config('auth.passwords.'.config('auth.defaults.passwords').'.expire').' minutes.')
            ->line('If you did not request a password reset, no further action is required.')
            ->line('If the button does not open, copy and paste this reset link into your browser: '.$resetUrl)
            ->salutation('Thanks, '.$appName.' Team');
    }
}
