<?php

namespace App\Http\Controllers\Api;

use App\Models\MaintenanceRequest;
use App\Models\RequestImage;
use App\Models\RequestMessage;
use App\Models\RequestStatusLog;
use App\Models\SparePart;
use App\Models\UserNotification;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderSparePart;
use App\Models\WorkOrderStatusLog;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\QueryException;
use Illuminate\Validation\ValidationException;

class TechnicianController extends ModuleController
{
    private array $workOrderColumnCache = [];

    public function index(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);
        $validated = $request->validate([
            'status' => ['nullable', 'in:assigned,in_progress,paused,completed,active'],
            'filter' => ['nullable', 'in:delayed'],
        ]);

        $query = WorkOrder::query()
            ->where('assigned_to', $user->id)
            ->with([
                'request:id,title,description,priority,status,due_date,created_at,category_id,building_id,room_id',
                'request.category:id,name',
                'request.building:id,name',
                'request.room:id,name',
            ])
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END")
            ->orderBy('created_at')
            ->orderBy('id');

        if (!empty($validated['status'])) {
            if ($validated['status'] === 'active') {
                $query->whereIn('work_status', ['in_progress', 'paused']);
            } else {
                $query->where('work_status', $validated['status']);
            }
        }

        if (($validated['filter'] ?? null) === 'delayed') {
            $query->where(function ($builder) {
                $builder
                    ->whereNotNull('delay_reason')
                    ->orWhereHas('request', fn ($rq) => $rq
                        ->whereNotNull('due_date')
                        ->where('due_date', '<', now())
                        ->whereNotIn('status', ['completed', 'closed', 'rejected']));
            });
        }

        return response()->json([
            'success' => true,
            'work_orders' => $query->paginate(20),
        ]);
    }

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
                'in_progress' => (clone $base)->whereIn('work_status', ['in_progress', 'paused'])->count(),
                'completed' => (clone $base)->where('work_status', 'completed')->count(),
                'overdue' => (clone $base)
                    ->whereIn('request_id', $overdueIds)
                    ->whereIn('work_status', ['assigned', 'in_progress', 'paused'])
                    ->count(),
            ],
            'assigned_jobs' => (clone $base)->with(['request:id,title,priority,status,due_date', 'spareParts'])->latest()->paginate(15),
        ]);
    }

    public function spareParts(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['technician', 'admin']);

        return response()->json([
            'success' => true,
            'spare_parts' => SparePart::query()
                ->orderBy('name')
                ->get(['id', 'name', 'part_code', 'quantity_available', 'unit_price']),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);
        $workOrder = WorkOrder::query()->findOrFail($id);

        if (!$user->tokenCan('role:admin') && (int) $workOrder->assigned_to !== (int) $user->id) {
            return $this->forbidden();
        }

        return response()->json([
            'success' => true,
            'work_order' => $this->freshWorkOrderDetail($workOrder),
        ]);
    }

    public function start(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);
        $workOrder = WorkOrder::query()->with('request')->findOrFail($id);

        if (!$user->tokenCan('role:admin') && (int) $workOrder->assigned_to !== (int) $user->id) {
            return $this->forbidden();
        }

        if (!in_array($workOrder->work_status, ['assigned', 'paused'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only pending or paused work orders can be started.',
            ], 422);
        }

        $oldStatus = $workOrder->work_status;
        $now = now();
        $this->updateWorkOrderSafe($workOrder, [
            'work_status' => 'in_progress',
            'started_at' => $workOrder->started_at ?? $now,
            'resumed_at' => $oldStatus === 'paused' ? $now : $workOrder->resumed_at,
            'status_updated_at' => $now,
        ]);

        $this->logWorkOrderStatusChange(
            $workOrder,
            $user->id,
            $oldStatus,
            'in_progress',
            $oldStatus === 'paused' ? 'Technician resumed work.' : 'Technician started work.'
        );

        if ($workOrder->request) {
            $oldRequestStatus = $workOrder->request->status;
            if ($oldRequestStatus !== 'in_progress') {
                $workOrder->request->update(['status' => 'in_progress']);
                RequestStatusLog::create([
                    'request_id' => $workOrder->request->id,
                    'changed_by' => $user->id,
                    'old_status' => $oldRequestStatus,
                    'new_status' => 'in_progress',
                    'comment' => $oldStatus === 'paused' ? 'Technician resumed work.' : 'Technician started work.',
                ]);
            }

            $requestCode = $this->requestCode((int) $workOrder->request->id);
            $this->notifyRequester($workOrder, 'request_in_progress', "Technician has started working on your maintenance request #{$requestCode}.");
            $this->notifyRole('supervisor', 'request_in_progress', 'work_order', $workOrder->request->id, "Maintenance request #{$requestCode} is now in progress.");
        }

        ActivityLogger::log($user->id, 'work_order', 'start', $workOrder->id, "Work order #{$workOrder->id} started.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Work order marked in progress.',
            'work_order' => $this->freshWorkOrderDetail($workOrder),
        ]);
    }

    public function pause(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);
        $workOrder = WorkOrder::query()->with('request')->findOrFail($id);

        if (!$user->tokenCan('role:admin') && (int) $workOrder->assigned_to !== (int) $user->id) {
            return $this->forbidden();
        }

        if ($workOrder->work_status === 'paused') {
            return response()->json([
                'success' => true,
                'message' => 'Work order is already paused.',
                'work_order' => $workOrder->fresh(),
            ]);
        }

        if ($workOrder->work_status !== 'in_progress') {
            return response()->json([
                'success' => false,
                'message' => 'Only in-progress work orders can be paused.',
            ], 422);
        }

        $validated = $request->validate([
            'pause_reason' => ['nullable', 'string', 'max:1000'],
            'status_update' => ['nullable', 'in:waiting_for_parts,on_hold'],
        ]);

        $oldStatus = $workOrder->work_status;
        $now = now();
        $pauseReason = trim((string) ($validated['pause_reason'] ?? ''));

        try {
            $this->updateWorkOrderSafe($workOrder, [
                'work_status' => 'paused',
                'paused_at' => $now,
                'status_updated_at' => $now,
                'delay_reason' => $pauseReason !== '' ? $pauseReason : $workOrder->delay_reason,
            ]);
        } catch (QueryException) {
            return response()->json([
                'success' => false,
                'message' => 'Pause action is temporarily unavailable. Please refresh and try again.',
            ], 422);
        }

        $statusUpdate = (string) ($validated['status_update'] ?? '');
        $label = $statusUpdate === 'waiting_for_parts'
            ? 'Waiting for Parts'
            : ($statusUpdate === 'on_hold' ? 'On Hold' : 'Paused');

        $comment = $pauseReason !== ''
            ? "Technician updated status to {$label}: {$pauseReason}"
            : "Technician updated status to {$label}.";
        $this->logWorkOrderStatusChange($workOrder, $user->id, $oldStatus, 'paused', $comment);

        if ($workOrder->request) {
            $requestCode = $this->requestCode((int) $workOrder->request->id);
            $this->notifyRequester($workOrder, 'request_service_update', "Your maintenance request #{$requestCode} is currently being serviced.");
            $this->notifyRole('supervisor', 'request_paused', 'work_order', $workOrder->request->id, "Request #{$requestCode} status updated to {$label}." . ($pauseReason !== '' ? " Reason: {$pauseReason}" : ''));
        }

        ActivityLogger::log($user->id, 'work_order', 'pause', $workOrder->id, "Work order #{$workOrder->id} paused.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Work order paused.',
            'work_order' => $this->freshWorkOrderDetail($workOrder),
        ]);
    }

    public function reportDelay(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);
        $workOrder = WorkOrder::query()->with('request')->findOrFail($id);

        if (!$user->tokenCan('role:admin') && (int) $workOrder->assigned_to !== (int) $user->id) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'delay_reason' => ['required', 'string', 'max:1000'],
        ]);

        $this->updateWorkOrderSafe($workOrder, [
            'delay_reason' => $validated['delay_reason'],
        ]);

        if ($workOrder->request) {
            $this->notifyRole(
                'supervisor',
                'request_delay_reported',
                'work_order',
                $workOrder->request->id,
                "Delay reported for Request #{$workOrder->request->id}: {$validated['delay_reason']}"
            );
        }

        ActivityLogger::log($user->id, 'work_order', 'report_delay', $workOrder->id, "Delay reported for work order #{$workOrder->id}.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Delay reported to supervisor.',
            'work_order' => $this->freshWorkOrderDetail($workOrder),
        ]);
    }

    public function addProgressNote(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);
        $workOrder = WorkOrder::query()->with('request')->findOrFail($id);

        if (!$user->tokenCan('role:admin') && (int) $workOrder->assigned_to !== (int) $user->id) {
            return $this->forbidden();
        }

        if (!$workOrder->request) {
            return response()->json([
                'success' => false,
                'message' => 'This work order is not linked to a request.',
            ], 422);
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $message = RequestMessage::create([
            'request_id' => $workOrder->request->id,
            'sender_id' => $user->id,
            'message' => $validated['message'],
        ]);

        $this->notifyRole(
            'supervisor',
            'technician_progress_update',
            'work_order',
            $workOrder->request->id,
            "Progress update on Request #{$workOrder->request->id}: {$validated['message']}"
        );

        ActivityLogger::log($user->id, 'work_order', 'progress_update', $workOrder->id, "Progress note added to work order #{$workOrder->id}.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Progress note saved.',
            'data' => $message->load('sender:id,fname,lname,phone'),
        ], 201);
    }

    public function complete(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);
        $workOrder = WorkOrder::query()->with('request')->findOrFail($id);

        if (!$user->tokenCan('role:admin') && (int) $workOrder->assigned_to !== (int) $user->id) {
            return $this->forbidden();
        }

        if ($workOrder->work_status === 'completed') {
            return response()->json([
                'success' => true,
                'message' => 'Work order is already completed.',
                'work_order' => $this->freshWorkOrderDetail($workOrder),
            ]);
        }

        if (!in_array($workOrder->work_status, ['in_progress', 'paused'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only in-progress or paused work orders can be completed.',
            ], 422);
        }

        $validated = $request->validate([
            'completion_note' => ['nullable', 'string', 'max:5000'],
            'problem_found' => ['nullable', 'string', 'max:5000'],
            'action_taken' => ['nullable', 'string', 'max:5000'],
            'delay_reason' => ['nullable', 'string', 'max:1000'],
            'spare_parts' => ['sometimes', 'array'],
            'spare_parts.*.spare_part_id' => ['required', 'integer', 'exists:spare_parts,id'],
            'spare_parts.*.quantity_used' => ['required', 'integer', 'min:1'],
            'image' => ['nullable', 'image', 'max:4096'],
        ]);

        $isOverdue = $workOrder->request?->due_date && now()->greaterThan($workOrder->request->due_date);
        if ($isOverdue && empty($validated['delay_reason'])) {
            return response()->json([
                'success' => false,
                'message' => 'Delay reason is required when completing overdue work.',
            ], 422);
        }

        $oldStatus = $workOrder->work_status;
        $now = now();

        DB::transaction(function () use ($validated, $request, $user, $workOrder, $oldStatus, $now) {
            $seenSpareParts = [];
            foreach ($validated['spare_parts'] ?? [] as $usage) {
                $partId = (int) $usage['spare_part_id'];
                if (isset($seenSpareParts[$partId])) {
                    throw ValidationException::withMessages([
                    'spare_parts' => ['Duplicate spare part entries are not allowed.'],
                ]);
                }
                $seenSpareParts[$partId] = true;

                $part = SparePart::query()->where('id', $partId)->firstOrFail();
                $qty = (int) $usage['quantity_used'];

                WorkOrderSparePart::create([
                    'work_order_id' => $workOrder->id,
                    'spare_part_id' => $part->id,
                    'quantity_used' => $qty,
                    'unit_price' => $part->unit_price,
                    'total_price' => (float) $part->unit_price * $qty,
                ]);

                ActivityLogger::log($user->id, 'inventory', 'record_usage', $part->id, "Recorded {$qty} used for work order #{$workOrder->id}.", $request);
            }

            $this->updateWorkOrderSafe($workOrder, [
                'work_status' => 'completed',
                'completion_note' => $validated['completion_note'] ?? null,
                'problem_found' => $validated['problem_found'] ?? null,
                'action_taken' => $validated['action_taken'] ?? null,
                'delay_reason' => $validated['delay_reason'] ?? $workOrder->delay_reason,
                'completed_by_technician_at' => $now,
                'completed_at' => $now,
                'status_updated_at' => $now,
            ]);

            $this->logWorkOrderStatusChange($workOrder, $user->id, $oldStatus, 'completed', 'Technician submitted completion details.');

            if ($workOrder->request) {
                $oldRequestStatus = $workOrder->request->status;
                if ($oldRequestStatus !== 'completed') {
                    $workOrder->request->update(['status' => 'completed']);
                    RequestStatusLog::create([
                        'request_id' => $workOrder->request->id,
                        'changed_by' => $user->id,
                        'old_status' => $oldRequestStatus,
                        'new_status' => 'completed',
                        'comment' => 'Technician completed work and submitted for supervisor approval.',
                    ]);
                }

                $this->notifyRole(
                    'supervisor',
                    'request_completed',
                    'work_order',
                    $workOrder->request->id,
                    "Technician completed maintenance request #{$this->requestCode((int) $workOrder->request->id)} and waiting requester verification."
                );

                $this->notifyRequester(
                    $workOrder,
                    'request_completion_submitted',
                    "Maintenance request #{$this->requestCode((int) $workOrder->request->id)} has been completed. Please verify and close the request."
                );

                if (!empty($validated['delay_reason'])) {
                    $this->notifyRole(
                        'supervisor',
                        'request_delay_reported',
                        'work_order',
                        $workOrder->request->id,
                        "Delay reported for Request #{$workOrder->request->id}: {$validated['delay_reason']}"
                    );
                }

                if ($request->hasFile('image')) {
                    $path = $request->file('image')->store('request-images', 'public');
                    RequestImage::create([
                        'request_id' => $workOrder->request->id,
                        'image_path' => $path,
                        'uploaded_by' => $user->id,
                    ]);
                }
            }
        });

        ActivityLogger::log($user->id, 'work_order', 'complete', $workOrder->id, "Work order #{$workOrder->id} completed.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Work order completed and sent for requester verification.',
            'work_order' => $this->freshWorkOrderDetail($workOrder),
        ]);
    }

    public function decline(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);
        $workOrder = WorkOrder::query()->with('request')->findOrFail($id);

        if (!$user->tokenCan('role:admin') && (int) $workOrder->assigned_to !== (int) $user->id) {
            return $this->forbidden();
        }

        if ($workOrder->work_status !== 'assigned') {
            return response()->json([
                'success' => false,
                'message' => 'Only newly assigned work orders can be declined.',
            ], 422);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $reason = trim($validated['reason']);
        $now = now();

        $this->updateWorkOrderSafe($workOrder, [
            'assigned_to' => null,
            'work_status' => 'draft',
            'delay_reason' => $reason,
            'status_updated_at' => $now,
        ]);

        if ($workOrder->request) {
            $oldRequestStatus = $workOrder->request->status;
            $workOrder->request->update(['status' => 'approved']);

            RequestStatusLog::create([
                'request_id' => $workOrder->request->id,
                'changed_by' => $user->id,
                'old_status' => $oldRequestStatus,
                'new_status' => 'approved',
                'comment' => "Technician declined assignment. Reassignment required. Reason: {$reason}",
            ]);

            $requestCode = $this->requestCode((int) $workOrder->request->id);
            $this->notifyRole(
                'supervisor',
                'request_reassignment_required',
                'work_order',
                $workOrder->request->id,
                "Technician declined request #{$requestCode} because of {$reason}. Please reassign."
            );
        }

        ActivityLogger::log($user->id, 'work_order', 'decline', $workOrder->id, "Work order #{$workOrder->id} declined by technician.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Assignment declined. Supervisor notified for reassignment.',
            'work_order' => $this->freshWorkOrderDetail($workOrder),
        ]);
    }

    private function logWorkOrderStatusChange(
        WorkOrder $workOrder,
        int $userId,
        ?string $oldStatus,
        string $newStatus,
        ?string $comment = null
    ): void {
        if (!Schema::hasTable('work_order_status_logs')) {
            return;
        }

        WorkOrderStatusLog::create([
            'work_order_id' => $workOrder->id,
            'changed_by' => $userId,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'comment' => $comment,
            'created_at' => now(),
        ]);
    }

    private function notifyRequester(WorkOrder $workOrder, string $type, string $message): void
    {
        $requesterId = (int) ($workOrder->request?->requester_id ?? 0);
        if ($requesterId <= 0) {
            return;
        }

        $this->createNotification($requesterId, 'requester', $type, 'work_order', $workOrder->request?->id ?? $workOrder->id, $message);
    }

    private function notifyRole(string $role, string $type, string $module, int $relatedId, string $message): void
    {
        $users = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', $role))
            ->get(['id']);

        foreach ($users as $user) {
            $this->createNotification($user->id, $role, $type, $module, $relatedId, $message);
        }
    }

    private function updateWorkOrderSafe(WorkOrder $workOrder, array $values): void
    {
        $safeValues = [];
        foreach ($values as $column => $value) {
            if ($this->hasWorkOrderColumn($column)) {
                $safeValues[$column] = $value;
            }
        }

        if (!empty($safeValues)) {
            $workOrder->update($safeValues);
        }
    }

    private function hasWorkOrderColumn(string $column): bool
    {
        if (!array_key_exists($column, $this->workOrderColumnCache)) {
            $this->workOrderColumnCache[$column] = Schema::hasColumn('work_orders', $column);
        }

        return $this->workOrderColumnCache[$column];
    }

    private function workOrderDetailRelations(): array
    {
        $relations = [
            'request:id,title,description,priority,status,due_date,created_at,category_id,building_id,room_id,requester_id',
            'request.category:id,name',
            'request.building:id,name',
            'request.room:id,name',
            'request.requester:id,fname,lname,phone',
            'request.messages' => fn ($q) => $q->whereNull('deleted_at')->with('sender:id,fname,lname')->oldest(),
            'request.images',
            'spareParts.sparePart',
        ];

        if (Schema::hasTable('technician_ratings')) {
            $relations[] = 'request.rating:id,request_id,technician_id,requester_id,rating,comment,created_at';
            $relations[] = 'request.rating.requester:id,fname,lname';
        }

        if (Schema::hasTable('work_order_status_logs')) {
            $relations['statusLogs'] = fn ($q) => $q->with('changedBy:id,fname,lname')->orderByDesc('created_at');
        }

        return $relations;
    }

    private function freshWorkOrderDetail(WorkOrder $workOrder): WorkOrder
    {
        return $workOrder->fresh($this->workOrderDetailRelations()) ?? $workOrder;
    }

    private function completionFreshRelations(): array
    {
        $relations = ['spareParts.sparePart', 'request.images'];
        if (Schema::hasTable('technician_ratings')) {
            $relations[] = 'request.rating';
        }

        return $relations;
    }

    private function createNotification(
        ?int $userId,
        string $role,
        string $type,
        string $module,
        int $relatedId,
        string $message
    ): void {
        if ($userId === null) {
            return;
        }

        $payload = [
            'type' => $type,
            'related_id' => $relatedId,
            'message' => $message,
            'is_read' => false,
        ];

        if (Schema::hasColumn('notifications', 'user_id')) {
            $payload['user_id'] = $userId;
        }
        if (Schema::hasColumn('notifications', 'recipient_role')) {
            $payload['recipient_role'] = $role;
        }
        if (Schema::hasColumn('notifications', 'module')) {
            $payload['module'] = $module;
        }

        UserNotification::create($payload);
    }

    private function requestCode(int $id): string
    {
        return sprintf('REQ-%03d', $id);
    }
}
