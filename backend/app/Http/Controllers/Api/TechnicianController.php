<?php

namespace App\Http\Controllers\Api;

use App\Models\MaintenanceRequest;
use App\Models\SparePart;
use App\Models\UserNotification;
use App\Models\WorkOrder;
use App\Models\WorkOrderSparePart;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TechnicianController extends ModuleController
{
    public function dashboard(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);

        $base = WorkOrder::query()->where('assigned_to', $user->id);
        $overdueIds = MaintenanceRequest::query()
            ->whereNotNull('due_date')
            ->where('due_date', '<', now())
            ->whereNotIn('status', ['completed', 'closed', 'rejected'])
            ->pluck('id')
            ->all();

        return response()->json([
            'success' => true,
            'summary' => [
                'assigned' => (clone $base)->where('work_status', 'assigned')->count(),
                'in_progress' => (clone $base)->where('work_status', 'in_progress')->count(),
                'completed' => (clone $base)->where('work_status', 'completed')->count(),
                'overdue' => (clone $base)->whereIn('request_id', $overdueIds)->whereIn('work_status', ['assigned', 'in_progress'])->count(),
            ],
            'assigned_jobs' => (clone $base)->with(['request:id,title,priority,status,due_date', 'spareParts'])->latest()->paginate(15),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);
        $workOrder = WorkOrder::query()
            ->with([
                'request:id,title,description,priority,status,due_date,category_id,building_id,room_id',
                'request.messages' => fn ($q) => $q->whereNull('deleted_at')->with('sender:id,fname,lname')->oldest(),
                'request.images',
                'spareParts.sparePart',
            ])
            ->findOrFail($id);

        if (!$user->tokenCan('role:admin') && (int) $workOrder->assigned_to !== (int) $user->id) {
            return $this->forbidden();
        }

        return response()->json([
            'success' => true,
            'work_order' => $workOrder,
        ]);
    }

    public function start(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);
        $workOrder = WorkOrder::query()->with('request')->findOrFail($id);

        if (!$user->tokenCan('role:admin') && (int) $workOrder->assigned_to !== (int) $user->id) {
            return $this->forbidden();
        }

        $workOrder->update(['work_status' => 'in_progress']);
        if ($workOrder->request) {
            $workOrder->request->update(['status' => 'in_progress']);
        }

        ActivityLogger::log($user->id, 'work_order', 'start', $workOrder->id, "Work order #{$workOrder->id} started.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Work order marked in progress.',
            'work_order' => $workOrder->fresh(),
        ]);
    }

    public function complete(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);
        $workOrder = WorkOrder::query()->with('request')->findOrFail($id);

        if (!$user->tokenCan('role:admin') && (int) $workOrder->assigned_to !== (int) $user->id) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'completion_note' => ['required', 'string', 'max:5000'],
            'delay_reason' => ['nullable', 'string', 'max:1000'],
            'spare_parts' => ['sometimes', 'array'],
            'spare_parts.*.spare_part_id' => ['required', 'integer', 'exists:spare_parts,id'],
            'spare_parts.*.quantity_used' => ['required', 'integer', 'min:1'],
        ]);

        $isOverdue = $workOrder->request?->due_date && now()->greaterThan($workOrder->request->due_date);
        if ($isOverdue && empty($validated['delay_reason'])) {
            return response()->json([
                'success' => false,
                'message' => 'Delay reason is required when completing overdue work.',
            ], 422);
        }

        foreach ($validated['spare_parts'] ?? [] as $usage) {
            $part = SparePart::query()->findOrFail($usage['spare_part_id']);
            $qty = (int) $usage['quantity_used'];

            WorkOrderSparePart::create([
                'work_order_id' => $workOrder->id,
                'spare_part_id' => $part->id,
                'quantity_used' => $qty,
                'unit_price' => $part->unit_price,
                'total_price' => (float) $part->unit_price * $qty,
            ]);

            $part->decrement('quantity_available', $qty);
            ActivityLogger::log($user->id, 'inventory', 'deduct', $part->id, "Deducted {$qty} from {$part->part_code} for work order #{$workOrder->id}.", $request);
        }

        $workOrder->update([
            'work_status' => 'completed',
            'completion_note' => $validated['completion_note'],
            'delay_reason' => $validated['delay_reason'] ?? null,
            'completed_at' => now(),
        ]);

        if ($workOrder->request) {
            $workOrder->request->update(['status' => 'completed']);
            UserNotification::create([
                'user_id' => $workOrder->request->requester_id,
                'recipient_role' => 'requester',
                'type' => 'request_completed',
                'module' => 'work_order',
                'related_id' => $workOrder->request->id,
                'message' => "Request #{$workOrder->request->id} has been completed.",
                'is_read' => false,
            ]);
        }

        ActivityLogger::log($user->id, 'work_order', 'complete', $workOrder->id, "Work order #{$workOrder->id} completed.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Work order completed.',
            'work_order' => $workOrder->fresh(['spareParts.sparePart']),
        ]);
    }
}

