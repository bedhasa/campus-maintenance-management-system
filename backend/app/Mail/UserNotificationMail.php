<?php

namespace App\Mail;

use App\Models\User;
use App\Support\FrontendUrl;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class UserNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $subjectLine,
        public string $messageBody,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->subjectLine,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.user-notification',
            with: [
                'user' => $this->user,
                'displayName' => $this->user->display_name,
                'messageBody' => $this->messageBody,
                'appName' => (string) config('app.name', 'CMMS'),
                'systemUrl' => FrontendUrl::base(),
                'loginUrl' => FrontendUrl::login(),
            ],
        );
    }
}
