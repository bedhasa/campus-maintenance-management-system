<?php

namespace App\Http\Controllers\Api;

use App\Models\MaintenanceRequest;
use App\Models\PreventiveMaintenancePlan;
use App\Models\RequestMessage;
use App\Models\RequestStatusLog;
use App\Models\Asset;
use App\Models\Building;
use App\Models\Category;
use App\Models\Department;
use App\Models\PartIssue;
use App\Support\SimilarCompletionCases;
use App\Models\SparePart;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\WorkOrder;
use App\Models\WorkOrderSparePart;
use App\Models\WorkOrderStatusLog;
use App\Services\ActivityLogger;
use App\Support\SlaResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class SupervisorController extends ModuleController
{
    public function dashboard(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $now = now();

        $base = MaintenanceRequest::query();

        $summary = [
            'new_requests' => (clone $base)->where('status', 'submitted')->count(),
            'approved_pending_assignment' => (clone $base)->where('status', 'approved')->doesntHave('workOrders')->count(),
            'in_progress' => (clone $base)->whereIn('status', ['assigned', 'in_progress'])->count(),
            'completed_waiting_closure' => (clone $base)->where('status', 'completed')->count(),
            'overdue' => (clone $base)
                ->whereNotIn('status', ['completed', 'closed'])
                ->whereNotNull('due_date')
                ->where('due_date', '<', $now)
                ->count(),
        ];

        $upcomingPm = PreventiveMaintenancePlan::query()
            ->where('status', 'active')
            ->whereBetween('next_due_date', [$now->toDateString(), $now->copy()->addDays(7)->toDateString()])
            ->with(['asset:id,name', 'category:id,name', 'assignee:id,fname,lname'])
            ->orderBy('next_due_date')
            ->limit(20)
            ->get();

        $overduePm = PreventiveMaintenancePlan::query()
            ->where('status', 'active')
            ->whereDate('next_due_date', '<', $now->toDateString())
            ->whereDoesntHave('logs', fn ($q) => $q->whereHas('workOrder', fn ($wq) => $wq->whereIn('work_status', ['draft', 'assigned', 'in_progress'])))
            ->with(['asset:id,name', 'category:id,name', 'assignee:id,fname,lname'])
            ->orderBy('next_due_date')
            ->limit(20)
            ->get();

        $workload = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'technician'))
            ->with(['specialties:id,name'])
            ->withCount([
                'assignedWorkOrders as open_work_orders' => fn ($q) => $q->whereIn('work_status', ['assigned', 'in_progress']),
                'assignedWorkOrders as in_progress_work_orders' => fn ($q) => $q->where('work_status', 'in_progress'),
                'assignedWorkOrders as assigned_work_orders' => fn ($q) => $q->where('work_status', 'assigned'),
                'assignedWorkOrders as completed_work_orders' => fn ($q) => $q->where('work_status', 'completed'),
            ])
            ->orderBy('open_work_orders', 'desc')
            ->limit(30)
            ->get(['id', 'fname', 'lname', 'phone', 'email', 'profile_picture', 'avg_rating', 'total_ratings'])
            ->map(function ($tech) {
                $profileUrl = null;
                if (!empty($tech->profile_picture)) {
                    $url = Storage::disk('public')->url($tech->profile_picture);
                    $profileUrl = str_starts_with($url, 'http') ? $url : url($url);
                }

                return [
                    'id' => $tech->id,
                    'fname' => $tech->fname,
                    'lname' => $tech->lname,
                    'phone' => $tech->phone,
                    'email' => $tech->email,
                    'profile_picture_url' => $profileUrl,
                    'avg_rating' => (float) $tech->avg_rating,
                    'total_ratings' => (int) $tech->total_ratings,
                    'open_work_orders' => (int) $tech->open_work_orders,
                    'assigned_work_orders' => (int) $tech->assigned_work_orders,
                    'in_progress_work_orders' => (int) $tech->in_progress_work_orders,
                    'completed_work_orders' => (int) $tech->completed_work_orders,
                    'active_jobs' => (int) $tech->open_work_orders,
                    'overdue_jobs' => (int) WorkOrder::query()
                        ->where('assigned_to', $tech->id)
                        ->whereIn('work_status', ['assigned', 'in_progress'])
                        ->whereHas('request', fn ($rq) => $rq->whereNotNull('due_date')->where('due_date', '<', now())->whereNotIn('status', ['completed', 'closed']))
                        ->count(),
                    'specialties' => $tech->specialties->pluck('name')->values(),
                ];
            })
            ->values();

        $notifications = UserNotification::query()
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                    ->orWhere(function ($inner) {
                        $inner->whereNull('user_id')
                            ->where('recipient_role', 'supervisor');
                    });
            })
            ->latest()
            ->limit(15)
            ->get();

        $recentRequests = MaintenanceRequest::query()
            ->with([
                'requester:id,fname,lname,phone,email',
                'department:id,name',
                'category:id,name',
                'building:id,name',
                'room:id,name',
            ])
            ->latest()
            ->limit(10)
            ->get();

        $issuesByCategory = MaintenanceRequest::query()
            ->select('category_id', DB::raw('COUNT(*) as total'))
            ->groupBy('category_id')
            ->with('category:id,name')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'name' => $row->category?->name ?? 'Unknown',
                'total' => (int) $row->total,
            ]);

        $overdueWorkOrders = WorkOrder::query()
            ->whereIn('work_status', ['assigned', 'in_progress'])
            ->whereHas('request', fn ($rq) => $rq
                ->whereNotNull('due_date')
                ->where('due_date', '<', now())
                ->whereNotIn('status', ['completed', 'closed']))
            ->with(['request:id,title,priority,due_date', 'assignee:id,fname,lname'])
            ->orderByDesc(
                MaintenanceRequest::query()
                    ->select('due_date')
                    ->whereColumn('maintenance_requests.id', 'work_orders.request_id')
            )
            ->limit(5)
            ->get()
            ->map(function ($wo) {
                $dueDate = $wo->request?->due_date;
                $daysLate = $dueDate ? (int) Carbon::parse($dueDate)->diffInDays(now()) : 0;
                return [
                    'id' => $wo->id,
                    'title' => $wo->request?->title ?? 'Manual Work Order',
                    'technician' => trim(($wo->assignee?->fname ?? '') . ' ' . ($wo->assignee?->lname ?? '')),
                    'days_late' => $daysLate,
                    'priority' => $wo->priority,
                ];
            });

        $lateCompletionReports = WorkOrder::query()
            ->whereNotNull('delay_reason')
            ->with(['request:id,title', 'assignee:id,fname,lname'])
            ->latest('completed_at')
            ->limit(5)
            ->get()
            ->map(fn ($wo) => [
                'id' => $wo->id,
                'title' => $wo->request?->title ?? 'Manual Work Order',
                'technician' => trim(($wo->assignee?->fname ?? '') . ' ' . ($wo->assignee?->lname ?? '')),
                'delay_reason' => $wo->delay_reason,
            ]);

        return response()->json([
            'success' => true,
            'summary' => $summary,
            'upcoming_pm' => $upcomingPm,
            'overdue_pm' => $overduePm,
            'pm_overview' => [
                'upcoming_this_week' => $upcomingPm->count(),
                'overdue_preventive' => $overduePm->count(),
            ],
            'technician_workload' => $workload,
            'notifications' => $notifications,
            'issues_by_category' => $issuesByCategory,
            'recent_requests' => $recentRequests,
            'urgent_alerts' => [
                'overdue_work_orders' => $overdueWorkOrders,
                'late_completion_reports' => $lateCompletionReports,
            ],
        ]);
    }

    public function requests(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);
        $validated = $request->validate([
            'status' => ['nullable', 'string'],
            'priority' => ['nullable', 'in:low,medium,high,urgent'],
            'search' => ['nullable', 'string', 'max:150'],
        ]);

        $query = MaintenanceRequest::query()
            ->with([
                'requester:id,fname,lname,phone',
                'category:id,name',
                'building:id,name',
                'department:id,name',
                'messages' => fn ($q) => $q->whereNull('deleted_at')->with('sender:id,fname,lname')->latest(),
                'images',
                'statusLogs' => fn ($q) => $q->with('changedBy:id,fname,lname')->latest(),
            ])
            ->latest();

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }
        if (!empty($validated['priority'])) {
            $query->where('priority', $validated['priority']);
        }
        if (!empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        return response()->json([
            'success' => true,
            'requests' => $query->paginate(15),
        ]);
    }

    public function showRequest(Request $request, int $id): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $ticket = MaintenanceRequest::query()
            ->with([
                'requester:id,fname,lname,phone,email,profile_picture',
                'department:id,name',
                'category:id,name',
                'building:id,name',
                'room:id,name',
                'asset:id,name',
                'messages' => fn ($q) => $q->whereNull('deleted_at')->with('sender:id,fname,lname,phone')->orderBy('created_at'),
                'images',
                'statusLogs' => fn ($q) => $q->with('changedBy:id,fname,lname,phone')->orderBy('created_at'),
                'workOrders' => fn ($q) => $q
                    ->with('assignee:id,fname,lname,phone,email,profile_picture')
                    ->orderByDesc('id'),
                'rating' => fn ($q) => $q->with('requester:id,fname,lname,profile_picture'),
            ])
            ->findOrFail($id);

        if ($ticket->requester) {
            $ticket->requester->setAttribute('profile_picture_url', $this->profilePictureUrl($ticket->requester->profile_picture));
        }
        foreach ($ticket->workOrders as $workOrder) {
            if ($workOrder->assignee) {
                $workOrder->assignee->setAttribute('profile_picture_url', $this->profilePictureUrl($workOrder->assignee->profile_picture));
            }
        }
        if ($ticket->rating?->requester) {
            $ticket->rating->requester->setAttribute('profile_picture_url', $this->profilePictureUrl($ticket->rating->requester->profile_picture));
        }

        return response()->json([
            'success' => true,
            'request' => $ticket,
        ]);
    }

    public function addRequestMessage(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $ticket = MaintenanceRequest::query()->findOrFail($id);
        if ($ticket->status === 'closed') {
            return response()->json([
                'success' => false,
                'message' => 'Chat is locked after request closure.',
            ], 422);
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $message = RequestMessage::create([
            'request_id' => $ticket->id,
            'sender_id' => $user->id,
            'message' => $validated['message'],
        ]);

        $this->notifyRequester(
            $ticket,
            'chat_message',
            "New chat message on Request #{$ticket->id}.",
            'chat'
        );

        ActivityLogger::log($user->id, 'chat', 'add_message', $message->id, "Supervisor message added on request #{$ticket->id}.", $request);

        return response()->json([
            'success' => true,
            'data' => $message->load('sender:id,fname,lname,phone'),
        ], 201);
    }

    public function updateRequestMessage(Request $request, int $id, int $messageId): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $ticket = MaintenanceRequest::query()->findOrFail($id);
        if ($ticket->status === 'closed') {
            return response()->json([
                'success' => false,
                'message' => 'Chat is locked after request closure.',
            ], 422);
        }

        $message = RequestMessage::query()->where('request_id', $ticket->id)->findOrFail($messageId);
        if ((int) $message->sender_id !== (int) $user->id) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $message->update([
            'message' => $validated['message'],
            'edited_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $message->fresh()->load('sender:id,fname,lname,phone'),
        ]);
    }

    public function deleteRequestMessage(Request $request, int $id, int $messageId): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $ticket = MaintenanceRequest::query()->findOrFail($id);
        if ($ticket->status === 'closed') {
            return response()->json([
                'success' => false,
                'message' => 'Chat is locked after request closure.',
            ], 422);
        }

        $message = RequestMessage::query()->where('request_id', $ticket->id)->findOrFail($messageId);
        if ((int) $message->sender_id !== (int) $user->id) {
            return $this->forbidden();
        }

        $message->update(['deleted_at' => now()]);
        ActivityLogger::log($user->id, 'chat', 'chat_delete', $message->id, "Supervisor soft-deleted message on request #{$ticket->id}.", $request);

        return response()->json(['success' => true]);
    }

    public function workOrders(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);
        $validated = $request->validate([
            'status' => ['nullable', 'in:assigned,in_progress,completed,draft'],
            'filter' => ['nullable', 'in:overdue'],
        ]);

        $query = WorkOrder::query()
            ->with(['request:id,title,status,due_date,department_id', 'request.department:id,name', 'assignee:id,fname,lname,phone,email'])
            ->latest();

        if (!empty($validated['status'])) {
            if ($validated['status'] === 'in_progress') {
                $query->whereIn('work_status', ['assigned', 'in_progress']);
            } else {
                $query->where('work_status', $validated['status']);
            }
        }

        if (($validated['filter'] ?? null) === 'overdue') {
            $query->whereHas('request', fn ($rq) => $rq
                ->whereNotNull('due_date')
                ->where('due_date', '<', now())
                ->whereNotIn('status', ['completed', 'closed']));
        }

        $workOrders = $query->paginate(15);
        $workOrders->getCollection()->transform(function ($wo) {
            $dueDate = $wo->request?->due_date;
            $wo->days_late = $dueDate ? (int) Carbon::parse($dueDate)->diffInDays(now()) : 0;
            return $wo;
        });

        return response()->json([
            'success' => true,
            'work_orders' => $workOrders,
        ]);
    }

    public function showWorkOrder(Request $request, int $id): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);
        $workOrder = WorkOrder::query()
            ->with([
                'request:id,title,description,status,priority,due_date,building_id,room_id,asset_id,category_id,requester_id',
                'request.building:id,name',
                'request.room:id,name',
                'request.asset:id,name',
                'request.category:id,name',
                'request.requester:id,fname,lname,phone,email,profile_picture',
                'assignee:id,fname,lname,phone,email',
                'spareParts.sparePart',
                'technicianCompletionReport.spareParts.sparePart',
                'technicianCompletionReport.technician:id,fname,lname',
                'statusLogs' => fn ($q) => $q->with('changedBy:id,fname,lname')->orderByDesc('created_at'),
            ])
            ->findOrFail($id);

        if ($workOrder->request?->requester) {
            $workOrder->request->requester->setAttribute(
                'profile_picture_url',
                $this->profilePictureUrl($workOrder->request->requester->profile_picture)
            );
        }

        $workOrder->setAttribute('similar_completion_cases', SimilarCompletionCases::forWorkOrder($workOrder));

        return response()->json([
            'success' => true,
            'work_order' => $workOrder,
        ]);
    }

    public function reassignWorkOrder(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $workOrder = WorkOrder::query()->with('request')->findOrFail($id);

        if (!in_array($workOrder->work_status, ['draft', 'assigned', 'in_progress'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only draft/assigned/in-progress work orders can be reassigned.',
            ], 422);
        }

        $validated = $request->validate([
            'assigned_to' => ['required', 'integer', 'exists:users,id'],
            'start_date' => ['nullable', 'date'],
            'finish_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'due_date' => ['nullable', 'date'],
            'scheduled_time' => ['nullable', 'date_format:H:i'],
            'priority' => ['nullable', 'in:low,medium,high,urgent'],
        ]);

        $technician = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'technician'))
            ->findOrFail((int) $validated['assigned_to']);

        $previousAssigneeId = $workOrder->assigned_to ? (int) $workOrder->assigned_to : null;
        $newAssigneeId = (int) $technician->id;
        if ($previousAssigneeId === $newAssigneeId) {
            return response()->json([
                'success' => false,
                'message' => 'This technician is already assigned.',
            ], 422);
        }

        $startDate = $validated['start_date'] ?? $workOrder->scheduled_date;
        $finishDate = $validated['finish_date'] ?? null;

        $workOrder->update([
            'assigned_to' => $newAssigneeId,
            'priority' => $validated['priority'] ?? $workOrder->priority,
            'scheduled_date' => $startDate,
            'scheduled_time' => $validated['scheduled_time'] ?? $workOrder->scheduled_time,
            'work_status' => 'assigned',
        ]);

        if ($workOrder->request) {
            $requestTicket = $workOrder->request;
            $oldStatus = $requestTicket->status;
            $requestTicket->update([
                'status' => 'assigned',
                'priority' => $validated['priority'] ?? $requestTicket->priority,
                'due_date' => $validated['due_date'] ?? $finishDate ?? $requestTicket->due_date,
            ]);

            RequestStatusLog::create([
                'request_id' => $requestTicket->id,
                'changed_by' => $user->id,
                'old_status' => $oldStatus,
                'new_status' => 'assigned',
                'comment' => "Reassigned from technician #{$previousAssigneeId} to #{$newAssigneeId}.",
            ]);

            if ($requestTicket->requester_id) {
                $this->notifyRequester(
                    $requestTicket,
                    'request_reassigned',
                    "Your maintenance request #{$this->requestCode($requestTicket->id)} has been reassigned to a technician.",
                    'request'
                );
            }
        }

        if ($previousAssigneeId) {
            $this->notifyTechnician(
                $previousAssigneeId,
                'work_order_reassigned',
                "Work order #{$workOrder->id} has been reassigned to another technician.",
                $workOrder->request_id ?? $workOrder->id
            );
        }

        $this->notifyTechnician(
            $newAssigneeId,
            'work_order_assigned',
            "You have been assigned work order #{$workOrder->id}.",
            $workOrder->request_id ?? $workOrder->id
        );

        ActivityLogger::log(
            $user->id,
            'assignment',
            'reassign_work_order',
            $workOrder->id,
            "Work order #{$workOrder->id} reassigned to technician #{$newAssigneeId}.",
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Work order reassigned.',
            'work_order' => $workOrder->fresh(['assignee:id,fname,lname,phone,email']),
        ]);
    }

    public function closeManualWorkOrder(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $workOrder = WorkOrder::query()->findOrFail($id);

        if ($workOrder->request_id !== null) {
            return response()->json([
                'success' => false,
                'message' => 'Linked request work orders must be closed from the maintenance request.',
            ], 422);
        }

        if ($workOrder->work_status !== 'completed') {
            return response()->json([
                'success' => false,
                'message' => 'Only completed manual work orders can be closed.',
            ], 422);
        }

        $workOrder->update([
            'status_updated_at' => now(),
        ]);

        if (Schema::hasTable('work_order_status_logs')) {
            WorkOrderStatusLog::create([
                'work_order_id' => $workOrder->id,
                'changed_by' => $user->id,
                'old_status' => $workOrder->work_status,
                'new_status' => $workOrder->work_status,
                'comment' => 'Manual work order approved and closed by supervisor.',
            ]);
        }

        ActivityLogger::log($user->id, 'work_order', 'close', $workOrder->id, "Manual work order #{$workOrder->id} closed.", $request);

        if ($workOrder->assigned_to) {
            $this->notifyTechnician(
                (int) $workOrder->assigned_to,
                'work_order_closed',
                "Manual work order #{$workOrder->id} has been approved and closed by the supervisor.",
                $workOrder->id
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Manual work order closed.',
            'work_order' => $workOrder->fresh([
                'assignee:id,fname,lname,phone,email',
                'statusLogs' => fn ($q) => $q->with('changedBy:id,fname,lname')->orderByDesc('created_at'),
            ]),
        ]);
    }

    public function technicianProfile(Request $request, int $id): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);
        $tech = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'technician'))
            ->with(['specialties:id,name,category_id'])
            ->withCount([
                'assignedWorkOrders as active_jobs' => fn ($q) => $q->whereIn('work_status', ['assigned', 'in_progress']),
                'assignedWorkOrders as completed_jobs' => fn ($q) => $q->where('work_status', 'completed'),
                'assignedWorkOrders as overdue_jobs' => fn ($q) => $q
                    ->whereIn('work_status', ['assigned', 'in_progress'])
                    ->whereHas('request', fn ($rq) => $rq->whereNotNull('due_date')->where('due_date', '<', now())->whereNotIn('status', ['completed', 'closed'])),
            ])
            ->findOrFail($id);

        $history = WorkOrder::query()
            ->where('assigned_to', $tech->id)
            ->with('request:id,title,status')
            ->latest()
            ->limit(20)
            ->get(['id', 'request_id', 'work_status', 'completed_at', 'created_at']);

        $totalHandled = (int) $tech->active_jobs + (int) $tech->completed_jobs;
        $completionRate = $totalHandled > 0 ? round(((int) $tech->completed_jobs / $totalHandled) * 100, 2) : 0;

        return response()->json([
            'success' => true,
            'technician' => [
                'id' => $tech->id,
                'name' => trim($tech->fname . ' ' . $tech->lname),
                'fname' => $tech->fname,
                'lname' => $tech->lname,
                'phone' => $tech->phone,
                'email' => $tech->email,
                'avg_rating' => (float) $tech->avg_rating,
                'total_ratings' => (int) $tech->total_ratings,
                'active_jobs' => (int) $tech->active_jobs,
                'completed_jobs' => (int) $tech->completed_jobs,
                'overdue_jobs' => (int) $tech->overdue_jobs,
                'completion_rate' => $completionRate,
                'specialties' => $tech->specialties->map(fn ($s) => ['id' => $s->id, 'name' => $s->name])->values(),
                'history' => $history,
            ],
        ]);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $ticket = MaintenanceRequest::query()->findOrFail($id);
        $oldStatus = $ticket->status;

        $validated = $request->validate([
            'action' => ['required', 'in:approve,reject'],
            'priority' => ['nullable', 'in:low,medium,high,urgent'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        if (!in_array($ticket->status, ['submitted', 'rejected'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only pending or rejected requests can be reviewed.',
            ], 422);
        }

        if ($validated['action'] === 'reject' && empty(trim((string) ($validated['comment'] ?? '')))) {
            return response()->json([
                'success' => false,
                'message' => 'Rejection reason is required.',
            ], 422);
        }

        $priority = $validated['priority'] ?? $ticket->priority;
        $updates = ['priority' => $priority];
        $newStatus = $validated['action'] === 'approve' ? 'approved' : 'rejected';
        $updates['status'] = $newStatus;

        if ($newStatus === 'approved') {
            $slaHours = SlaResolver::hoursForPriority($priority);
            $updates['sla_hours'] = $slaHours;
            $updates['due_date'] = now()->addHours($slaHours);
        }

        $ticket->update($updates);

        RequestStatusLog::create([
            'request_id' => $ticket->id,
            'changed_by' => $user->id,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'comment' => $validated['comment'] ?? ($newStatus === 'approved' ? 'Request approved.' : 'Request rejected.'),
        ]);

        ActivityLogger::log(
            $user->id,
            'request_review',
            $newStatus === 'approved' ? 'approve' : 'reject',
            $ticket->id,
            "Request #{$ticket->id} {$newStatus} by {$user->fname}.",
            $request
        );

        $this->notifyRequester(
            $ticket,
            $newStatus === 'approved' ? 'request_approved' : 'request_rejected',
            $newStatus === 'approved'
                ? "Maintenance request #{$this->requestCode($ticket->id)} has been approved and is waiting technician assignment."
                : "Your maintenance request #{$this->requestCode($ticket->id)} has been rejected. Reason: " . ($validated['comment'] ?? 'No reason provided.') . " Please try again with complete and clear info.",
            'request'
        );

        return response()->json([
            'success' => true,
            'message' => "Request {$newStatus}.",
            'request' => $ticket->fresh(),
        ]);
    }

    public function undoReview(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $ticket = MaintenanceRequest::query()->findOrFail($id);

        if (!in_array($ticket->status, ['approved', 'rejected'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only approved or rejected requests can be undone.',
            ], 422);
        }

        if ($ticket->status === 'approved' && $ticket->workOrders()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Review cannot be undone after assignment has started.',
            ], 422);
        }

        $oldStatus = $ticket->status;
        $undoPayload = ['status' => 'submitted'];
        if (Schema::hasColumn('maintenance_requests', 'due_date')) {
            $undoPayload['due_date'] = null;
        }
        if (Schema::hasColumn('maintenance_requests', 'sla_hours')) {
            $undoPayload['sla_hours'] = null;
        }
        $ticket->update($undoPayload);

        RequestStatusLog::create([
            'request_id' => $ticket->id,
            'changed_by' => $user->id,
            'old_status' => $oldStatus,
            'new_status' => 'submitted',
            'comment' => 'Supervisor undid the previous review decision.',
        ]);

        ActivityLogger::log(
            $user->id,
            'request_review',
            'undo',
            $ticket->id,
            "Review decision undone for request #{$ticket->id}.",
            $request
        );

        $this->notifyRequester(
            $ticket,
            'request_review_undone',
            "Supervisor reopened request #{$this->requestCode($ticket->id)} for fresh review.",
            'request'
        );

        return response()->json([
            'success' => true,
            'message' => 'Review decision undone. Request is pending again.',
            'request' => $ticket->fresh(),
        ]);
    }

    public function techniciansForCategory(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);
        $validated = $request->validate([
            'category_id' => ['required', 'integer', 'exists:categories,id'],
        ]);

        $supportsSpecialties = Schema::hasTable('specialties') && Schema::hasTable('technician_specialties');
        $base = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'technician'))
            ->withCount([
                'assignedWorkOrders as open_workload' => fn ($q) => $q->whereIn('work_status', ['assigned', 'in_progress']),
            ]);

        if ($supportsSpecialties) {
            $base->whereHas('specialties', fn ($q) => $q->where('category_id', $validated['category_id']))
                ->with(['specialties:id,name,category_id']);
        }

        $technicians = $base
            ->get(['id', 'fname', 'lname', 'phone', 'avg_rating', 'total_ratings', 'is_active'])
            ->map(function ($tech) {
                $tech->availability = $tech->is_active && $tech->open_workload < 8;
                return $tech;
            });

        return response()->json([
            'success' => true,
            'technicians' => $technicians,
        ]);
    }

    public function assign(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $ticket = MaintenanceRequest::query()->findOrFail($id);

        if (!in_array($ticket->status, ['approved', 'assigned', 'in_progress'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Assignment is allowed for approved or assigned requests.',
            ], 422);
        }

        $validated = $request->validate([
            'assigned_to' => ['required', 'integer', 'exists:users,id'],
            'start_date' => ['nullable', 'date'],
            'finish_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'due_date' => ['nullable', 'date'],
            'scheduled_date' => ['nullable', 'date'],
            'scheduled_time' => ['nullable', 'date_format:H:i'],
            'estimated_hours' => ['nullable', 'numeric', 'min:0.25'],
            'priority' => ['nullable', 'in:low,medium,high,urgent'],
        ]);

        $supportsSpecialties = Schema::hasTable('specialties') && Schema::hasTable('technician_specialties');
        $technicianBase = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'technician'));
        if ($supportsSpecialties) {
            $technicianBase->with('specialties:id,category_id');
        }
        $technician = $technicianBase->findOrFail($validated['assigned_to']);

        if ($supportsSpecialties && $ticket->category_id) {
            $categoryId = (int) $ticket->category_id;
            $specialtyCategoryIds = $technician->specialties->pluck('category_id')->map(fn ($v) => (int) $v)->all();
            if (!empty($specialtyCategoryIds) && !in_array($categoryId, $specialtyCategoryIds, true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Technician is not specialized for this category.',
                ], 422);
            }
        }

        $existingWorkOrder = WorkOrder::query()->where('request_id', $ticket->id)->first();
        $previousAssigneeId = $existingWorkOrder?->assigned_to ? (int) $existingWorkOrder->assigned_to : null;
        $targetAssigneeId = (int) $validated['assigned_to'];
        $isReassignment = $previousAssigneeId !== null && $previousAssigneeId !== $targetAssigneeId;
        $startDate = $validated['start_date'] ?? $validated['scheduled_date'] ?? null;
        $finishDate = $validated['finish_date'] ?? null;
        $priority = $validated['priority'] ?? $ticket->priority;

        $workOrder = WorkOrder::query()->updateOrCreate(
            ['request_id' => $ticket->id],
            [
                'created_by' => $user->id,
                'assigned_to' => $targetAssigneeId,
                'priority' => $priority,
                'scheduled_date' => $startDate,
                'scheduled_time' => $validated['scheduled_time'] ?? null,
                'estimated_hours' => $validated['estimated_hours'] ?? null,
                'work_status' => 'assigned',
            ]
        );

        $oldStatus = $ticket->status;
        $ticket->update([
            'status' => 'assigned',
            'priority' => $priority,
            'due_date' => $validated['due_date'] ?? $finishDate ?? $ticket->due_date,
        ]);

        RequestStatusLog::create([
            'request_id' => $ticket->id,
            'changed_by' => $user->id,
            'old_status' => $oldStatus,
            'new_status' => 'assigned',
            'comment' => $isReassignment
                ? "Reassigned to technician #{$targetAssigneeId}."
                : "Assigned to technician #{$targetAssigneeId}.",
        ]);

        ActivityLogger::log(
            $user->id,
            'assignment',
            $isReassignment ? 'reassign' : 'assign',
            $workOrder->id,
            $isReassignment
                ? "Request #{$ticket->id} reassigned to technician #{$targetAssigneeId}."
                : "Request #{$ticket->id} assigned to technician #{$targetAssigneeId}.",
            $request
        );

        if ($isReassignment && $previousAssigneeId) {
            $this->notifyTechnician(
                $previousAssigneeId,
                'work_order_reassigned',
                "Request #{$this->requestCode($ticket->id)} has been reassigned to another technician.",
                $ticket->id
            );
        }

        $this->notifyTechnician(
            $targetAssigneeId,
            'work_order_assigned',
            $isReassignment
                ? "You have been reassigned maintenance request #{$this->requestCode($ticket->id)}."
                : "You have been assigned maintenance request #{$this->requestCode($ticket->id)}.",
            $ticket->id
        );

        $this->notifyRequester(
            $ticket,
            $isReassignment ? 'request_reassigned' : 'request_assigned',
            $isReassignment
                ? "Your maintenance request #{$this->requestCode($ticket->id)} has been reassigned to a technician."
                : "Your maintenance request #{$this->requestCode($ticket->id)} has been approved and assigned to a technician.",
            'request'
        );

        return response()->json([
            'success' => true,
            'message' => $isReassignment ? 'Work order reassigned.' : 'Work order assigned.',
            'work_order' => $workOrder->fresh(['assignee:id,fname,lname,phone']),
        ]);
    }

    public function close(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $ticket = MaintenanceRequest::query()->findOrFail($id);

        if ($ticket->status !== 'completed') {
            return response()->json([
                'success' => false,
                'message' => 'Only completed requests can be closed.',
            ], 422);
        }

        $oldStatus = $ticket->status;
        $ticket->update(['status' => 'closed']);

        RequestStatusLog::create([
            'request_id' => $ticket->id,
            'changed_by' => $user->id,
            'old_status' => $oldStatus,
            'new_status' => 'closed',
            'comment' => 'Request closed by supervisor.',
        ]);

        ActivityLogger::log($user->id, 'request_lifecycle', 'close', $ticket->id, "Request #{$ticket->id} closed.", $request);

        $this->notifyRequester(
            $ticket,
            'request_closed',
            "Request #{$this->requestCode($ticket->id)} has been closed. You can now provide feedback and a rating.",
            'request'
        );

        $latestWorkOrder = $ticket->workOrders()->latest('id')->first();
        if ($latestWorkOrder?->assigned_to) {
            $this->notifyTechnician(
                (int) $latestWorkOrder->assigned_to,
                'work_order_closed',
                "Work order for request #{$this->requestCode($ticket->id)} has been closed by supervisor.",
                $ticket->id
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Request closed.',
        ]);
    }

    public function reopen(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $ticket = MaintenanceRequest::query()->findOrFail($id);

        if ($ticket->status !== 'completed') {
            return response()->json([
                'success' => false,
                'message' => 'Only completed requests can be reopened for further work.',
            ], 422);
        }

        $oldStatus = $ticket->status;
        $latestWorkOrder = $ticket->workOrders()->latest('id')->first();
        if ($latestWorkOrder) {
            $latestWorkOrder->update([
                'work_status' => 'assigned',
                'completed_at' => null,
            ]);
        }

        $ticket->update(['status' => 'assigned']);

        RequestStatusLog::create([
            'request_id' => $ticket->id,
            'changed_by' => $user->id,
            'old_status' => $oldStatus,
            'new_status' => 'assigned',
            'comment' => 'Request reopened by supervisor for further technician work.',
        ]);

        ActivityLogger::log($user->id, 'request_lifecycle', 'reopen', $ticket->id, "Request #{$ticket->id} reopened.", $request);

        if ($latestWorkOrder?->assigned_to) {
            $this->notifyTechnician(
                $latestWorkOrder->assigned_to,
                'work_order_reopened',
                "Maintenance request #{$this->requestCode($ticket->id)} has been reopened for additional work.",
                $ticket->id
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Request reopened.',
        ]);
    }

    public function createManualWorkOrder(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'building_id' => ['nullable', 'integer', 'exists:buildings,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'custom_location' => ['nullable', 'string', 'max:255'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'priority' => ['required', 'in:low,medium,high,urgent'],
            'scheduled_date' => ['nullable', 'date'],
            'scheduled_time' => ['nullable', 'date_format:H:i'],
            'estimated_hours' => ['nullable', 'numeric', 'min:0.25'],
            'release' => ['sometimes', 'boolean'],
            'spare_parts' => ['sometimes', 'array'],
            'spare_parts.*.spare_part_id' => ['required', 'integer', 'exists:spare_parts,id'],
            'spare_parts.*.quantity_used' => ['required', 'integer', 'min:1'],
        ]);

        $status = !empty($validated['release']) ? 'assigned' : 'draft';

        $workOrder = WorkOrder::create([
            'request_id' => null,
            'created_by' => $user->id,
            'assigned_to' => $validated['assigned_to'] ?? null,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'category_id' => $validated['category_id'],
            'building_id' => $validated['building_id'] ?? null,
            'room_id' => $validated['room_id'] ?? null,
            'custom_location' => $validated['custom_location'] ?? null,
            'priority' => $validated['priority'],
            'scheduled_date' => $validated['scheduled_date'] ?? null,
            'scheduled_time' => $validated['scheduled_time'] ?? null,
            'estimated_hours' => $validated['estimated_hours'] ?? null,
            'work_status' => $status,
        ]);

        $totalSpareCost = 0.0;
        foreach ($validated['spare_parts'] ?? [] as $partUsage) {
            $part = SparePart::query()->findOrFail($partUsage['spare_part_id']);
            $qty = (int) $partUsage['quantity_used'];
            $unit = (float) $part->unit_price;
            $total = $qty * $unit;

            WorkOrderSparePart::create([
                'work_order_id' => $workOrder->id,
                'spare_part_id' => $part->id,
                'quantity_used' => $qty,
                'unit_price' => $unit,
                'total_price' => $total,
            ]);

            $totalSpareCost += $total;
            ActivityLogger::log(
                $user->id,
                'inventory',
                'record_usage',
                $part->id,
                "Recorded {$qty} used for manual work order #{$workOrder->id}.",
                $request
            );
        }

        ActivityLogger::log(
            $user->id,
            'work_order',
            $status === 'draft' ? 'save_draft' : 'release',
            $workOrder->id,
            "Manual work order #{$workOrder->id} created. Spare part total: {$totalSpareCost}.",
            $request
        );

        if ($status === 'assigned' && !empty($validated['assigned_to'])) {
            $workOrder->loadMissing(['building:id,name', 'room:id,name']);
            $supervisorName = $this->fullName($user);
            $location = $validated['custom_location']
                ?? trim(collect([
                    optional($workOrder->building)->name,
                    optional($workOrder->room)->name,
                ])->filter()->implode(' / '));
            $messageParts = [
                "Manual work order: {$workOrder->title}.",
                !empty($validated['description']) ? "Details: {$validated['description']}." : null,
                $location !== '' ? "Location: {$location}." : null,
                "Assigned by Supervisor {$supervisorName}.",
            ];

            $this->notifyTechnician(
                (int) $validated['assigned_to'],
                'manual_work_order_assigned',
                trim(implode(' ', array_filter($messageParts))),
                (int) $workOrder->id
            );
        }

        return response()->json([
            'success' => true,
            'message' => $status === 'draft' ? 'Manual work order saved as draft.' : 'Manual work order released.',
            'work_order' => $workOrder->load([
                'assignee:id,fname,lname,phone',
                'creator:id,fname,lname,phone,email',
                'category:id,name',
                'building:id,name',
                'room:id,name',
                'spareParts.sparePart',
            ]),
        ], 201);
    }

    public function analytics(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        [$from, $to, $query, $validated] = $this->filteredRequestQuery($request);
        $cacheKey = 'supervisor:analytics:' . $user->id . ':' . md5($request->fullUrl());
        $cachedPayload = Cache::get($cacheKey);
        if (is_array($cachedPayload)) {
            return response()->json($cachedPayload);
        }

        $total = (clone $query)->count();
        $approved = (clone $query)->where('status', 'approved')->count();
        $rejected = (clone $query)->where('status', 'rejected')->count();
        $completed = (clone $query)->whereIn('status', ['completed', 'closed'])->count();
        $overdue = (clone $query)
            ->whereNotNull('due_date')
            ->where('due_date', '<', now())
            ->whereNotIn('status', ['completed', 'closed', 'rejected', 'cancelled'])
            ->count();

        $reviewed = $approved + $rejected;
        $approvalRate = $reviewed > 0 ? round(($approved / $reviewed) * 100, 2) : 0.0;
        $completionRate = $total > 0 ? round(($completed / $total) * 100, 2) : 0.0;
        $overdueRate = $total > 0 ? round(($overdue / $total) * 100, 2) : 0.0;

        $completedWithDue = (clone $query)
            ->whereIn('status', ['completed', 'closed'])
            ->whereNotNull('due_date');

        $completedWithDueCount = (clone $completedWithDue)->count();
        $completedOnTime = (clone $completedWithDue)
            ->where(function ($q) {
                $q->whereHas('workOrders', fn ($wq) => $wq
                    ->whereNotNull('completed_at')
                    ->whereColumn('completed_at', '<=', 'maintenance_requests.due_date'))
                    ->orWhere(function ($inner) {
                        $inner->doesntHave('workOrders')
                            ->whereColumn('updated_at', '<=', 'due_date');
                    });
            })
            ->count();
        $slaCompliance = $completedWithDueCount > 0 ? round(($completedOnTime / $completedWithDueCount) * 100, 2) : 0.0;

        $trend = (clone $query)
            ->selectRaw("DATE(created_at) as date")
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved")
            ->selectRaw("SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected")
            ->selectRaw("SUM(CASE WHEN status IN ('completed','closed') THEN 1 ELSE 0 END) as completed")
            ->selectRaw("SUM(CASE WHEN due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('completed','closed','rejected','cancelled') THEN 1 ELSE 0 END) as overdue")
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date' => $row->date,
                'total' => (int) $row->total,
                'approved' => (int) $row->approved,
                'rejected' => (int) $row->rejected,
                'completed' => (int) $row->completed,
                'overdue' => (int) $row->overdue,
            ])
            ->values();

        $statusDistribution = collect([
            ['name' => 'Submitted', 'key' => 'submitted', 'total' => (clone $query)->where('status', 'submitted')->count()],
            ['name' => 'Approved', 'key' => 'approved', 'total' => $approved],
            ['name' => 'Assigned', 'key' => 'assigned', 'total' => (clone $query)->where('status', 'assigned')->count()],
            ['name' => 'In Progress', 'key' => 'in_progress', 'total' => (clone $query)->where('status', 'in_progress')->count()],
            ['name' => 'Completed', 'key' => 'completed', 'total' => $completed],
            ['name' => 'Rejected', 'key' => 'rejected', 'total' => $rejected],
            ['name' => 'Cancelled', 'key' => 'cancelled', 'total' => (clone $query)->where('status', 'cancelled')->count()],
        ])->map(fn ($item) => [
            ...$item,
            'percentage' => $total > 0 ? round(($item['total'] / $total) * 100, 2) : 0.0,
        ])->values();

        $priorityDistribution = $this->buildPriorityDistribution((clone $query), $total);
        $byDepartment = $this->groupRequestDimension((clone $query), 'department_id', 'department', $total);
        $byCategory = $this->groupRequestDimension((clone $query), 'category_id', 'category', $total);
        $byBuilding = $this->groupRequestDimension((clone $query), 'building_id', 'building', $total);
        $byAsset = $this->groupRequestDimension((clone $query), 'asset_id', 'asset', $total);
        $monthlyPerformance = $this->buildMonthlyPerformanceTrend((clone $query), $from, $to);

        $periodDays = max(1, $from->diffInDays($to) + 1);
        $prevTo = $from->copy()->subSecond();
        $prevFrom = $from->copy()->subDays($periodDays);

        $previousQuery = MaintenanceRequest::query()->whereBetween('created_at', [$prevFrom, $prevTo]);
        $this->applyDimensionFilters($previousQuery, $validated);
        if (($validated['kpi_filter'] ?? 'total') !== 'total') {
            $this->applyKpiFilter($previousQuery, (string) $validated['kpi_filter']);
        }

        $currentCategoryCounts = (clone $query)
            ->select('category_id', DB::raw('COUNT(*) as total'))
            ->groupBy('category_id')
            ->pluck('total', 'category_id');
        $previousCategoryCounts = (clone $previousQuery)
            ->select('category_id', DB::raw('COUNT(*) as total'))
            ->groupBy('category_id')
            ->pluck('total', 'category_id');

        $categoryGrowth = collect($currentCategoryCounts)->map(function ($count, $categoryId) use ($previousCategoryCounts, $total) {
            $previous = (int) ($previousCategoryCounts[$categoryId] ?? 0);
            $growth = (int) $count - $previous;
            return [
                'category_id' => (int) $categoryId,
                'total' => (int) $count,
                'previous_total' => $previous,
                'growth' => $growth,
                'growth_percentage' => $previous > 0 ? round(($growth / $previous) * 100, 2) : ($count > 0 ? 100.0 : 0.0),
                'percentage' => $total > 0 ? round(((int) $count / $total) * 100, 2) : 0.0,
            ];
        })->values();

        $categoryNames = \App\Models\Category::query()
            ->whereIn('id', $categoryGrowth->pluck('category_id')->all())
            ->pluck('name', 'id');
        $categoryGrowth = $categoryGrowth->map(fn ($row) => [
            ...$row,
            'name' => $categoryNames[$row['category_id']] ?? 'Unknown',
        ])->sortByDesc('growth')->values();

        $avgResolution = WorkOrder::query()
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from, $to])
            ->whereHas('request', function ($rq) use ($validated, $from, $to) {
                $rq->whereBetween('created_at', [$from, $to]);
                $this->applyDimensionFilters($rq, $validated);
                if (($validated['kpi_filter'] ?? 'total') !== 'total') {
                    $this->applyKpiFilter($rq, (string) $validated['kpi_filter']);
                }
            })
            ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, completed_at)) as avg_hours')
            ->value('avg_hours');

        $reliabilityMetrics = $this->buildReliabilityMetrics($from, $to, $validated);
        $selectedDepartmentTrend = $this->buildDimensionTrend($from, $to, $validated, 'department_id', 'department', $validated['department_id'] ?? null);
        $selectedCategoryTrend = $this->buildDimensionTrend($from, $to, $validated, 'category_id', 'category', $validated['category_id'] ?? null);
        $selectedBuildingTrend = $this->buildDimensionTrend($from, $to, $validated, 'building_id', 'building', $validated['building_id'] ?? null);
        $selectedAssetTrend = $this->buildDimensionTrend($from, $to, $validated, 'asset_id', 'asset', $validated['asset_id'] ?? null);
        $buildingFailureHotspot = $this->buildHighestFailureRateBuilding($byBuilding);
        $topAssetRow = $byAsset->first();
        $assetFailureFocus = $validated['asset_id'] ?? ($topAssetRow['id'] ?? null);
        $assetFailureTrend = $this->buildDimensionTrend($from, $to, $validated, 'asset_id', 'asset', $assetFailureFocus);

        $kpis = [
            'total' => ['value' => (int) $total, 'percentage' => 100.0],
            'approved' => ['value' => (int) $approved, 'percentage' => $total > 0 ? round(($approved / $total) * 100, 2) : 0.0],
            'rejected' => ['value' => (int) $rejected, 'percentage' => $total > 0 ? round(($rejected / $total) * 100, 2) : 0.0],
            'completed' => ['value' => (int) $completed, 'percentage' => $completionRate],
            'overdue' => ['value' => (int) $overdue, 'percentage' => $overdueRate],
        ];

        $payload = [
            'success' => true,
            'filters' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'department_id' => $validated['department_id'] ?? null,
                'building_id' => $validated['building_id'] ?? null,
                'category_id' => $validated['category_id'] ?? null,
                'asset_id' => $validated['asset_id'] ?? null,
                'kpi_filter' => $validated['kpi_filter'] ?? 'total',
            ],
            'kpis' => $kpis,
            'status_distribution' => $statusDistribution,
            'priority_distribution' => $priorityDistribution,
            'trend' => $trend,
            'monthly_performance' => $monthlyPerformance,
            'by_department' => $byDepartment,
            'by_category' => $byCategory,
            'by_building' => $byBuilding,
            'by_asset' => $byAsset,
            'top_departments' => $byDepartment->take(5)->values(),
            'top_assets' => $byAsset->take(10)->values(),
            'category_growth' => $categoryGrowth,
            'performance' => [
                'completion_rate' => $completionRate,
                'overdue_rate' => $overdueRate,
                'approval_rate' => $approvalRate,
                'sla_compliance_rate' => $slaCompliance,
                'on_time_completion_rate' => $slaCompliance,
                'average_resolution_time_hours' => round((float) ($avgResolution ?? 0), 2),
                'overdue_count' => (int) $overdue,
                'first_time_fix_rate' => $reliabilityMetrics['first_time_fix_rate'],
            ],
            'reliability' => $reliabilityMetrics,
            'trend_context' => [
                'department' => $selectedDepartmentTrend,
                'category' => $selectedCategoryTrend,
                'building' => $selectedBuildingTrend,
                'asset' => $selectedAssetTrend,
                'asset_failure' => $assetFailureTrend,
            ],
            'insights' => [
                'department_with_most_issues' => $byDepartment->first(),
                'category_with_most_issues' => $byCategory->first(),
                'category_increasing_fastest' => $categoryGrowth->first(fn ($row) => ($row['growth'] ?? 0) > 0),
                'most_problematic_building' => $byBuilding->first(),
                'building_with_highest_failure_rate' => $buildingFailureHotspot,
                'are_we_completing_on_time' => [
                    'value' => $slaCompliance,
                    'label' => $slaCompliance >= 80 ? 'Mostly On Time' : 'Needs Attention',
                ],
                'current_sla_compliance' => [
                    'value' => $slaCompliance,
                    'label' => $slaCompliance >= 90 ? 'Healthy' : ($slaCompliance >= 80 ? 'Watch Closely' : 'At Risk'),
                ],
            ],
            'filter_options' => [
                'departments' => Department::query()->orderBy('name')->get(['id', 'name']),
                'buildings' => Building::query()->orderBy('name')->get(['id', 'name']),
                'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
                'assets' => Asset::query()->orderBy('name')->get(['id', 'name']),
            ],
        ];
        Cache::put($cacheKey, $payload, now()->addMinutes(2));
        return response()->json($payload);
    }

    public function reports(Request $request)
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);
        [$from, $to, $query, $filters] = $this->filteredRequestQuery($request);

        $validated = $request->validate([
            'export' => ['nullable', 'in:pdf,excel,print,copy'],
            'report_type' => ['nullable', 'in:maintenance_summary,technician_performance,spare_part_usage_cost,asset_report,spare_parts_usage,asset_reliability,category_analysis,building_location,department_analysis,preventive_maintenance'],
        ]);

        $reportType = $validated['report_type'] ?? 'maintenance_summary';
        if ($reportType === 'spare_parts_usage') {
            $reportType = 'spare_part_usage_cost';
        }
        if ($reportType === 'asset_reliability') {
            $reportType = 'asset_report';
        }
        $total = (clone $query)->count();
        $completed = (clone $query)->whereIn('status', ['completed', 'closed'])->count();
        $overdue = (clone $query)->whereNotNull('due_date')->where('due_date', '<', now())->whereNotIn('status', ['completed', 'closed', 'rejected'])->count();
        $priorityDistribution = $this->buildPriorityDistribution((clone $query), $total);
        $monthlyPerformance = $this->buildMonthlyPerformanceTrend((clone $query), $from, $to);
        $reliabilityMetrics = $this->buildReliabilityMetrics($from, $to, $filters);

        $avgResolution = WorkOrder::query()
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from, $to])
            ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, completed_at)) as avg_hours')
            ->value('avg_hours');

        $reportPayload = match ($reportType) {
            'technician_performance' => $this->buildTechnicianPerformanceReport($from, $to, $filters),
            'spare_part_usage_cost' => $this->buildSparePartUsageCostReport($from, $to, $filters),
            'asset_report' => $this->buildAssetReport($from, $to, $filters),
            'category_analysis' => $this->buildCategoryAnalysisReport($query, $total, $from, $to, $filters),
            'building_location' => $this->buildBuildingLocationReport($query, $total, $from, $to, $filters),
            'department_analysis' => $this->buildDepartmentAnalysisReport($query, $total, $from, $to, $filters),
            'preventive_maintenance' => $this->buildPreventiveMaintenanceReport($from, $to, $filters),
            default => $this->buildMaintenanceSummaryReport($query, $total, $completed, $from, $to, $filters),
        };

        $topDepartments = (clone $query)
            ->select('department_id', DB::raw('COUNT(*) as total'))
            ->groupBy('department_id')
            ->orderByDesc('total')
            ->limit(5)
            ->with('department:id,name')
            ->get()
            ->map(fn ($row) => ['name' => $row->department?->name ?? 'Unknown', 'total' => (int) $row->total])
            ->values()
            ->all();

        $sparePartIssueQuery = $this->filteredPartIssueQuery($from, $to, $filters);

        $summary = [
            'from' => $from,
            'to' => $to,
            'report_type' => $reportType,
            'total_requests' => $total,
            'completed_percent' => $total > 0 ? round(($completed / $total) * 100, 2) : 0,
            'overdue_percent' => $total > 0 ? round(($overdue / $total) * 100, 2) : 0,
            'top_departments' => $topDepartments,
            'spare_part_total_cost' => (float) (clone $sparePartIssueQuery)->sum('part_issues.total_cost'),
            'average_resolution_time_hours' => round((float) ($avgResolution ?? 0), 2),
            'priority_distribution' => $priorityDistribution,
            'monthly_performance' => $monthlyPerformance,
            'reliability_metrics' => $reliabilityMetrics,
            'report_payload' => $reportPayload,
        ];

        $export = $validated['export'] ?? null;
        if ($export === 'excel') {
            $csv = "Metric,Value\n";
            foreach ($summary as $key => $value) {
                if (is_array($value)) {
                    $value = json_encode($value);
                }
                $csv .= "{$key},\"{$value}\"\n";
            }
            return response($csv, 200, [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename=maintenance-report.csv',
            ]);
        }

        if ($export === 'pdf' || $export === 'print') {
            return response()->json([
                'success' => true,
                'summary' => $summary,
                'render_hint' => $export,
                'copy_summary' => $this->buildCopySummary($summary),
            ]);
        }

        return response()->json([
            'success' => true,
            'summary' => $summary,
            'copy_summary' => $this->buildCopySummary($summary),
        ]);
    }

    private function filteredRequestQuery(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'building_id' => ['nullable', 'integer', 'exists:buildings,id'],
            'building' => ['nullable', 'integer', 'exists:buildings,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'department' => ['nullable', 'integer', 'exists:departments,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'category' => ['nullable', 'integer', 'exists:categories,id'],
            'asset_id' => ['nullable', 'integer', 'exists:assets,id'],
            'asset' => ['nullable', 'integer', 'exists:assets,id'],
            'period' => ['nullable', 'in:today,weekly,monthly,quarterly,yearly,custom'],
            'kpi_filter' => ['nullable', 'in:total,approved,rejected,completed,overdue'],
        ]);

        $to = !empty($validated['to']) ? Carbon::parse($validated['to'])->endOfDay() : now()->endOfDay();
        $from = !empty($validated['from']) ? Carbon::parse($validated['from'])->startOfDay() : $to->copy()->subDays(30)->startOfDay();

        if (!empty($validated['period']) && $validated['period'] !== 'custom') {
            $from = match ($validated['period']) {
                'today' => $to->copy()->startOfDay(),
                'weekly' => $to->copy()->subWeek()->startOfDay(),
                'monthly' => $to->copy()->subMonth()->startOfDay(),
                'quarterly' => $to->copy()->subMonths(3)->startOfDay(),
                'yearly' => $to->copy()->subYear()->startOfDay(),
                default => $from,
            };
        }

        $normalized = [
            'building_id' => $validated['building_id'] ?? $validated['building'] ?? null,
            'department_id' => $validated['department_id'] ?? $validated['department'] ?? null,
            'category_id' => $validated['category_id'] ?? $validated['category'] ?? null,
            'asset_id' => $validated['asset_id'] ?? $validated['asset'] ?? null,
            'kpi_filter' => $validated['kpi_filter'] ?? 'total',
        ];

        $query = MaintenanceRequest::query()->whereBetween('created_at', [$from, $to]);
        $this->applyDimensionFilters($query, $normalized);
        if (($normalized['kpi_filter'] ?? 'total') !== 'total') {
            $this->applyKpiFilter($query, (string) $normalized['kpi_filter']);
        }

        return [$from, $to, $query, $normalized];
    }

    private function applyDimensionFilters($query, array $validated): void
    {
        if (!empty($validated['building_id'])) {
            $query->where('building_id', $validated['building_id']);
        }
        if (!empty($validated['department_id'])) {
            $query->where('department_id', $validated['department_id']);
        }
        if (!empty($validated['category_id'])) {
            $query->where('category_id', $validated['category_id']);
        }
        if (!empty($validated['asset_id'])) {
            $query->where('asset_id', $validated['asset_id']);
        }
    }

    private function applyKpiFilter($query, string $kpiFilter): void
    {
        if ($kpiFilter === 'approved') {
            $query->where('status', 'approved');
            return;
        }
        if ($kpiFilter === 'rejected') {
            $query->where('status', 'rejected');
            return;
        }
        if ($kpiFilter === 'completed') {
            $query->whereIn('status', ['completed', 'closed']);
            return;
        }
        if ($kpiFilter === 'overdue') {
            $query->whereNotNull('due_date')
                ->where('due_date', '<', now())
                ->whereNotIn('status', ['completed', 'closed', 'rejected']);
        }
    }

    private function groupRequestDimension($query, string $field, string $relation, int $total)
    {
        return $query
            ->select($field)
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN status IN ('completed','closed') THEN 1 ELSE 0 END) as completed")
            ->selectRaw("SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved")
            ->selectRaw("SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected")
            ->selectRaw("SUM(CASE WHEN due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('completed','closed','rejected') THEN 1 ELSE 0 END) as overdue")
            ->groupBy($field)
            ->with(["{$relation}:id,name"])
            ->orderByDesc('total')
            ->get()
            ->map(function ($row) use ($relation, $total, $field) {
                $count = (int) $row->total;
                return [
                    'id' => $row->getAttribute($field),
                    'name' => $row->{$relation}?->name ?? 'Unknown',
                    'total' => $count,
                    'completed' => (int) $row->completed,
                    'approved' => (int) $row->approved,
                    'rejected' => (int) $row->rejected,
                    'overdue' => (int) $row->overdue,
                    'percentage' => $total > 0 ? round(($count / $total) * 100, 2) : 0.0,
                ];
            })
            ->values();
    }

    private function buildCopySummary(array $summary): string
    {
        $payload = $summary['report_payload'] ?? [];
        $reportType = $summary['report_type'] ?? 'maintenance_summary';

        $lines = [
            "Report Type: {$reportType}",
            "Total Requests: {$summary['total_requests']}",
            "Completed %: {$summary['completed_percent']}",
            "Overdue %: {$summary['overdue_percent']}",
            "Spare Part Total Cost: {$summary['spare_part_total_cost']}",
            "Avg Resolution Time (hours): {$summary['average_resolution_time_hours']}",
        ];

        if ($reportType === 'technician_performance') {
            $lines[] = "Technicians Ranked: " . count($payload['ranked_technicians'] ?? []);
        }

        if ($reportType === 'spare_part_usage_cost') {
            $lines[] = "Part Spend Total: " . ($payload['total_cost'] ?? 0);
        }

        if ($reportType === 'asset_report') {
            $lines[] = "Assets Listed: " . count($payload['asset_profiles'] ?? []);
        }

        if ($reportType === 'maintenance_summary') {
            $lines[] = "Emergency Requests: " . ($payload['request_volume']['emergency_count'] ?? 0);
        }

        return implode("\n", [
            ...$lines,
        ]);
    }

    private function buildMaintenanceSummaryReport($requestQuery, int $total, int $completed, Carbon $from, Carbon $to, array $filters): array
    {
        $priorityDistribution = $this->buildPriorityDistribution((clone $requestQuery), $total);
        $highPriorityCount = collect($priorityDistribution)
            ->whereIn('key', ['high', 'urgent'])
            ->sum('total');
        $normalCount = max(0, $total - $highPriorityCount);

        $statusKeys = [
            'pending' => ['submitted', 'pending', 'approved'],
            'in_progress' => ['assigned', 'in_progress', 'paused'],
            'completed' => ['completed', 'closed'],
        ];

        $statusCounts = collect($statusKeys)->map(function ($statuses, $label) use ($requestQuery, $total) {
            $count = (clone $requestQuery)->whereIn('status', $statuses)->count();
            return [
                'status' => $label,
                'count' => (int) $count,
                'percentage' => $total > 0 ? round(($count / $total) * 100, 2) : 0,
            ];
        })->values()->all();

        $topDepartments = (clone $requestQuery)
            ->select('department_id', DB::raw('COUNT(*) as total'))
            ->groupBy('department_id')
            ->orderByDesc('total')
            ->with('department:id,name')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'name' => $row->department?->name ?? 'Unknown',
                'count' => (int) $row->total,
                'percentage' => $total > 0 ? round(((int) $row->total / $total) * 100, 2) : 0,
            ])
            ->values()
            ->all();

        $topBuildings = (clone $requestQuery)
            ->select('building_id', DB::raw('COUNT(*) as total'))
            ->groupBy('building_id')
            ->orderByDesc('total')
            ->with('building:id,name')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'name' => $row->building?->name ?? 'Unknown',
                'count' => (int) $row->total,
                'percentage' => $total > 0 ? round(((int) $row->total / $total) * 100, 2) : 0,
            ])
            ->values()
            ->all();

        return [
            'purpose' => 'A high-level overview for management to see the health of the campus.',
            'summary_cards' => [
                ['label' => 'Total Requests', 'count' => (int) $total, 'percentage' => 100.0],
                ['label' => 'Completed Requests', 'count' => (int) $completed, 'percentage' => $total > 0 ? round(($completed / $total) * 100, 2) : 0],
                ['label' => 'High Priority Requests', 'count' => (int) $highPriorityCount, 'percentage' => $total > 0 ? round(($highPriorityCount / $total) * 100, 2) : 0],
                ['label' => 'Normal Requests', 'count' => (int) $normalCount, 'percentage' => $total > 0 ? round(($normalCount / $total) * 100, 2) : 0],
            ],
            'request_volume' => [
                'received' => (int) $total,
                'completed' => (int) $completed,
                'completion_rate' => $total > 0 ? round(($completed / $total) * 100, 2) : 0,
                'emergency_count' => (int) $highPriorityCount,
                'normal_count' => (int) $normalCount,
            ],
            'priority_breakdown' => $priorityDistribution,
            'status_counts' => $statusCounts,
            'location_highlights' => [
                'departments' => $topDepartments,
                'buildings' => $topBuildings,
            ],
            'monthly_performance' => $this->buildMonthlyPerformanceTrend((clone $requestQuery), $from, $to),
            'reliability_metrics' => $this->buildReliabilityMetrics($from, $to, $filters),
        ];
    }

    private function buildTechnicianPerformanceReport(Carbon $from, Carbon $to, array $filters): array
    {
        $workOrderScope = fn ($query) => $query->whereHas('request', function ($rq) use ($from, $to, $filters) {
            $rq->whereBetween('created_at', [$from, $to]);
            $this->applyDimensionFilters($rq, $filters);
        });

        $technicians = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'technician'))
            ->with(['specialties:id,name'])
            ->withCount([
                'assignedWorkOrders as assigned_total' => function ($q) use ($workOrderScope) {
                    $workOrderScope($q);
                },
                'assignedWorkOrders as completed_total' => function ($q) use ($workOrderScope) {
                    $workOrderScope($q);
                    $q->whereIn('work_status', ['completed']);
                },
                'assignedWorkOrders as pending_load' => function ($q) use ($workOrderScope) {
                    $workOrderScope($q);
                    $q->whereIn('work_status', ['assigned', 'in_progress', 'paused']);
                },
            ])
            ->get(['id', 'fname', 'lname'])
            ->map(function ($tech) use ($workOrderScope) {
                $avgHours = WorkOrder::query()
                    ->where('assigned_to', $tech->id)
                    ->whereNotNull('completed_at')
                    ->whereIn('work_status', ['completed'])
                    ->tap($workOrderScope)
                    ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, completed_at)) as avg_hours')
                    ->value('avg_hours');

                $assigned = (int) $tech->assigned_total;
                $completed = (int) $tech->completed_total;
                $rate = $assigned > 0 ? round(($completed / $assigned) * 100, 2) : 0;

                return [
                    'technician_name' => trim("{$tech->fname} {$tech->lname}") ?: 'Unknown Technician',
                    'specialization' => $tech->specialties->pluck('name')->filter()->values()->implode(', ') ?: 'General',
                    'assigned_volume' => $assigned,
                    'completed_volume' => $completed,
                    'resolution_rate' => $rate,
                    'average_duration_hours' => round((float) ($avgHours ?? 0), 2),
                    'average_duration_days' => round((float) (($avgHours ?? 0) / 24), 2),
                    'pending_load' => (int) $tech->pending_load,
                ];
            })
            ->sortByDesc('assigned_volume')
            ->values()
            ->all();

        return [
            'purpose' => 'To track accountability and identify who needs more support or training.',
            'ranked_technicians' => $technicians,
            'sort_options' => ['completion_time', 'volume'],
            'summary_metrics' => [
                'technician_count' => count($technicians),
                'average_resolution_rate' => count($technicians) > 0 ? round(collect($technicians)->avg('resolution_rate'), 2) : 0,
                'average_pending_load' => count($technicians) > 0 ? round(collect($technicians)->avg('pending_load'), 2) : 0,
            ],
        ];
    }

    private function buildSparePartUsageCostReport(Carbon $from, Carbon $to, array $filters): array
    {
        $issues = PartIssue::query()
            ->with([
                'part:id,name,part_code,quantity_available,minimum_stock',
                'workOrder:id,request_id',
                'workOrder.request:id,department_id,building_id',
                'workOrder.request.department:id,name',
                'workOrder.request.building:id,name',
            ])
            ->whereBetween('issue_date', [$from, $to])
            ->whereHas('workOrder.request', function ($rq) use ($filters, $from, $to) {
                $rq->whereBetween('created_at', [$from, $to]);
                $this->applyDimensionFilters($rq, $filters);
            })
            ->orderByDesc('issue_date')
            ->get();

        $installedByPair = WorkOrderSparePart::query()
            ->whereIn('work_order_id', $issues->pluck('work_order_id')->filter()->unique()->values())
            ->get(['work_order_id', 'spare_part_id', 'quantity_used'])
            ->groupBy(fn ($row) => "{$row->work_order_id}:{$row->spare_part_id}")
            ->map(fn ($rows) => (int) $rows->sum('quantity_used'));

        $consumptionLog = $issues->map(function ($issue) use ($installedByPair) {
            $key = "{$issue->work_order_id}:{$issue->part_id}";
            $installedQty = (int) ($installedByPair[$key] ?? 0);
            $waste = max(0, ((int) $issue->quantity_issued) - $installedQty);

            return [
                'issue_date' => $issue->issue_date,
                'work_order_id' => (int) $issue->work_order_id,
                'part_name' => $issue->part_name_snapshot ?: ($issue->part?->name ?? 'Unknown'),
                'part_code' => $issue->part?->part_code ?? '',
                'department' => $issue->workOrder?->request?->department?->name ?? 'Unknown',
                'building' => $issue->workOrder?->request?->building?->name ?? 'Unknown',
                'quantity_issued' => (int) $issue->quantity_issued,
                'quantity_installed' => $installedQty,
                'waste_quantity' => $waste,
                'unit_cost' => (float) ($issue->unit_cost ?? 0),
                'total_cost' => (float) ($issue->total_cost ?? 0),
            ];
        })->values();

        $totalCost = (float) $consumptionLog->sum('total_cost');

        $spendByDepartment = $consumptionLog
            ->groupBy('department')
            ->map(fn ($rows, $department) => [
                'department' => (string) $department,
                'total_cost' => round((float) $rows->sum('total_cost'), 2),
            ])
            ->sortByDesc('total_cost')
            ->values()
            ->all();

        $spendByBuilding = $consumptionLog
            ->groupBy('building')
            ->map(fn ($rows, $building) => [
                'building' => (string) $building,
                'total_cost' => round((float) $rows->sum('total_cost'), 2),
            ])
            ->sortByDesc('total_cost')
            ->values()
            ->all();

        $lowStockAlerts = SparePart::query()
            ->whereColumn('quantity_available', '<=', 'minimum_stock')
            ->orderBy('quantity_available')
            ->limit(20)
            ->get(['id', 'name', 'part_code', 'quantity_available', 'minimum_stock'])
            ->map(fn ($part) => [
                'id' => (int) $part->id,
                'name' => $part->name,
                'part_code' => $part->part_code,
                'quantity_available' => (int) $part->quantity_available,
                'reorder_point' => (int) $part->minimum_stock,
            ])
            ->values()
            ->all();

        $issuedQty = (int) $consumptionLog->sum('quantity_issued');
        $installedQty = (int) $consumptionLog->sum('quantity_installed');

        return [
            'purpose' => 'Financial oversight and stock management.',
            'consumption_log' => $consumptionLog->all(),
            'total_cost' => round($totalCost, 2),
            'spend_by_department' => $spendByDepartment,
            'spend_by_building' => $spendByBuilding,
            'low_stock_alerts' => $lowStockAlerts,
            'waste_tracking' => [
                'issued_quantity' => $issuedQty,
                'installed_quantity' => $installedQty,
                'waste_quantity' => max(0, $issuedQty - $installedQty),
            ],
            'summary_metrics' => [
                'records' => $consumptionLog->count(),
                'average_cost_per_issue' => $consumptionLog->count() > 0 ? round($totalCost / $consumptionLog->count(), 2) : 0,
            ],
        ];
    }

    private function buildAssetReport(Carbon $from, Carbon $to, array $filters): array
    {
        $requestCounts = MaintenanceRequest::query()
            ->whereNotNull('asset_id')
            ->whereBetween('created_at', [$from, $to])
            ->tap(function ($q) use ($filters) {
                $this->applyDimensionFilters($q, $filters);
            })
            ->select('asset_id', DB::raw('COUNT(*) as failures'))
            ->groupBy('asset_id')
            ->pluck('failures', 'asset_id');

        $assetIds = $requestCounts->keys()->all();
        if (!empty($filters['asset_id'])) {
            $assetIds = [(int) $filters['asset_id']];
        }

        $assets = Asset::query()
            ->with(['category:id,name', 'building:id,name'])
            ->when(!empty($filters['building_id']), fn ($q) => $q->where('building_id', $filters['building_id']))
            ->when(!empty($assetIds), fn ($q) => $q->whereIn('id', $assetIds))
            ->orderBy('name')
            ->limit(100)
            ->get(['id', 'name', 'category_id', 'building_id', 'serial_number', 'status', 'created_at']);

        $profiles = $assets->map(function ($asset) use ($requestCounts, $from, $to) {
            $failures = (int) ($requestCounts[$asset->id] ?? 0);
            $resolutionHours = WorkOrder::query()
                ->whereHas('request', fn ($rq) => $rq->where('asset_id', $asset->id)->whereBetween('created_at', [$from, $to]))
                ->whereNotNull('completed_at')
                ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, completed_at)) as avg_hours')
                ->value('avg_hours');

            return [
                'asset_id' => (int) $asset->id,
                'asset_name' => $asset->name,
                'brand' => $asset->category?->name ?? 'N/A',
                'serial_number' => $asset->serial_number ?: 'N/A',
                'installation_date' => $asset->created_at,
                'building' => $asset->building?->name ?? 'Unknown',
                'repair_history_count' => $failures,
                'current_condition' => $asset->status === 'active' ? 'Operational' : 'Needs Repair',
                'replacement_signal' => $failures >= 3 ? 'Replace it' : 'Monitor',
                'average_resolution_time_hours' => round((float) ($resolutionHours ?? 0), 2),
            ];
        })->values()->all();

        return [
            'purpose' => 'Tracking the university physical inventory and its lifespan.',
            'asset_profiles' => $profiles,
            'reliability_metrics' => $this->buildReliabilityMetrics($from, $to, $filters),
        ];
    }

    private function buildCategoryAnalysisReport($requestQuery, int $total, Carbon $from, Carbon $to, array $filters): array
    {
        $categories = $this->groupRequestDimension(clone $requestQuery, 'category_id', 'category', $total)->all();
        $costByCategory = $this->filteredPartIssueQuery($from, $to, $filters)
            ->select('maintenance_requests.category_id', DB::raw('SUM(part_issues.total_cost) as total_cost'))
            ->groupBy('maintenance_requests.category_id')
            ->pluck('total_cost', 'maintenance_requests.category_id');

        $rows = collect($categories)->map(fn ($row) => [
            ...$row,
            'cost' => round((float) ($costByCategory[$row['id']] ?? 0), 2),
        ])->values()->all();

        return [
            'purpose' => 'Shows which maintenance categories create the most work and cost.',
            'categories' => $rows,
            'trend' => !empty($filters['category_id'])
                ? $this->buildDimensionTrend($from, $to, $filters, 'category_id', 'category', $filters['category_id'])
                : ['id' => null, 'name' => null, 'points' => $this->buildMonthlyPerformanceTrend(clone $requestQuery, $from, $to)],
            'top_category' => $rows[0] ?? null,
        ];
    }

    private function buildBuildingLocationReport($requestQuery, int $total, Carbon $from, Carbon $to, array $filters): array
    {
        $buildings = $this->groupRequestDimension(clone $requestQuery, 'building_id', 'building', $total)->all();
        $costByBuilding = $this->filteredPartIssueQuery($from, $to, $filters)
            ->select('maintenance_requests.building_id', DB::raw('SUM(part_issues.total_cost) as total_cost'))
            ->groupBy('maintenance_requests.building_id')
            ->pluck('total_cost', 'maintenance_requests.building_id');

        $rows = collect($buildings)->map(fn ($row) => [
            ...$row,
            'cost' => round((float) ($costByBuilding[$row['id']] ?? 0), 2),
        ])->values()->all();

        return [
            'purpose' => 'Highlights the buildings and locations with the highest issue load.',
            'buildings' => $rows,
            'trend' => !empty($filters['building_id'])
                ? $this->buildDimensionTrend($from, $to, $filters, 'building_id', 'building', $filters['building_id'])
                : ['id' => null, 'name' => null, 'points' => $this->buildMonthlyPerformanceTrend(clone $requestQuery, $from, $to)],
            'top_building' => $rows[0] ?? null,
        ];
    }

    private function buildDepartmentAnalysisReport($requestQuery, int $total, Carbon $from, Carbon $to, array $filters): array
    {
        $departments = $this->groupRequestDimension(clone $requestQuery, 'department_id', 'department', $total)->all();

        $topCategories = MaintenanceRequest::query()
            ->whereBetween('created_at', [$from, $to])
            ->tap(fn ($q) => $this->applyDimensionFilters($q, $filters))
            ->select('department_id', 'category_id', DB::raw('COUNT(*) as total'))
            ->groupBy('department_id', 'category_id')
            ->with(['category:id,name'])
            ->get()
            ->groupBy('department_id')
            ->map(fn ($rows) => $rows->sortByDesc('total')->first());

        $topAssets = MaintenanceRequest::query()
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('asset_id')
            ->tap(fn ($q) => $this->applyDimensionFilters($q, $filters))
            ->select('department_id', 'asset_id', DB::raw('COUNT(*) as total'))
            ->groupBy('department_id', 'asset_id')
            ->with(['asset:id,name'])
            ->get()
            ->groupBy('department_id')
            ->map(fn ($rows) => $rows->sortByDesc('total')->first());

        $partStats = PartIssue::query()
            ->join('work_orders', 'work_orders.id', '=', 'part_issues.work_order_id')
            ->join('maintenance_requests', 'maintenance_requests.id', '=', 'work_orders.request_id')
            ->whereBetween('part_issues.issue_date', [$from, $to])
            ->whereBetween('maintenance_requests.created_at', [$from, $to])
            ->tap(fn ($q) => $this->applyDimensionFilters($q, $filters))
            ->select(
                'maintenance_requests.department_id',
                'part_issues.part_id',
                DB::raw("MAX(COALESCE(part_issues.part_name_snapshot, 'Unknown')) as part_name"),
                DB::raw('SUM(part_issues.quantity_issued) as issued_quantity'),
                DB::raw('SUM(part_issues.total_cost) as total_cost')
            )
            ->groupBy('maintenance_requests.department_id', 'part_issues.part_id')
            ->get()
            ->groupBy('department_id');

        $rows = collect($departments)->map(function ($row) use ($topCategories, $topAssets, $partStats) {
            $departmentId = $row['id'];
            $departmentParts = collect($partStats[$departmentId] ?? []);
            $topPart = $departmentParts->sortByDesc('issued_quantity')->first();

            return [
                ...$row,
                'top_category' => $topCategories[$departmentId]?->category?->name ?? 'N/A',
                'top_asset' => $topAssets[$departmentId]?->asset?->name ?? 'N/A',
                'top_spare_part' => $topPart?->part_name ?? 'N/A',
                'total_cost' => round((float) $departmentParts->sum('total_cost'), 2),
            ];
        })->values()->all();

        return [
            'purpose' => 'Ranks departments by request volume, dominant issue pattern, and spare-part cost.',
            'departments' => $rows,
            'top_department' => $rows[0] ?? null,
        ];
    }

    private function filteredPartIssueQuery(Carbon $from, Carbon $to, array $filters)
    {
        return PartIssue::query()
            ->join('work_orders', 'work_orders.id', '=', 'part_issues.work_order_id')
            ->join('maintenance_requests', 'maintenance_requests.id', '=', 'work_orders.request_id')
            ->whereBetween('part_issues.issue_date', [$from, $to])
            ->whereBetween('maintenance_requests.created_at', [$from, $to])
            ->tap(fn ($q) => $this->applyDimensionFilters($q, $filters));
    }

    private function buildPreventiveMaintenanceReport(Carbon $from, Carbon $to, array $filters): array
    {
        $today = now()->startOfDay();
        $plans = PreventiveMaintenancePlan::query()
            ->with(['asset:id,name,building_id', 'asset.building:id,name', 'category:id,name', 'assignee:id,fname,lname'])
            ->whereBetween('next_due_date', [$from->toDateString(), $to->toDateString()])
            ->when(!empty($filters['asset_id']), fn ($q) => $q->where('asset_id', $filters['asset_id']))
            ->when(!empty($filters['category_id']), fn ($q) => $q->where('category_id', $filters['category_id']))
            ->when(!empty($filters['building_id']), function ($q) use ($filters) {
                $q->whereHas('asset', fn ($aq) => $aq->where('building_id', $filters['building_id']));
            })
            ->orderBy('next_due_date')
            ->get();

        $rows = $plans->map(function ($plan) use ($today) {
            $dueDate = $plan->next_due_date ? Carbon::parse($plan->next_due_date) : null;
            $derivedStatus = $plan->status === 'completed'
                ? 'completed'
                : ($dueDate && $dueDate->lt($today) ? 'overdue' : 'scheduled');

            return [
                'id' => (int) $plan->id,
                'title' => $plan->title,
                'asset' => $plan->asset?->name ?? 'Unknown',
                'building' => $plan->asset?->building?->name ?? 'Unknown',
                'category' => $plan->category?->name ?? 'General',
                'priority' => $plan->priority,
                'frequency' => $plan->frequency_type,
                'scheduled_date' => optional($plan->next_due_date)->toDateString(),
                'technician' => trim(($plan->assignee?->fname ?? '') . ' ' . ($plan->assignee?->lname ?? '')) ?: 'Unassigned',
                'status' => $derivedStatus,
            ];
        })->values();

        $scheduledCount = $rows->count();
        $completedCount = $rows->where('status', 'completed')->count();
        $overdueCount = $rows->where('status', 'overdue')->count();

        return [
            'purpose' => 'Tracks preventive schedules, completion discipline, and overdue PM work.',
            'summary_metrics' => [
                'scheduled_pm' => $scheduledCount,
                'completed_pm' => $completedCount,
                'overdue_pm' => $overdueCount,
                'compliance_rate' => $scheduledCount > 0 ? round(($completedCount / $scheduledCount) * 100, 2) : 0,
            ],
            'pm_tasks' => $rows->all(),
        ];
    }

    private function buildPriorityDistribution($query, int $total)
    {
        $priorityOrder = ['urgent', 'high', 'medium', 'low'];

        return $query
            ->select('priority', DB::raw('COUNT(*) as total'))
            ->groupBy('priority')
            ->get()
            ->map(function ($row) use ($total) {
                $count = (int) $row->total;
                return [
                    'name' => ucfirst((string) $row->priority),
                    'key' => (string) $row->priority,
                    'total' => $count,
                    'count' => $count,
                    'percentage' => $total > 0 ? round(($count / $total) * 100, 2) : 0.0,
                ];
            })
            ->sortBy(fn ($row) => array_search($row['key'], $priorityOrder, true))
            ->values()
            ->all();
    }

    private function buildMonthlyPerformanceTrend($query, Carbon $from, Carbon $to)
    {
        return $query
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m-01') as month_key")
            ->selectRaw("DATE_FORMAT(created_at, '%b %Y') as label")
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN status IN ('completed','closed') THEN 1 ELSE 0 END) as completed")
            ->selectRaw("SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved")
            ->selectRaw("SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected")
            ->selectRaw("SUM(CASE WHEN due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('completed','closed','rejected') THEN 1 ELSE 0 END) as overdue")
            ->groupBy('month_key', 'label')
            ->orderBy('month_key')
            ->get()
            ->map(function ($row) use ($from, $to) {
                $reviewed = (int) $row->approved + (int) $row->rejected;
                $completed = (int) $row->completed;
                $overdue = (int) $row->overdue;
                $onTimeCompleted = max(0, $completed - min($completed, $overdue));

                $avgHours = WorkOrder::query()
                    ->whereNotNull('completed_at')
                    ->whereHas('request', function ($rq) use ($row, $from, $to) {
                        $rq->whereBetween('created_at', [$from, $to])
                            ->whereRaw("DATE_FORMAT(created_at, '%Y-%m-01') = ?", [$row->month_key]);
                    })
                    ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, completed_at)) as avg_hours')
                    ->value('avg_hours');

                return [
                    'period_start' => $row->month_key,
                    'label' => $row->label,
                    'total' => (int) $row->total,
                    'completed' => $completed,
                    'approved' => (int) $row->approved,
                    'rejected' => (int) $row->rejected,
                    'overdue' => $overdue,
                    'completion_rate' => (int) $row->total > 0 ? round(($completed / (int) $row->total) * 100, 2) : 0.0,
                    'approval_rate' => $reviewed > 0 ? round(((int) $row->approved / $reviewed) * 100, 2) : 0.0,
                    'on_time_completion_rate' => $completed > 0 ? round(($onTimeCompleted / $completed) * 100, 2) : 0.0,
                    'average_resolution_time_hours' => round((float) ($avgHours ?? 0), 2),
                ];
            })
            ->values()
            ->all();
    }

    private function buildDimensionTrend(Carbon $from, Carbon $to, array $filters, string $field, string $relation, $dimensionId = null): array
    {
        $dimensionId = $dimensionId ? (int) $dimensionId : null;
        if (!$dimensionId) {
            return [
                'id' => null,
                'name' => null,
                'points' => [],
            ];
        }

        $query = MaintenanceRequest::query()
            ->whereBetween('created_at', [$from, $to])
            ->tap(function ($q) use ($filters, $field, $dimensionId) {
                $scopedFilters = $filters;
                unset($scopedFilters[$field]);
                $this->applyDimensionFilters($q, $scopedFilters);
                $q->where($field, $dimensionId);
            });

        $relationModel = MaintenanceRequest::query()
            ->with(["{$relation}:id,name"])
            ->where($field, $dimensionId)
            ->first();

        $points = $query
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m-01') as month_key")
            ->selectRaw("DATE_FORMAT(created_at, '%b %Y') as label")
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN status IN ('completed','closed') THEN 1 ELSE 0 END) as completed")
            ->selectRaw("SUM(CASE WHEN due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('completed','closed','rejected') THEN 1 ELSE 0 END) as overdue")
            ->groupBy('month_key', 'label')
            ->orderBy('month_key')
            ->get()
            ->map(function ($row) {
                return [
                    'label' => $row->label,
                    'total' => (int) $row->total,
                    'completed' => (int) $row->completed,
                    'overdue' => (int) $row->overdue,
                ];
            })
            ->values()
            ->all();

        return [
            'id' => $dimensionId,
            'name' => $relationModel?->{$relation}?->name ?? 'Unknown',
            'points' => $points,
        ];
    }

    private function buildReliabilityMetrics(Carbon $from, Carbon $to, array $filters): array
    {
        $completedOrders = WorkOrder::query()
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from, $to])
            ->whereHas('request', function ($rq) use ($filters, $from, $to) {
                $rq->whereBetween('created_at', [$from, $to]);
                $this->applyDimensionFilters($rq, $filters);
            });

        $mttr = round((float) ((clone $completedOrders)->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, completed_at)) as avg_hours')->value('avg_hours') ?? 0), 2);
        $downtime = round((float) ((clone $completedOrders)->selectRaw('SUM(TIMESTAMPDIFF(HOUR, created_at, completed_at)) as total_hours')->value('total_hours') ?? 0), 2);

        $failureEvents = (int) MaintenanceRequest::query()
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('asset_id')
            ->tap(fn ($q) => $this->applyDimensionFilters($q, $filters))
            ->count();

        $periodHours = max(24, $from->diffInHours($to) + 1);
        $mtbf = round($periodHours / max(1, $failureEvents), 2);

        $completedRequests = MaintenanceRequest::query()
            ->whereBetween('created_at', [$from, $to])
            ->whereIn('status', ['completed', 'closed'])
            ->tap(fn ($q) => $this->applyDimensionFilters($q, $filters));

        $completedRequestCount = (clone $completedRequests)->count();
        $firstTimeFixCount = (clone $completedRequests)
            ->withCount('workOrders')
            ->get()
            ->filter(fn ($request) => (int) $request->work_orders_count <= 1)
            ->count();

        return [
            'mttr_hours' => $mttr,
            'mtbf_hours' => $mtbf,
            'downtime_hours' => $downtime,
            'first_time_fix_rate' => $completedRequestCount > 0 ? round(($firstTimeFixCount / $completedRequestCount) * 100, 2) : 0.0,
            'failure_events' => $failureEvents,
        ];
    }

    private function buildHighestFailureRateBuilding($byBuilding): ?array
    {
        $candidate = collect($byBuilding)
            ->map(function ($row) {
                $total = (int) ($row['total'] ?? 0);
                $overdue = (int) ($row['overdue'] ?? 0);
                return [
                    ...$row,
                    'failure_rate' => $total > 0 ? round(($overdue / $total) * 100, 2) : 0.0,
                ];
            })
            ->sortByDesc('failure_rate')
            ->first();

        return $candidate ?: null;
    }

    private function requestCode(int $id): string
    {
        return sprintf('REQ-%03d', $id);
    }

    private function profilePictureUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }
        $url = Storage::disk('public')->url($path);
        return str_starts_with($url, 'http') ? $url : url($url);
    }

    private function notifyRequester(MaintenanceRequest $ticket, string $type, string $message, string $module = 'request'): void
    {
        UserNotification::create([
            'user_id' => $ticket->requester_id,
            'recipient_role' => 'requester',
            'type' => $type,
            'module' => $module,
            'related_id' => $ticket->id,
            'message' => $message,
            'is_read' => false,
        ]);

    }

    private function notifyTechnician(int $technicianId, string $type, string $message, int $relatedId, string $module = 'work_order'): void
    {
        UserNotification::create([
            'user_id' => $technicianId,
            'recipient_role' => 'technician',
            'type' => $type,
            'module' => $module,
            'related_id' => $relatedId,
            'message' => $message,
            'is_read' => false,
        ]);

    }
}
