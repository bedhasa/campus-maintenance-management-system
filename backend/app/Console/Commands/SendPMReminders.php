<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\PreventiveMaintenance;
use App\Models\PreventiveMaintenancePlan;
use App\Services\PMNotificationService;
use App\Services\PMGeneratorService;

class SendPMReminders extends Command
{
    protected $signature = 'pm:send-reminders';
    protected $description = 'Generate due PM tasks and send automatic reminders/alerts';

    public function handle()
    {
        $today = now()->startOfDay();
        $todayStr = $today->toDateString();

        // 1. Automatically generate due work orders from active plans
        $duePlans = PreventiveMaintenancePlan::where('status', 'active')
            ->whereDate('next_due_date', '<=', $todayStr)
            ->get();

        foreach ($duePlans as $plan) {
            // Check if there is an active (status != completed) work order for this plan
            $hasActiveWorkOrder = PreventiveMaintenance::where('plan_id', $plan->id)
                ->where('status', '!=', 'completed')
                ->exists();

            if (!$hasActiveWorkOrder) {
                PMGeneratorService::generateWorkOrder($plan, $plan->next_due_date);
                $plan->next_due_date = $plan->calculateNextDueDate()->toDateString();
                $plan->save();
            }
        }

        // 2. 3 Days Reminder
        $threeDaysFromNow = now()->addDays(3)->startOfDay()->toDateString();
        $tasksIn3Days = PreventiveMaintenance::where('status', '!=', 'completed')
            ->whereDate('scheduled_date', $threeDaysFromNow)
            ->get();

        foreach ($tasksIn3Days as $task) {
            PMNotificationService::notifyPMDueSoon($task, "due in 3 days");
        }

        // 3. 1 Day Reminder
        $tomorrow = now()->addDay()->startOfDay()->toDateString();
        $tasksTomorrow = PreventiveMaintenance::where('status', '!=', 'completed')
            ->whereDate('scheduled_date', $tomorrow)
            ->get();

        foreach ($tasksTomorrow as $task) {
            PMNotificationService::notifyPMDueSoon($task, "due tomorrow");
        }

        // 4. Due Today
        $tasksToday = PreventiveMaintenance::where('status', '!=', 'completed')
            ->whereDate('scheduled_date', $todayStr)
            ->get();

        foreach ($tasksToday as $task) {
            PMNotificationService::notifyPMDueSoon($task, "due today!");
        }

        // 5. Overdue (notify supervisor and technician)
        $overdueTasks = PreventiveMaintenance::where('status', '!=', 'completed')
            ->whereDate('scheduled_date', '<', $todayStr)
            ->get();

        foreach ($overdueTasks as $task) {
            PMNotificationService::notifyPMOverdue($task);
        }

        $this->info('PM generation and reminders executed successfully.');
    }
}
