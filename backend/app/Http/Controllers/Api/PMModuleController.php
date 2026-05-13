<?php

namespace App\Http\Controllers\Api;

use App\Models\PreventiveMaintenance;
use App\Models\PreventiveMaintenanceChecklist;
use App\Models\PreventiveMaintenanceReport;
use App\Models\UserNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PMModuleController extends ModuleController
{
    // -----------------------------------------------------
    // SUPERVISOR ENDPOINTS
    // -----------------------------------------------------

    public function indexSupervisor(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $tasks = PreventiveMaintenance::with(['assignee:id,fname,lname', 'creator:id,fname,lname', 'asset:id,name,image_path,serial_number'])
            ->orderBy('scheduled_date', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'tasks' => $tasks
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

        $pm = DB::transaction(function () use ($validated, $user) {
            $pm = PreventiveMaintenance::create([
                'asset_id' => $validated['asset_id'],
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'frequency' => $validated['frequency'],
                'scheduled_date' => $validated['scheduled_date'],
                'priority' => $validated['priority'],
                'assigned_technician_id' => $validated['assigned_technician_id'],
                'created_by' => $user->id,
                'status' => 'assigned',
                'notes' => $validated['notes'] ?? null,
            ]);

            if (!empty($validated['checklists'])) {
                foreach ($validated['checklists'] as $taskDesc) {
                    PreventiveMaintenanceChecklist::create([
                        'preventive_maintenance_id' => $pm->id,
                        'task_description' => $taskDesc,
                    ]);
                }
            }

            return $pm;
        });

        // Notify Technician
        UserNotification::create([
            'user_id' => $pm->assigned_technician_id,
            'recipient_role' => 'technician',
            'type' => 'pm_assigned',
            'module' => 'preventive_maintenance',
            'related_id' => $pm->id,
            'message' => "You have been assigned a new PM Task: {$pm->title}",
            'is_read' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Preventive Maintenance schedule created and assigned successfully.',
            'task' => $pm->load(['checklists', 'asset'])
        ], 201);
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
        $task = PreventiveMaintenance::with(['checklists', 'report', 'asset:id,name,image_path,serial_number,status'])
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

            PreventiveMaintenanceReport::create([
                'preventive_maintenance_id' => $task->id,
                'condition_before' => $validated['condition_before'] ?? null,
                'work_performed' => $validated['work_performed'],
                'parts_used' => $validated['parts_used'] ?? null,
                'recommendations' => $validated['recommendations'] ?? null,
                'completion_notes' => $validated['completion_notes'] ?? null,
                'before_image_path' => $beforePath,
                'after_image_path' => $afterPath,
            ]);

            $task->update(['status' => 'completed']);

            // Notify Supervisor
            UserNotification::create([
                'user_id' => $task->created_by,
                'recipient_role' => 'supervisor',
                'type' => 'pm_completed',
                'module' => 'preventive_maintenance',
                'related_id' => $task->id,
                'message' => "PM Task '{$task->title}' has been completed by " . $user->fname . ".",
                'is_read' => false,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'PM Task completed successfully.',
            'task' => $task->fresh(['checklists', 'report'])
        ]);
    }
}
