<?php

namespace App\Services;

use App\Models\PreventiveMaintenancePlan;
use App\Models\PreventiveMaintenance;
use App\Models\PreventiveMaintenanceChecklist;
use App\Services\PMNotificationService;
use Carbon\Carbon;

class PMGeneratorService
{
    public static function generateWorkOrder(PreventiveMaintenancePlan $plan, $scheduledDate): ?PreventiveMaintenance
    {
        if ($plan->status === 'paused') {
            return null;
        }

        // Avoid double generation for the same plan and scheduled date
        $exists = PreventiveMaintenance::where('plan_id', $plan->id)
            ->whereDate('scheduled_date', $scheduledDate)
            ->where('status', '!=', 'completed')
            ->exists();
            
        if ($exists) {
            return null;
        }

        $pm = PreventiveMaintenance::create([
            'plan_id' => $plan->id,
            'asset_id' => $plan->asset_id,
            'title' => $plan->title,
            'description' => $plan->description,
            'frequency' => $plan->frequency_type,
            'scheduled_date' => $scheduledDate,
            'priority' => $plan->priority,
            'assigned_technician_id' => $plan->assigned_technician_id,
            'created_by' => $plan->created_by,
            'status' => 'assigned',
            'notes' => null,
        ]);

        // Copy checklist items from plan
        if (!empty($plan->checklist) && is_array($plan->checklist)) {
            foreach ($plan->checklist as $taskDesc) {
                if (!empty($taskDesc)) {
                    PreventiveMaintenanceChecklist::create([
                        'preventive_maintenance_id' => $pm->id,
                        'task_description' => $taskDesc,
                        'is_completed' => false,
                    ]);
                }
            }
        }

        // Notify technician (in-app and email)
        PMNotificationService::notifyNewPMTask($pm);

        return $pm;
    }

    public static function generateInitialWorkOrder(PreventiveMaintenancePlan $plan): ?PreventiveMaintenance
    {
        // First work order is generated for the start_date / initial next_due_date
        $scheduledDate = $plan->next_due_date;
        $pm = self::generateWorkOrder($plan, $scheduledDate);

        return $pm;
    }

    public static function generateNextWorkOrder(PreventiveMaintenancePlan $plan): ?PreventiveMaintenance
    {
        // Calculate the next due date
        $nextDueDate = $plan->calculateNextDueDate();
        
        // Update plan template next due date
        $plan->next_due_date = $nextDueDate->toDateString();
        $plan->save();

        // Generate the next work order instance
        return self::generateWorkOrder($plan, $plan->next_due_date);
    }
}
