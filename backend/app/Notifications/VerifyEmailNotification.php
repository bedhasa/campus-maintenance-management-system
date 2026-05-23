<?php

namespace App\Notifications;

use App\Support\FrontendUrl;
use Illuminate\Auth\Notifications\VerifyEmail as BaseVerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;

class VerifyEmailNotification extends BaseVerifyEmail
{
    public function toMail($notifiable): MailMessage
    {
        $verificationUrl = $this->verificationUrl($notifiable);
        $loginUrl = FrontendUrl::login();
        $displayName = $notifiable->display_name ?? $notifiable->email;
        $appName = (string) config('app.name', 'CMMS');

        return (new MailMessage)
            ->subject($appName.' Email Verification')
            ->greeting('Hello '.$displayName.',')
            ->line('Please verify your email address to continue using the system.')
            ->action('Verify Email Address', $verificationUrl)
            ->line('You can also open the system directly using the link below.')
            ->action('Open System', $loginUrl)
            ->line('System link: '.$loginUrl)
            ->salutation('Thanks, '.$appName.' Team');
    }
}
