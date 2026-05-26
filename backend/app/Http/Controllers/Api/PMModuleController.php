<?php

namespace App\Http\Controllers\Api;

use App\Models\PreventiveMaintenance;
use App\Models\PreventiveMaintenanceChecklist;
use App\Models\PreventiveMaintenanceReport;
use App\Models\PreventiveMaintenancePlan;
use App\Models\PreventiveMaintenanceSparePart;
use App\Models\SparePart;
use App\Models\UserNotification;
use App\Models\User;
use App\Services\PMGeneratorService;
use App\Services\PMNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class PMModuleController extends ModuleController
{
    // -----------------------------------------------------
    // SUPERVISOR ENDPOINTS
    // -----------------------------------------------------

    public function indexSupervisor(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $plans = PreventiveMaintenancePlan::with(['assignee:id,fname,lname', 'creator:id,fname,lname', 'asset:id,name,image_path,serial_number'])
            ->orderBy('next_due_date', 'asc')
            ->get();

        $history = PreventiveMaintenance::with(['assignee:id,fname,lname', 'asset:id,name,image_path,serial_number', 'report'])
            ->where('status', 'completed')
            ->orderBy('updated_at', 'desc')
            ->get();

        // Map plans to keys the frontend expects to display
        $mappedPlans = $plans->map(function ($plan) {
            $plan->scheduled_date = $plan->next_due_date ? $plan->next_due_date->toDateString() : null;
            $plan->frequency = $plan->frequency_type;
            return $plan;
        });

        return response()->json([
            'success' => true,
            'tasks' => $mappedPlans,
            'history' => $history
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);

        $validated = $request->validate([
            'asset_id' => 'required|exists:assets,id',
            'title' => 'required|string|max:200',
            'description' => 'nullable|string',
            'frequency' => 'required|in:daily,weekly,monthly,quarterly,yearly',
            'scheduled_date' => 'required|date',
            'priority' => 'required|in:low,medium,high,urgent',
            'assigned_technician_id' => 'required|exists:users,id',
            'notes' => 'nullable|string',
            'checklists' => 'nullable|array',
            'checklists.*' => 'required|string|max:255',
        ]);

        $plan = DB::transaction(function () use ($validated, $user) {
            $asset = \App\Models\Asset::find($validated['asset_id']);
            
            $plan = PreventiveMaintenancePlan::create([
                'asset_id' => $validated['asset_id'],
                'category_id' => $asset->category_id ?? 1,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'frequency_type' => $validated['frequency'],
                'frequency_interval' => 1,
                'start_date' => $validated['scheduled_date'],
                'next_due_date' => $validated['scheduled_date'],
                'priority' => $validated['priority'],
                'assigned_technician_id' => $validated['assigned_technician_id'],
                'created_by' => $user->id,
                'status' => 'active',
                'checklist' => $validated['checklists'] ?? [],
            ]);

            // Immediately generate the first PM work order instance
            $pm = PMGeneratorService::generateInitialWorkOrder($plan);

            // Advance the plan template next due date
            $plan->next_due_date = $plan->calculateNextDueDate()->toDateString();
            $plan->save();

            return $plan;
        });

        return response()->json([
            'success' => true,
            'message' => 'Preventive Maintenance plan created and initial work order generated successfully.',
            'task' => $plan->load(['asset', 'assignee'])
        ], 201);
    }

    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);
        $plan = PreventiveMaintenancePlan::findOrFail($id);
        
        $plan->status = $plan->status === 'active' ? 'paused' : 'active';
        $plan->save();

        return response()->json([
            'success' => true,
            'message' => 'Preventive Maintenance plan status updated successfully.',
            'plan' => $plan
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);
        $plan = PreventiveMaintenancePlan::findOrFail($id);
        $plan->delete();

        return response()->json([
            'success' => true,
            'message' => 'Preventive Maintenance plan deleted successfully.'
        ]);
    }

    // -----------------------------------------------------
    // TECHNICIAN ENDPOINTS
    // -----------------------------------------------------

    public function indexTechnician(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician']);
        
        $baseQuery = PreventiveMaintenance::where('assigned_technician_id', $user->id);

        $today = now()->toDateString();
        
        $upcoming = (clone $baseQuery)->where('status', '!=', 'completed')->where('scheduled_date', '>', $today)->count();
        $dueToday = (clone $baseQuery)->where('status', '!=', 'completed')->where('scheduled_date', '=', $today)->count();
        $overdue = (clone $baseQuery)->where('status', '!=', 'completed')->where('scheduled_date', '<', $today)->count();
        $completed = (clone $baseQuery)->where('status', 'completed')->count();

        $tasks = (clone $baseQuery)
            ->with('asset:id,name,image_path,serial_number')
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END")
            ->orderBy('scheduled_date', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'kpi' => [
                'upcoming' => $upcoming,
                'dueToday' => $dueToday,
                'overdue' => $overdue,
                'completed' => $completed,
            ],
            'tasks' => $tasks
        ]);
    }

    public function showTechnician(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician']);
        $task = PreventiveMaintenance::with(['checklists', 'report', 'asset:id,name,image_path,serial_number,status', 'spareParts.sparePart'])
            ->where('assigned_technician_id', $user->id)
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'task' => $task
        ]);
    }

    public function acceptTask(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician']);
        $task = PreventiveMaintenance::where('assigned_technician_id', $user->id)->findOrFail($id);

        if ($task->status === 'assigned' || $task->status === 'scheduled') {
            $task->update(['status' => 'in_progress']);
        }

        return response()->json([
            'success' => true,
            'task' => $task->fresh('checklists')
        ]);
    }

    public function updateChecklist(Request $request, int $id, int $checklistId): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician']);
        
        $task = PreventiveMaintenance::where('assigned_technician_id', $user->id)->findOrFail($id);
        $checklist = PreventiveMaintenanceChecklist::where('preventive_maintenance_id', $task->id)->findOrFail($checklistId);

        $validated = $request->validate([
            'is_completed' => 'required|boolean'
        ]);

        $checklist->update([
            'is_completed' => $validated['is_completed'],
            'completed_at' => $validated['is_completed'] ? now() : null
        ]);

        return response()->json([
            'success' => true,
            'checklist' => $checklist
        ]);
    }

    public function completeTask(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician']);
        $task = PreventiveMaintenance::where('assigned_technician_id', $user->id)->findOrFail($id);

        $validated = $request->validate([
            'condition_before' => 'nullable|string',
            'work_performed' => 'required|string',
            'parts_used' => 'nullable|string',
            'recommendations' => 'nullable|string',
            'completion_notes' => 'nullable|string',
            'before_image' => 'nullable|image|max:4096',
            'after_image' => 'nullable|image|max:4096',
            'spare_parts' => 'sometimes|array',
            'spare_parts.*.spare_part_id' => 'required|integer|exists:spare_parts,id',
            'spare_parts.*.quantity_used' => 'required|integer|min:1',
        ]);

        DB::transaction(function () use ($validated, $task, $request, $user) {
            $beforePath = null;
            if ($request->hasFile('before_image')) {
                $beforePath = $request->file('before_image')->store('pm-images', 'public');
            }

            $afterPath = null;
            if ($request->hasFile('after_image')) {
                $afterPath = $request->file('after_image')->store('pm-images', 'public');
            }

            // Verify and consumption of spare parts
            $partsUsedSummaryList = [];
            foreach ($validated['spare_parts'] ?? [] as $partUsage) {
                $part = SparePart::findOrFail($partUsage['spare_part_id']);
                $qty = (int) $partUsage['quantity_used'];

                if ($part->quantity_available < $qty) {
                    throw ValidationException::withMessages([
                        'spare_parts' => ["Insufficient stock for spare part: {$part->name}. Available: {$part->quantity_available}."]
                    ]);
                }

                $part->decrement('quantity_available', $qty);

                PreventiveMaintenanceSparePart::create([
                    'preventive_maintenance_id' => $task->id,
                    'spare_part_id' => $part->id,
                    'quantity_used' => $qty,
                    'unit_price' => $part->unit_price ?? 0,
                    'total_price' => ($part->unit_price ?? 0) * $qty,
                ]);

                $partsUsedSummaryList[] = "{$qty}x {$part->name}";
            }

            // Build or append to parts_used summary string
            $partsUsedSummary = $validated['parts_used'];
            if (!empty($partsUsedSummaryList)) {
                $invPartsStr = implode(', ', $partsUsedSummaryList);
                if (empty($partsUsedSummary)) {
                    $partsUsedSummary = "Inventory parts: " . $invPartsStr;
                } else {
                    $partsUsedSummary .= " (Inventory parts: " . $invPartsStr . ")";
                }
            }

            PreventiveMaintenanceReport::create([
                'preventive_maintenance_id' => $task->id,
                'condition_before' => $validated['condition_before'] ?? null,
                'work_performed' => $validated['work_performed'],
                'parts_used' => $partsUsedSummary ?? null,
                'recommendations' => $validated['recommendations'] ?? null,
                'completion_notes' => $validated['completion_notes'] ?? null,
                'before_image_path' => $beforePath,
                'after_image_path' => $afterPath,
            ]);

            $task->update(['status' => 'completed']);

            // Notify Supervisor (both in-app and email)
            PMNotificationService::notifyPMCompleted($task, $user);

            // Automatically prepare/generate next scheduled work order
            if ($task->plan_id) {
                $plan = PreventiveMaintenancePlan::find($task->plan_id);
                if ($plan) {
                    PMGeneratorService::generateNextWorkOrder($plan);
                }
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'PM Task completed successfully and next cycle scheduled.',
            'task' => $task->fresh(['checklists', 'report', 'spareParts.sparePart'])
        ]);
    }
}
