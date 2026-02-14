<?php

namespace App\Http\Controllers\Api;

use App\Models\MaintenanceRequest;
use App\Models\PreventiveMaintenancePlan;
use App\Models\RequestMessage;
use App\Models\RequestStatusLog;
use App\Models\SparePart;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\WorkOrder;
use App\Models\WorkOrderSparePart;
use App\Services\ActivityLogger;
use App\Support\SlaResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
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
                $q->where('user_id', $user->id)->orWhere('recipient_role', 'supervisor');
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
                'requester:id,fname,lname,phone,email',
                'category:id,name',
                'building:id,name',
                'room:id,name',
                'asset:id,name',
                'messages' => fn ($q) => $q->whereNull('deleted_at')->with('sender:id,fname,lname,phone')->orderBy('created_at'),
                'images',
                'statusLogs' => fn ($q) => $q->with('changedBy:id,fname,lname,phone')->orderBy('created_at'),
            ])
            ->findOrFail($id);

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
        if ($message->created_at?->diffInMinutes(now()) > 5) {
            return response()->json([
                'success' => false,
                'message' => 'You can edit messages only within 5 minutes.',
            ], 422);
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
        if ($message->created_at?->diffInMinutes(now()) > 5) {
            return response()->json([
                'success' => false,
                'message' => 'You can delete messages only within 5 minutes.',
            ], 422);
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
                'request:id,title,description,status,priority,due_date,building_id,room_id,asset_id,category_id',
                'request.building:id,name',
                'request.room:id,name',
                'request.asset:id,name',
                'request.category:id,name',
                'assignee:id,fname,lname,phone,email',
                'spareParts.sparePart',
            ])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'work_order' => $workOrder,
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

        return response()->json([
            'success' => true,
            'message' => "Request {$newStatus}.",
            'request' => $ticket->fresh(),
        ]);
    }

    public function techniciansForCategory(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);
        $validated = $request->validate([
            'category_id' => ['required', 'integer', 'exists:categories,id'],
        ]);

        $technicians = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'technician'))
            ->whereHas('specialties', fn ($q) => $q->where('category_id', $validated['category_id']))
            ->with(['specialties:id,name,category_id'])
            ->withCount([
                'assignedWorkOrders as open_workload' => fn ($q) => $q->whereIn('work_status', ['assigned', 'in_progress']),
            ])
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

        if ($ticket->status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'Assignment is allowed only after approval.',
            ], 422);
        }

        $validated = $request->validate([
            'assigned_to' => ['required', 'integer', 'exists:users,id'],
            'scheduled_date' => ['nullable', 'date'],
            'scheduled_time' => ['nullable', 'date_format:H:i'],
            'estimated_hours' => ['nullable', 'numeric', 'min:0.25'],
            'priority' => ['nullable', 'in:low,medium,high,urgent'],
        ]);

        $technician = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'technician'))
            ->with('specialties:id,category_id')
            ->findOrFail($validated['assigned_to']);

        $categoryId = (int) $ticket->category_id;
        $specialtyCategoryIds = $technician->specialties->pluck('category_id')->map(fn ($v) => (int) $v)->all();
        if (!in_array($categoryId, $specialtyCategoryIds, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Technician is not specialized for this category.',
            ], 422);
        }

        $workOrder = WorkOrder::query()->updateOrCreate(
            ['request_id' => $ticket->id],
            [
                'created_by' => $user->id,
                'assigned_to' => $validated['assigned_to'],
                'priority' => $validated['priority'] ?? $ticket->priority,
                'scheduled_date' => $validated['scheduled_date'] ?? null,
                'scheduled_time' => $validated['scheduled_time'] ?? null,
                'estimated_hours' => $validated['estimated_hours'] ?? null,
                'work_status' => 'assigned',
            ]
        );

        $oldStatus = $ticket->status;
        $ticket->update(['status' => 'assigned']);

        RequestStatusLog::create([
            'request_id' => $ticket->id,
            'changed_by' => $user->id,
            'old_status' => $oldStatus,
            'new_status' => 'assigned',
            'comment' => "Assigned to technician #{$validated['assigned_to']}.",
        ]);

        ActivityLogger::log(
            $user->id,
            'assignment',
            'assign',
            $workOrder->id,
            "Request #{$ticket->id} assigned to technician #{$validated['assigned_to']}.",
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Work order assigned.',
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

        return response()->json([
            'success' => true,
            'message' => 'Request closed.',
        ]);
    }

    public function reopen(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $ticket = MaintenanceRequest::query()->findOrFail($id);

        if ($ticket->status !== 'closed') {
            return response()->json([
                'success' => false,
                'message' => 'Only closed requests can be reopened.',
            ], 422);
        }

        $oldStatus = $ticket->status;
        $ticket->update(['status' => 'in_progress']);

        RequestStatusLog::create([
            'request_id' => $ticket->id,
            'changed_by' => $user->id,
            'old_status' => $oldStatus,
            'new_status' => 'in_progress',
            'comment' => 'Request reopened by supervisor.',
        ]);

        ActivityLogger::log($user->id, 'request_lifecycle', 'reopen', $ticket->id, "Request #{$ticket->id} reopened.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Request reopened.',
        ]);
    }

    public function createManualWorkOrder(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['supervisor', 'admin']);
        $validated = $request->validate([
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

            $part->decrement('quantity_available', $qty);
            $totalSpareCost += $total;
            ActivityLogger::log(
                $user->id,
                'inventory',
                'deduct',
                $part->id,
                "Deducted {$qty} from {$part->part_code} for manual work order #{$workOrder->id}.",
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

        return response()->json([
            'success' => true,
            'message' => $status === 'draft' ? 'Manual work order saved as draft.' : 'Manual work order released.',
            'work_order' => $workOrder->load(['assignee:id,fname,lname,phone', 'spareParts.sparePart']),
        ], 201);
    }

    public function analytics(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);
        [$from, $to, $query] = $this->filteredRequestQuery($request);

        $issuesByCategory = (clone $query)
            ->select('category_id', DB::raw('COUNT(*) as total'))
            ->groupBy('category_id')
            ->with('category:id,name')
            ->get()
            ->map(fn ($row) => ['name' => $row->category?->name ?? 'Unknown', 'total' => (int) $row->total]);

        $issuesByBuilding = (clone $query)
            ->select('building_id', DB::raw('COUNT(*) as total'))
            ->groupBy('building_id')
            ->with('building:id,name')
            ->get()
            ->map(fn ($row) => ['name' => $row->building?->name ?? 'Unknown', 'total' => (int) $row->total]);

        $topDepartments = (clone $query)
            ->select('department_id', DB::raw('COUNT(*) as total'))
            ->groupBy('department_id')
            ->orderByDesc('total')
            ->limit(5)
            ->with('department:id,name')
            ->get()
            ->map(fn ($row) => ['name' => $row->department?->name ?? 'Unknown', 'total' => (int) $row->total]);

        $sparePartUsageCost = WorkOrderSparePart::query()
            ->whereBetween('created_at', [$from, $to])
            ->sum('total_price');

        $technicianPerformance = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'technician'))
            ->withCount([
                'assignedWorkOrders as completed_jobs' => fn ($q) => $q->where('work_status', 'completed')->whereBetween('updated_at', [$from, $to]),
                'assignedWorkOrders as overdue_jobs' => fn ($q) => $q
                    ->whereIn('work_status', ['assigned', 'in_progress'])
                    ->whereHas('request', fn ($rq) => $rq->whereNotNull('due_date')->where('due_date', '<', now())),
            ])
            ->get(['id', 'fname', 'lname', 'avg_rating'])
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => trim($u->fname . ' ' . $u->lname),
                'completed_jobs' => (int) $u->completed_jobs,
                'overdue_jobs' => (int) $u->overdue_jobs,
                'avg_rating' => (float) $u->avg_rating,
            ]);

        $total = (clone $query)->count();
        $completed = (clone $query)->whereIn('status', ['completed', 'closed'])->count();
        $overdue = (clone $query)->whereNotNull('due_date')->where('due_date', '<', now())->whereNotIn('status', ['completed', 'closed', 'rejected'])->count();

        return response()->json([
            'success' => true,
            'filters' => ['from' => $from, 'to' => $to],
            'issues_by_category' => $issuesByCategory,
            'issues_by_building' => $issuesByBuilding,
            'top_departments' => $topDepartments,
            'spare_part_usage_total_cost' => (float) $sparePartUsageCost,
            'technician_performance' => $technicianPerformance,
            'completion_rate' => $total > 0 ? round(($completed / $total) * 100, 2) : 0,
            'overdue_rate' => $total > 0 ? round(($overdue / $total) * 100, 2) : 0,
        ]);
    }

    public function reports(Request $request)
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);
        [$from, $to, $query] = $this->filteredRequestQuery($request);

        $validated = $request->validate([
            'export' => ['nullable', 'in:pdf,excel,print,copy'],
        ]);

        $total = (clone $query)->count();
        $completed = (clone $query)->whereIn('status', ['completed', 'closed'])->count();
        $overdue = (clone $query)->whereNotNull('due_date')->where('due_date', '<', now())->whereNotIn('status', ['completed', 'closed', 'rejected'])->count();

        $avgResolution = WorkOrder::query()
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from, $to])
            ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, completed_at)) as avg_hours')
            ->value('avg_hours');

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

        $summary = [
            'from' => $from,
            'to' => $to,
            'total_requests' => $total,
            'completed_percent' => $total > 0 ? round(($completed / $total) * 100, 2) : 0,
            'overdue_percent' => $total > 0 ? round(($overdue / $total) * 100, 2) : 0,
            'top_departments' => $topDepartments,
            'spare_part_total_cost' => (float) WorkOrderSparePart::query()->whereBetween('created_at', [$from, $to])->sum('total_price'),
            'average_resolution_time_hours' => round((float) ($avgResolution ?? 0), 2),
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
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'period' => ['nullable', 'in:weekly,monthly,quarterly,yearly,custom'],
        ]);

        $to = !empty($validated['to']) ? Carbon::parse($validated['to'])->endOfDay() : now()->endOfDay();
        $from = !empty($validated['from']) ? Carbon::parse($validated['from'])->startOfDay() : $to->copy()->subDays(30)->startOfDay();

        if (!empty($validated['period']) && $validated['period'] !== 'custom') {
            $from = match ($validated['period']) {
                'weekly' => $to->copy()->subWeek()->startOfDay(),
                'monthly' => $to->copy()->subMonth()->startOfDay(),
                'quarterly' => $to->copy()->subMonths(3)->startOfDay(),
                'yearly' => $to->copy()->subYear()->startOfDay(),
                default => $from,
            };
        }

        $query = MaintenanceRequest::query()->whereBetween('created_at', [$from, $to]);

        if (!empty($validated['building_id'])) {
            $query->where('building_id', $validated['building_id']);
        }
        if (!empty($validated['department_id'])) {
            $query->where('department_id', $validated['department_id']);
        }
        if (!empty($validated['category_id'])) {
            $query->where('category_id', $validated['category_id']);
        }

        return [$from, $to, $query];
    }

    private function buildCopySummary(array $summary): string
    {
        return implode("\n", [
            "Total Requests: {$summary['total_requests']}",
            "Completed %: {$summary['completed_percent']}",
            "Overdue %: {$summary['overdue_percent']}",
            "Spare Part Total Cost: {$summary['spare_part_total_cost']}",
            "Avg Resolution Time (hours): {$summary['average_resolution_time_hours']}",
        ]);
    }
}
