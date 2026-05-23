<?php

namespace App\Console\Commands;

use App\Mail\UserNotificationMail;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendTestEmail extends Command
{
    protected $signature = 'mail:test {email : Destination email address}';

    protected $description = 'Send a test email using the current mail configuration.';

    public function handle(): int
    {
        $email = trim((string) $this->argument('email'));

        $user = new User([
            'fname' => 'Test',
            'lname' => 'User',
            'email' => $email,
        ]);

        try {
            Mail::to($email)->send(new UserNotificationMail(
                $user,
                (string) config('app.name', 'CMMS').' Mail Test',
                'This is a test email from the current mail configuration.'
            ));
        } catch (\Throwable $exception) {
            $this->error('Failed to send test email: '.$exception->getMessage());
            return self::FAILURE;
        }

        $this->info('Test email sent successfully.');
        return self::SUCCESS;
    }
}
