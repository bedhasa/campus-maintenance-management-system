<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\PreventiveMaintenance;
use App\Models\UserNotification;

class SendPMReminders extends Command
{
    protected $signature = 'pm:send-reminders';
    protected $description = 'Send automatic reminders for Preventive Maintenance tasks';

    public function handle()
    {
        $today = now()->startOfDay();

        // 3 Days Reminder
        $threeDaysFromNow = now()->addDays(3)->startOfDay();
        $tasksIn3Days = PreventiveMaintenance::where('status', '!=', 'completed')
            ->whereDate('scheduled_date', $threeDaysFromNow)
            ->get();

        foreach ($tasksIn3Days as $task) {
            $this->notifyTechnician($task, "Reminder: Your PM Task '{$task->title}' is due in 3 days.");
        }

        // 1 Day Reminder
        $tomorrow = now()->addDay()->startOfDay();
        $tasksTomorrow = PreventiveMaintenance::where('status', '!=', 'completed')
            ->whereDate('scheduled_date', $tomorrow)
            ->get();

        foreach ($tasksTomorrow as $task) {
            $this->notifyTechnician($task, "Reminder: Your PM Task '{$task->title}' is due tomorrow.");
        }

        // Due Today
        $tasksToday = PreventiveMaintenance::where('status', '!=', 'completed')
            ->whereDate('scheduled_date', $today)
            ->get();

        foreach ($tasksToday as $task) {
            $this->notifyTechnician($task, "Final Reminder: Your PM Task '{$task->title}' is due today!");
        }

        // Overdue (notify supervisor and technician)
        $overdueTasks = PreventiveMaintenance::where('status', '!=', 'completed')
            ->whereDate('scheduled_date', '<', $today)
            ->get();

        foreach ($overdueTasks as $task) {
            $this->notifyTechnician($task, "Overdue Notice: Your PM Task '{$task->title}' is overdue!");
            $this->notifySupervisor($task, "Overdue PM Task: '{$task->title}' assigned to technician ID {$task->assigned_technician_id} is overdue.");
        }

        $this->info('PM reminders sent successfully.');
    }

    private function notifyTechnician($task, $message)
    {
        UserNotification::create([
            'user_id' => $task->assigned_technician_id,
            'recipient_role' => 'technician',
            'type' => 'pm_reminder',
            'module' => 'preventive_maintenance',
            'related_id' => $task->id,
            'message' => $message,
            'is_read' => false,
        ]);
    }

    private function notifySupervisor($task, $message)
    {
        UserNotification::create([
            'user_id' => $task->created_by,
            'recipient_role' => 'supervisor',
            'type' => 'pm_overdue',
            'module' => 'preventive_maintenance',
            'related_id' => $task->id,
            'message' => $message,
            'is_read' => false,
        ]);
    }
}
