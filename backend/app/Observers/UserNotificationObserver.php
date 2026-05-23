<?php

namespace App\Observers;

use App\Models\UserNotification;
use App\Services\EmailNotifier;

class UserNotificationObserver
{
    public function created(UserNotification $notification): void
    {
        $notification->loadMissing(['user.setting']);

        $user = $notification->user;
        if (!$user) {
            return;
        }

        if (!$this->shouldSendEmail($notification)) {
            return;
        }

        EmailNotifier::sendToUser(
            $user,
            $this->subjectFor($notification),
            (string) $notification->message
        );
    }

    private function shouldSendEmail(UserNotification $notification): bool
    {
        $setting = $notification->user?->setting;

        $type = strtolower((string) $notification->type);

        if (str_contains($type, 'chat')) {
            return $setting?->notify_chat ?? true;
        }

        if (str_contains($type, 'feedback') || str_contains($type, 'rating')) {
            return $setting?->notify_feedback ?? true;
        }

        return $setting?->notify_status ?? true;
    }

    private function subjectFor(UserNotification $notification): string
    {
        $appName = (string) config('app.name', 'CMMS');
        $module = trim((string) $notification->module);

        if ($module !== '') {
            return "{$appName} ".ucfirst($module)." Notification";
        }

        return "{$appName} Notification";
    }
}
