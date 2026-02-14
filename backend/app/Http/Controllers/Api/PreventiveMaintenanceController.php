<?php

namespace App\Http\Controllers\Api;

use App\Models\PreventiveMaintenanceAssignment;
use App\Models\PreventiveMaintenanceLog;
use App\Models\PreventiveMaintenancePlan;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PreventiveMaintenanceController extends ModuleController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $validated = $request->validate([
            'status' => ['nullable', 'in:active,paused'],
        ]);

        $query = PreventiveMaintenancePlan::query()
            ->with(['asset:id,name', 'category:id,name', 'assignee:id,fname,lname', 'creator:id,fname,lname'])
            ->orderBy('next_due_date');

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        return response()->json([
            'success' => true,
            'plans' => $query->paginate(20),
            'upcoming' => PreventiveMaintenancePlan::query()
                ->where('status', 'active')
                ->whereBetween('next_due_date', [now()->toDateString(), now()->copy()->addDays(14)->toDateString()])
                ->count(),
            'overdue' => PreventiveMaintenancePlan::query()
                ->where('status', 'active')
                ->whereDate('next_due_date', '<', now()->toDateString())
                ->count(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'asset_id' => ['nullable', 'integer', 'exists:assets,id'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'frequency_type' => ['required', 'in:daily,weekly,monthly,quarterly,yearly'],
            'frequency_interval' => ['required', 'integer', 'min:1'],
            'next_due_date' => ['required', 'date'],
            'priority' => ['required', 'in:low,medium,high,urgent'],
            'estimated_hours' => ['nullable', 'numeric', 'min:0.25'],
            'assigned_technician_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'in:active,paused'],
        ]);

        $plan = PreventiveMaintenancePlan::create([
            ...$validated,
            'created_by' => $user->id,
            'status' => $validated['status'] ?? 'active',
        ]);

        if (!empty($validated['assigned_technician_id'])) {
            PreventiveMaintenanceAssignment::create([
                'plan_id' => $plan->id,
                'user_id' => $validated['assigned_technician_id'],
                'assigned_by' => $user->id,
                'created_at' => now(),
            ]);
        }

        ActivityLogger::log($user->id, 'preventive_maintenance', 'create_plan', $plan->id, "PM plan #{$plan->id} created.", $request);

        return response()->json([
            'success' => true,
            'plan' => $plan->load(['asset:id,name', 'category:id,name', 'assignee:id,fname,lname']),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $plan = PreventiveMaintenancePlan::query()->findOrFail($id);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'asset_id' => ['nullable', 'integer', 'exists:assets,id'],
            'category_id' => ['sometimes', 'integer', 'exists:categories,id'],
            'frequency_type' => ['sometimes', 'in:daily,weekly,monthly,quarterly,yearly'],
            'frequency_interval' => ['sometimes', 'integer', 'min:1'],
            'next_due_date' => ['sometimes', 'date'],
            'priority' => ['sometimes', 'in:low,medium,high,urgent'],
            'estimated_hours' => ['nullable', 'numeric', 'min:0.25'],
            'assigned_technician_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['sometimes', 'in:active,paused'],
        ]);

        $plan->update($validated);

        if (array_key_exists('assigned_technician_id', $validated) && !empty($validated['assigned_technician_id'])) {
            PreventiveMaintenanceAssignment::query()->updateOrCreate(
                ['plan_id' => $plan->id, 'user_id' => $validated['assigned_technician_id']],
                ['assigned_by' => $user->id, 'created_at' => now()]
            );
        }

        ActivityLogger::log($user->id, 'preventive_maintenance', 'update_plan', $plan->id, "PM plan #{$plan->id} updated.", $request);

        return response()->json([
            'success' => true,
            'plan' => $plan->fresh(['asset:id,name', 'category:id,name', 'assignee:id,fname,lname']),
        ]);
    }

    public function triggerDue(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $result = $this->runDuePlanTrigger($request, $user->id);

        return response()->json([
            'success' => true,
            'created_work_orders' => $result,
        ]);
    }

    public function runDuePlanTrigger(?Request $request = null, ?int $actorId = null): array
    {
        $createdIds = [];
        $duePlans = PreventiveMaintenancePlan::query()
            ->where('status', 'active')
            ->whereDate('next_due_date', '<=', now()->toDateString())
            ->get();

        foreach ($duePlans as $plan) {
            $workOrder = WorkOrder::create([
                'request_id' => null,
                'created_by' => $actorId ?? $plan->created_by,
                'assigned_to' => $plan->assigned_technician_id,
                'priority' => $plan->priority,
                'scheduled_date' => $plan->next_due_date,
                'scheduled_time' => null,
                'estimated_hours' => $plan->estimated_hours,
                'work_status' => 'assigned',
            ]);

            PreventiveMaintenanceLog::create([
                'plan_id' => $plan->id,
                'work_order_id' => $workOrder->id,
                'performed_at' => null,
                'notes' => 'Auto-generated preventive maintenance work order.',
                'created_at' => now(),
            ]);

            $plan->next_due_date = $plan->calculateNextDueDate()->toDateString();
            $plan->save();

            $createdIds[] = $workOrder->id;
            ActivityLogger::log($actorId, 'preventive_maintenance', 'trigger', $plan->id, "PM plan #{$plan->id} generated work order #{$workOrder->id}.", $request);
        }

        return $createdIds;
    }

    public function technicians(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $techs = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'technician'))
            ->with(['specialties:id,name,category_id'])
            ->withCount([
                'assignedWorkOrders as open_workload' => fn ($q) => $q->whereIn('work_status', ['assigned', 'in_progress']),
            ])
            ->get(['id', 'fname', 'lname', 'phone', 'avg_rating', 'total_ratings']);

        return response()->json([
            'success' => true,
            'technicians' => $techs,
        ]);
    }
}

