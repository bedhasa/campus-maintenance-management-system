<?php

namespace App\Http\Controllers\Api;

use App\Models\MaintenanceRequest;
use App\Models\PartIssue;
use App\Models\RequestImage;
use App\Models\RequestStatusLog;
use App\Models\SparePart;
use App\Models\TechnicianCompletionReport;
use App\Models\TechnicianCompletionReportSparePart;
use App\Models\TechnicianProgressNote;
use App\Models\UserNotification;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderSparePart;
use App\Models\WorkOrderStatusLog;
use App\Services\ActivityLogger;
use App\Support\SimilarCompletionCases;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\QueryException;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TechnicianController extends ModuleController
{
    /** @return list<string> */
    private function probableCauseOptions(): array
    {
        return [
            'Electrical Failure',
            'Wear and Tear',
            'Overheating',
            'Loose Connection',
            'User Error',
            'Environmental Damage',
            'Poor Maintenance',
            'Component Aging',
            'Unknown',
        ];
    }

    private array $workOrderColumnCache = [];

    public function index(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician', 'admin']);
        $validated = $request->validate([
            'status' => ['nullable', 'in:assigned,in_progress,paused,completed,active,open'],
            'filter' => ['nullable', 'in:delayed'],
            'priority' => ['nullable', 'in:low,medium,high,urgent'],
        ]);

        $query = WorkOrder::query()
            ->where('assigned_to', $user->id)
            ->with([
                'request:id,title,description,priority,status,due_date,created_at,category_id,building_id,room_id,custom_location',
                'request.category:id,name',
                'request.building:id,name',
                'request.room:id,name',
            ])
            // Default list is first-come (oldest assigned first).
            ->orderBy('created_at')
            ->orderBy('id');

        if (!empty($validated['status'])) {
            if ($validated['status'] === 'active') {
                $query->whereIn('work_status', ['in_progress', 'paused']);
            } elseif ($validated['status'] === 'open') {
                $query->whereIn('work_status', ['assigned', 'in_progress', 'paused']);
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

        if (!empty($validated['priority'])) {
            $query->whereHas('request', fn ($rq) => $rq->where('priority', $validated['priority']));
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
            'assigned_jobs' => (clone $base)->with([
                'request:id,title,priority,status,due_date,building_id,room_id,custom_location',
                'request.building:id,name',
                'request.room:id,name',
                'spareParts',
            ])->orderBy('created_at')->orderBy('id')->paginate(15),
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

        $detail = $this->freshWorkOrderDetail($workOrder);
        $detail->setAttribute('similar_completion_cases', SimilarCompletionCases::forWorkOrder($detail));

        return response()->json([
            'success' => true,
            'work_order' => $detail,
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

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $note = TechnicianProgressNote::create([
            'work_order_id' => $workOrder->id,
            'technician_id' => $user->id,
            'note' => $validated['message'],
        ]);

        ActivityLogger::log($user->id, 'work_order', 'progress_update', $workOrder->id, "Private reminder added to work order #{$workOrder->id}.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Reminder saved.',
            'data' => $note->fresh(),
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
            $detail = $this->freshWorkOrderDetail($workOrder);
            $detail->setAttribute('similar_completion_cases', SimilarCompletionCases::forWorkOrder($detail));

            return response()->json([
                'success' => true,
                'message' => 'Work order is already completed.',
                'work_order' => $detail,
            ]);
        }

        if (!in_array($workOrder->work_status, ['in_progress', 'paused'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only in-progress or paused work orders can be completed.',
            ], 422);
        }

        $rawSteps = $request->input('diagnostic_steps');
        if (is_string($rawSteps)) {
            $decoded = json_decode($rawSteps, true);
            $rawSteps = is_array($decoded) ? $decoded : [];
        }
        if (!is_array($rawSteps)) {
            $rawSteps = [];
        }
        $request->merge(['diagnostic_steps' => $rawSteps]);

        $validated = $request->validate([
            'resolution_summary' => ['nullable', 'string', 'max:2000'],
            'completion_note' => ['nullable', 'string', 'max:5000'],
            'problem_found' => ['required', 'string', 'max:5000'],
            'probable_cause' => ['required', Rule::in($this->probableCauseOptions())],
            'probable_cause_custom' => ['nullable', 'string', 'max:500'],
            'diagnostic_steps' => ['required', 'array', 'min:1'],
            'diagnostic_steps.*' => ['required', 'string', 'max:2000'],
            'action_taken' => ['required', 'string', 'max:5000'],
            'downtime_hours' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'delay_reason' => ['nullable', 'string', 'max:1000'],
            'spare_parts' => ['sometimes', 'array'],
            'spare_parts.*.spare_part_id' => ['required', 'integer', 'exists:spare_parts,id'],
            'spare_parts.*.quantity_used' => ['required', 'integer', 'min:1'],
            'spare_parts.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
            'image' => ['nullable', 'image', 'max:4096'],
            'images' => ['sometimes', 'array', 'max:10'],
            'images.*' => ['image', 'max:4096'],
        ]);

        $resolutionSummary = trim((string) ($validated['resolution_summary'] ?? ''));
        if ($resolutionSummary === '') {
            $resolutionSummary = trim((string) ($validated['completion_note'] ?? ''));
        }
        if ($resolutionSummary === '') {
            throw ValidationException::withMessages([
                'resolution_summary' => ['Please provide a resolution summary (short summary of the repair).'],
            ]);
        }

        $completionNoteColumn = $resolutionSummary;

        $resolvedDelayReason = trim((string) ($validated['delay_reason'] ?? $workOrder->delay_reason ?? ''));

        $isOverdue = $workOrder->request?->due_date && now()->greaterThan($workOrder->request->due_date);
        if ($isOverdue && $resolvedDelayReason === '') {
            return response()->json([
                'success' => false,
                'message' => 'Please save a delay reason before completing overdue work.',
            ], 422);
        }

        $oldStatus = $workOrder->work_status;
        $now = now();

        $requestAnchor = $workOrder->request?->created_at ?? $workOrder->created_at;
        $computedDowntime = round(Carbon::parse($requestAnchor)->diffInMinutes($now) / 60, 2);
        $downtimeHours = isset($validated['downtime_hours']) && $validated['downtime_hours'] !== null
            ? (float) $validated['downtime_hours']
            : $computedDowntime;

        $issueReportedSnapshot = null;
        if ($workOrder->request) {
            $t = trim((string) $workOrder->request->title);
            $d = trim((string) $workOrder->request->description);
            $issueReportedSnapshot = trim($t.(($t !== '' && $d !== '') ? "\n\n" : '').$d);
        }

        DB::transaction(function () use ($validated, $request, $user, $workOrder, $oldStatus, $now, $resolvedDelayReason, $resolutionSummary, $completionNoteColumn, $issueReportedSnapshot, $downtimeHours) {
            $report = TechnicianCompletionReport::updateOrCreate(
                ['work_order_id' => $workOrder->id],
                [
                    'technician_id' => $user->id,
                    'issue_reported' => $issueReportedSnapshot,
                    'completion_note' => $completionNoteColumn,
                    'resolution_summary' => $resolutionSummary,
                    'problem_found' => $validated['problem_found'] ?? null,
                    'probable_cause' => $validated['probable_cause'],
                    'probable_cause_custom' => isset($validated['probable_cause_custom'])
                        ? trim((string) $validated['probable_cause_custom']) ?: null
                        : null,
                    'diagnostic_steps' => $validated['diagnostic_steps'],
                    'action_taken' => $validated['action_taken'] ?? null,
                    'downtime_hours' => $downtimeHours,
                    'delay_reason' => $resolvedDelayReason !== '' ? $resolvedDelayReason : null,
                    'submitted_at' => $now,
                ]
            );

            $attachmentPaths = is_array($report->attachment_paths) ? $report->attachment_paths : [];

            if ($request->hasFile('images')) {
                foreach ($request->file('images') as $file) {
                    if ($file && $file->isValid()) {
                        $attachmentPaths[] = $file->store('request-images', 'public');
                    }
                }
            }

            if ($request->hasFile('image')) {
                $attachmentPaths[] = $request->file('image')->store('request-images', 'public');
            }

            $attachmentPaths = array_values(array_unique($attachmentPaths));
            $primaryImage = $attachmentPaths[0] ?? null;

            $report->update([
                'attachment_paths' => $attachmentPaths !== [] ? $attachmentPaths : null,
                'image_path' => $primaryImage ?? $report->image_path,
            ]);

            TechnicianCompletionReportSparePart::query()
                ->where('completion_report_id', $report->id)
                ->delete();

            $seenSpareParts = [];

            foreach ($validated['spare_parts'] ?? [] as $usage) {
                $partId = (int) $usage['spare_part_id'];
                if (isset($seenSpareParts[$partId])) {
                    throw ValidationException::withMessages([
                        'spare_parts' => ['Duplicate spare part entries are not allowed.'],
                    ]);
                }
                $seenSpareParts[$partId] = true;

                $part = SparePart::query()->findOrFail($partId);
                $qty = (int) $usage['quantity_used'];

                $unitPrice = (float) ($part->unit_price ?? 0);
                $totalPrice = $unitPrice * $qty;

                WorkOrderSparePart::create([
                    'work_order_id' => $workOrder->id,
                    'spare_part_id' => $part->id,
                    'quantity_used' => $qty,
                    'unit_price' => $unitPrice,
                    'total_price' => $totalPrice,
                ]);

                TechnicianCompletionReportSparePart::create([
                    'completion_report_id' => $report->id,
                    'work_order_id' => $workOrder->id,
                    'technician_id' => $user->id,
                    'spare_part_id' => $part->id,
                    'quantity_used' => $qty,
                    'unit_price' => $unitPrice,
                    'total_price' => $totalPrice,
                ]);

                ActivityLogger::log($user->id, 'inventory', 'record_usage', $part->id, "Recorded {$qty} used for work order #{$workOrder->id}.", $request);
            }

            $this->updateWorkOrderSafe($workOrder, [
                'work_status' => 'completed',
                'completion_note' => $completionNoteColumn,
                'problem_found' => $validated['problem_found'] ?? null,
                'action_taken' => $validated['action_taken'] ?? null,
                'delay_reason' => $resolvedDelayReason !== '' ? $resolvedDelayReason : $workOrder->delay_reason,
                'completed_by_technician_at' => $now,
                'completed_at' => $now,
                'status_updated_at' => $now,
            ]);

            $this->logWorkOrderStatusChange($workOrder, $user->id, $oldStatus, 'completed', 'Technician submitted completion details.');

            $report->refresh();

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

                if ($resolvedDelayReason !== '') {
                    $this->notifyRole(
                        'supervisor',
                        'request_delay_reported',
                        'work_order',
                        $workOrder->request->id,
                        "Delay reported for Request #{$workOrder->request->id}: {$resolvedDelayReason}"
                    );
                }

                $pathsForRequest = array_filter(array_merge(
                    is_array($report->attachment_paths) ? $report->attachment_paths : [],
                    $report->image_path && !in_array($report->image_path, is_array($report->attachment_paths) ? $report->attachment_paths : [], true)
                        ? [$report->image_path]
                        : []
                ));

                foreach (array_unique($pathsForRequest) as $path) {
                    RequestImage::create([
                        'request_id' => $workOrder->request->id,
                        'image_path' => $path,
                        'uploaded_by' => $user->id,
                    ]);
                }
            }
        });

        ActivityLogger::log($user->id, 'work_order', 'complete', $workOrder->id, "Work order #{$workOrder->id} completed.", $request);

        $detail = $this->freshWorkOrderDetail($workOrder);
        $detail->setAttribute('similar_completion_cases', SimilarCompletionCases::forWorkOrder($detail));

        return response()->json([
            'success' => true,
            'message' => 'Work order completed and sent for requester verification.',
            'work_order' => $detail,
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
            'request:id,title,description,priority,status,due_date,created_at,category_id,asset_id,building_id,room_id,requester_id',
            'request.category:id,name',
            'request.building:id,name',
            'request.room:id,name',
            'request.requester:id,fname,lname,phone',
            'request.images',
            'request.statusLogs' => fn ($q) => $q->with('changedBy:id,fname,lname')->orderByDesc('created_at'),
            'spareParts.sparePart',
            'technicianProgressNotes' => fn ($q) => $q->orderBy('created_at'),
            'technicianCompletionReport.spareParts.sparePart',
            'technicianCompletionReport.technician:id,fname,lname',
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
