<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserNotification;
use App\Models\PreventiveMaintenance;
use App\Services\EmailNotifier;

class PMNotificationService
{
    public static function notifyNewPMTask(PreventiveMaintenance $task): void
    {
        $tech = User::find($task->assigned_technician_id);
        if ($tech) {
            // In-app
            UserNotification::create([
                'user_id' => $tech->id,
                'recipient_role' => 'technician',
                'type' => 'pm_assigned',
                'module' => 'preventive_maintenance',
                'related_id' => $task->id,
                'message' => "You have been assigned a new PM Task: {$task->title}",
                'is_read' => false,
            ]);

            // Email
            EmailNotifier::sendToUser(
                $tech,
                "New PM Task Assigned: {$task->title}",
                "Hello {$tech->fname},\n\nYou have been assigned a new Preventive Maintenance task: '{$task->title}' for Asset: " . ($task->asset?->name ?? 'Unknown Asset') . ".\nScheduled Date: {$task->scheduled_date}\n\nPlease check your PM task list on the dashboard."
            );
        }
    }

    public static function notifyPMDueSoon(PreventiveMaintenance $task, string $dueText): void
    {
        $tech = User::find($task->assigned_technician_id);
        if ($tech) {
            // In-app
            UserNotification::create([
                'user_id' => $tech->id,
                'recipient_role' => 'technician',
                'type' => 'pm_reminder',
                'module' => 'preventive_maintenance',
                'related_id' => $task->id,
                'message' => "Reminder: Your PM Task '{$task->title}' is {$dueText}.",
                'is_read' => false,
            ]);

            // Email
            EmailNotifier::sendToUser(
                $tech,
                "Reminder: PM Task '{$task->title}' is {$dueText}",
                "Hello {$tech->fname},\n\nThis is a reminder that your assigned Preventive Maintenance task '{$task->title}' is {$dueText} (Scheduled: {$task->scheduled_date})."
            );
        }
    }

    public static function notifyPMOverdue(PreventiveMaintenance $task): void
    {
        $tech = User::find($task->assigned_technician_id);
        $supervisor = User::find($task->created_by);

        if ($tech) {
            // In-app for technician
            UserNotification::create([
                'user_id' => $tech->id,
                'recipient_role' => 'technician',
                'type' => 'pm_reminder',
                'module' => 'preventive_maintenance',
                'related_id' => $task->id,
                'message' => "Overdue Notice: Your PM Task '{$task->title}' is overdue!",
                'is_read' => false,
            ]);

            // Email for technician
            EmailNotifier::sendToUser(
                $tech,
                "Overdue Notice: PM Task '{$task->title}' is overdue!",
                "Hello {$tech->fname},\n\nYour assigned Preventive Maintenance task '{$task->title}' is OVERDUE. It was scheduled for {$task->scheduled_date}. Please complete it as soon as possible."
            );
        }

        if ($supervisor) {
            // In-app for supervisor
            UserNotification::create([
                'user_id' => $supervisor->id,
                'recipient_role' => 'supervisor',
                'type' => 'pm_overdue',
                'module' => 'preventive_maintenance',
                'related_id' => $task->id,
                'message' => "Overdue PM Task: '{$task->title}' assigned to technician " . ($tech ? "{$tech->fname} {$tech->lname}" : 'N/A') . " is overdue.",
                'is_read' => false,
            ]);

            // Email for supervisor
            EmailNotifier::sendToUser(
                $supervisor,
                "Overdue PM Task: '{$task->title}'",
                "Hello {$supervisor->fname},\n\nThe Preventive Maintenance task '{$task->title}' (Scheduled: {$task->scheduled_date}) assigned to technician " . ($tech ? "{$tech->fname} {$tech->lname}" : 'N/A') . " is now overdue."
            );
        }
    }

    public static function notifyPMCompleted(PreventiveMaintenance $task, User $technician): void
    {
        $supervisor = User::find($task->created_by);
        if ($supervisor) {
            // In-app
            UserNotification::create([
                'user_id' => $supervisor->id,
                'recipient_role' => 'supervisor',
                'type' => 'pm_completed',
                'module' => 'preventive_maintenance',
                'related_id' => $task->id,
                'message' => "PM Task '{$task->title}' has been completed by {$technician->fname} {$technician->lname}.",
                'is_read' => false,
            ]);

            // Email
            EmailNotifier::sendToUser(
                $supervisor,
                "PM Task Completed: {$task->title}",
                "Hello {$supervisor->fname},\n\nThe Preventive Maintenance task '{$task->title}' for Asset: " . ($task->asset?->name ?? 'Unknown Asset') . " has been completed by technician {$technician->fname} {$technician->lname}."
            );
        }
    }
}
