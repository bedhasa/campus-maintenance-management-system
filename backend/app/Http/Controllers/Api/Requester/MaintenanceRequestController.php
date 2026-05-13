<?php

namespace App\Http\Controllers\Api\Requester;

use App\Models\MaintenanceRequest;
use App\Models\RequestImage;
use App\Models\RequestMessage;
use App\Models\RequestStatusLog;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\ActivityLogger;
use App\Services\EmailNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class MaintenanceRequestController extends RequesterController
{
    private const REQUEST_CANCELLED_MARKER = 'Request cancelled by requester before supervisor review.';

    public function dashboard(Request $request): JsonResponse
    {
        $user = $this->requester($request);

        $base = MaintenanceRequest::query()->where('requester_id', $user->id);
        $cancelledCount = $this->countCancelledRequests(clone $base);
        $rejectedCount = max(0, (clone $base)->where('status', 'rejected')->count() - $cancelledCount);
        $recentRequests = MaintenanceRequest::query()
            ->where('requester_id', $user->id)
            ->with([
                'category:id,name',
                'building:id,name',
                'room:id,name',
                'statusLogs' => fn ($query) => $query->select(['id', 'request_id', 'new_status', 'comment', 'created_at'])->orderByDesc('created_at'),
            ])
            ->latest()
            ->limit(5)
            ->get();

        $this->applyDisplayStatusCollection($recentRequests);

        return response()->json([
            'success' => true,
            'summary' => [
                'total' => (clone $base)->count(),
                'submitted' => (clone $base)->where('status', 'submitted')->count(),
                'approved' => (clone $base)->where('status', 'approved')->count(),
                'assigned' => (clone $base)->where('status', 'assigned')->count(),
                'in_progress' => (clone $base)->where('status', 'in_progress')->count(),
                'completed' => (clone $base)->where('status', 'completed')->count(),
                'rejected' => $rejectedCount,
                'closed' => (clone $base)->where('status', 'closed')->count(),
                'cancelled' => $cancelledCount,
            ],
            'recent_requests' => $recentRequests,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->requester($request);

        $validated = $request->validate([
            'status' => ['nullable', 'string'],
            'priority' => ['nullable', 'string'],
            'search' => ['nullable', 'string', 'max:150'],
        ]);

        $query = MaintenanceRequest::query()
            ->where('requester_id', $user->id)
            ->with([
                'category:id,name',
                'building:id,name',
                'room:id,name',
                'asset:id,name',
                'statusLogs' => fn ($q) => $q->select(['id', 'request_id', 'new_status', 'comment', 'created_at'])->orderByDesc('created_at'),
            ])
            ->latest();

        if (!empty($validated['status'])) {
            if ($validated['status'] === 'cancelled') {
                $query->where(function ($q) {
                    $q->where('status', 'cancelled')
                        ->orWhere(function ($inner) {
                            $inner->where('status', 'rejected')
                                ->whereHas('statusLogs', fn ($logs) => $logs
                                    ->where('new_status', 'rejected')
                                    ->where('comment', 'like', self::REQUEST_CANCELLED_MARKER . '%'));
                        });
                });
            } elseif ($validated['status'] === 'rejected') {
                $query->where('status', 'rejected')
                    ->whereDoesntHave('statusLogs', fn ($logs) => $logs
                        ->where('new_status', 'rejected')
                        ->where('comment', 'like', self::REQUEST_CANCELLED_MARKER . '%'));
            } else {
                $query->where('status', $validated['status']);
            }
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

        $requests = $query->paginate(15);
        $this->applyDisplayStatusCollection($requests->getCollection());

        return response()->json([
            'success' => true,
            'requests' => $requests,
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $this->requester($request);
        $ticket = MaintenanceRequest::query()
            ->with([
                'requester:id,fname,lname,phone,email,profile_picture',
                'category:id,name',
                'building:id,name',
                'room:id,name',
                'asset:id,name',
                'department:id,name',
                'statusLogs' => function ($query) {
                    $query
                        ->with('changedBy:id,fname,lname,phone')
                        ->orderBy('created_at');
                },
                'messages' => function ($query) {
                    $query
                        ->whereNull('deleted_at')
                        ->with('sender:id,fname,lname,phone')
                        ->orderBy('created_at');
                },
                'images',
                'workOrders' => fn ($q) => $q
                    ->with('assignee:id,fname,lname,phone,email,profile_picture')
                    ->orderByDesc('id'),
                'rating' => fn ($q) => $q->with('requester:id,fname,lname,profile_picture'),
            ])
            ->findOrFail($id);

        if ($ticket->requester_id !== $user->id) {
            return $this->forbidden();
        }

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
        $this->applyDisplayStatus($ticket);

        return response()->json([
            'success' => true,
            'request' => $ticket,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->requester($request);
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'description' => ['required', 'string'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'building_id' => ['nullable', 'integer', 'exists:buildings,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'custom_location' => ['nullable', 'string', 'max:255'],
            'asset_id' => ['nullable', 'integer', 'exists:assets,id'],
            'priority' => ['required', 'in:low,medium,high,urgent'],
        ]);

        $ticket = MaintenanceRequest::create([
            ...$validated,
            'requester_id' => $user->id,
            'department_id' => $user->dept_id,
            'status' => 'submitted',
        ]);

        RequestStatusLog::create([
            'request_id' => $ticket->id,
            'changed_by' => $user->id,
            'old_status' => null,
            'new_status' => 'submitted',
            'comment' => 'Request submitted by requester.',
        ]);

        UserNotification::create([
            'user_id' => $user->id,
            'type' => 'request_submitted',
            'related_id' => $ticket->id,
            'message' => "Your maintenance request #{$this->requestCode($ticket->id)} has been submitted successfully and is awaiting supervisor approval.",
            'is_read' => false,
        ]);

        $this->notifySupervisors(
            'request_submitted',
            $ticket->id,
            "A new maintenance request #{$this->requestCode($ticket->id)} requires your review."
        );

        $this->notifySupervisors(
            'chat_message',
            $ticket->id,
            "New requester message on request #{$this->requestCode($ticket->id)}."
        );

        return response()->json([
            'success' => true,
            'message' => 'Maintenance request submitted.',
            'request' => $ticket->load(['category:id,name', 'building:id,name', 'room:id,name']),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $this->requester($request);
        $ticket = MaintenanceRequest::findOrFail($id);

        if ($ticket->requester_id !== $user->id) {
            return $this->forbidden();
        }

        if (!in_array($ticket->status, ['submitted', 'rejected', 'cancelled'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Request cannot be edited in its current status.',
            ], 422);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:150'],
            'description' => ['sometimes', 'string'],
            'category_id' => ['sometimes', 'integer', 'exists:categories,id'],
            'building_id' => ['nullable', 'integer', 'exists:buildings,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'custom_location' => ['nullable', 'string', 'max:255'],
            'asset_id' => ['nullable', 'integer', 'exists:assets,id'],
            'priority' => ['sometimes', 'in:low,medium,high,urgent'],
        ]);

        $previousStatus = $ticket->status;
        $isResubmission = in_array($previousStatus, ['rejected', 'cancelled'], true);

        $updatePayload = $validated;
        if ($isResubmission) {
            $updatePayload['status'] = 'submitted';
        }

        $ticket->update($updatePayload);

        if ($isResubmission) {
            RequestStatusLog::create([
                'request_id' => $ticket->id,
                'changed_by' => $user->id,
                'old_status' => $previousStatus,
                'new_status' => 'submitted',
                'comment' => 'Requester edited and resubmitted the request for supervisor review.',
            ]);

            $this->notifySupervisors(
                'request_submitted',
                $ticket->id,
                "Request #{$this->requestCode($ticket->id)} has been updated and resubmitted for review."
            );
        }

        return response()->json([
            'success' => true,
            'message' => $isResubmission ? 'Request updated and resubmitted.' : 'Request updated.',
            'request' => $ticket->fresh()->load(['category:id,name', 'building:id,name', 'room:id,name']),
        ]);
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $user = $this->requester($request);
        $ticket = MaintenanceRequest::findOrFail($id);

        if ((int) $ticket->requester_id !== (int) $user->id) {
            return $this->forbidden();
        }

        if ($ticket->status !== 'submitted') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending requests can be cancelled.',
            ], 422);
        }

        $validated = $request->validate([
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $oldStatus = $ticket->status;
        $ticket->update(['status' => 'cancelled']);

        RequestStatusLog::create([
            'request_id' => $ticket->id,
            'changed_by' => $user->id,
            'old_status' => $oldStatus,
            'new_status' => 'cancelled',
            'comment' => trim((string) ($validated['comment'] ?? '')) ?: self::REQUEST_CANCELLED_MARKER,
        ]);

        ActivityLogger::log($user->id, 'request_lifecycle', 'cancel', $ticket->id, "Requester cancelled Request #{$ticket->id}.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Request cancelled.',
            'request' => $ticket->fresh()->load(['category:id,name', 'building:id,name', 'room:id,name']),
        ]);
    }

    public function statusLogs(Request $request, int $id): JsonResponse
    {
        $user = $this->requester($request);
        $ticket = MaintenanceRequest::findOrFail($id);
        if ($ticket->requester_id !== $user->id) {
            return $this->forbidden();
        }

        return response()->json([
            'success' => true,
            'logs' => RequestStatusLog::query()
                ->where('request_id', $ticket->id)
                ->with('changedBy:id,fname,lname,phone')
                ->latest()
                ->get(),
        ]);
    }

    public function messages(Request $request, int $id): JsonResponse
    {
        $user = $this->requester($request);
        $ticket = MaintenanceRequest::findOrFail($id);
        if ($ticket->requester_id !== $user->id) {
            return $this->forbidden();
        }

        return response()->json([
            'success' => true,
            'messages' => RequestMessage::query()
                ->where('request_id', $ticket->id)
                ->whereNull('deleted_at')
                ->with('sender:id,fname,lname,phone')
                ->oldest()
                ->get(),
        ]);
    }

    public function addMessage(Request $request, int $id): JsonResponse
    {
        $user = $this->requester($request);
        $ticket = MaintenanceRequest::findOrFail($id);
        if ($ticket->requester_id !== $user->id) {
            return $this->forbidden();
        }
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

        ActivityLogger::log($user->id, 'chat', 'add_message', $message->id, "Message added on request #{$ticket->id}.", $request);

        $this->notifySupervisors(
            'chat_message',
            $ticket->id,
            "New requester message on request #{$this->requestCode($ticket->id)}."
        );

        return response()->json([
            'success' => true,
            'message' => 'Message sent.',
            'data' => $message->load('sender:id,fname,lname,phone'),
        ], 201);
    }

    public function updateMessage(Request $request, int $id, int $messageId): JsonResponse
    {
        $user = $this->requester($request);
        $ticket = MaintenanceRequest::findOrFail($id);
        if ($ticket->requester_id !== $user->id) {
            return $this->forbidden();
        }
        if ($ticket->status === 'closed') {
            return response()->json([
                'success' => false,
                'message' => 'Chat is locked after request closure.',
            ], 422);
        }

        $message = RequestMessage::where('request_id', $ticket->id)->findOrFail($messageId);
        if ($message->sender_id !== $user->id) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $message->update([
            'message' => $validated['message'],
            'edited_at' => now(),
        ]);

        ActivityLogger::log($user->id, 'chat', 'edit_message', $message->id, "Message updated on request #{$ticket->id}.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Message updated.',
            'data' => $message->fresh()->load('sender:id,fname,lname,phone'),
        ]);
    }

    public function deleteMessage(Request $request, int $id, int $messageId): JsonResponse
    {
        $user = $this->requester($request);
        $ticket = MaintenanceRequest::findOrFail($id);
        if ($ticket->requester_id !== $user->id) {
            return $this->forbidden();
        }
        if ($ticket->status === 'closed') {
            return response()->json([
                'success' => false,
                'message' => 'Chat is locked after request closure.',
            ], 422);
        }

        $message = RequestMessage::where('request_id', $ticket->id)->findOrFail($messageId);
        if ($message->sender_id !== $user->id) {
            return $this->forbidden();
        }

        $message->update([
            'deleted_at' => now(),
        ]);

        ActivityLogger::log($user->id, 'chat', 'chat_delete', $message->id, "Message soft deleted on request #{$ticket->id}.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Message deleted.',
        ]);
    }

    public function images(Request $request, int $id): JsonResponse
    {
        $user = $this->requester($request);
        $ticket = MaintenanceRequest::findOrFail($id);
        if ($ticket->requester_id !== $user->id) {
            return $this->forbidden();
        }

        return response()->json([
            'success' => true,
            'images' => RequestImage::query()
                ->where('request_id', $ticket->id)
                ->latest()
                ->get(),
        ]);
    }

    public function addImage(Request $request, int $id): JsonResponse
    {
        $user = $this->requester($request);
        $ticket = MaintenanceRequest::findOrFail($id);
        if ($ticket->requester_id !== $user->id) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'image' => ['required', 'image', 'max:4096'],
        ]);

        $path = $validated['image']->store('request-images', 'public');

        $image = RequestImage::create([
            'request_id' => $ticket->id,
            'image_path' => $path,
            'uploaded_by' => $user->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Image uploaded.',
            'image' => $image,
        ], 201);
    }

    public function verifyCompletion(Request $request, int $id): JsonResponse
    {
        $user = $this->requester($request);
        $ticket = MaintenanceRequest::query()->with('workOrders')->findOrFail($id);

        if ((int) $ticket->requester_id !== (int) $user->id) {
            return $this->forbidden();
        }

        if ($ticket->status !== 'completed') {
            return response()->json([
                'success' => false,
                'message' => 'Only completed requests can be verified by requester.',
            ], 422);
        }

        $validated = $request->validate([
            'action' => ['required', 'in:accept,reopen'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $comment = trim((string) ($validated['comment'] ?? ''));
        if ($validated['action'] === 'reopen' && $comment === '') {
            return response()->json([
                'success' => false,
                'message' => 'Please provide a reason before reopening.',
            ], 422);
        }

        $requestCode = $this->requestCode($ticket->id);
        $latestWorkOrder = $ticket->workOrders()->latest('id')->first();
        $oldStatus = $ticket->status;

        if ($validated['action'] === 'accept') {
            RequestStatusLog::create([
                'request_id' => $ticket->id,
                'changed_by' => $user->id,
                'old_status' => $oldStatus,
                'new_status' => 'completed',
                'comment' => 'Requester approved the completed work. Supervisor closure is now pending.',
            ]);

            if ($latestWorkOrder?->assigned_to) {
                $this->notifyUser(
                    (int) $latestWorkOrder->assigned_to,
                    'technician',
                    'request_completion_approved',
                    $ticket->id,
                    "Request #{$requestCode} was approved by the requester and is waiting for supervisor closure."
                );
            }

            $this->notifySupervisors(
                'request_completion_approved',
                $ticket->id,
                "Request #{$requestCode} was approved by the requester and is ready for final closure."
            );

            ActivityLogger::log($user->id, 'request_lifecycle', 'approve_completion', $ticket->id, "Requester approved completion for Request #{$ticket->id}.", $request);

            return response()->json([
                'success' => true,
                'message' => 'Request approved. Waiting for supervisor closure.',
            ]);
        }

        return $this->reopenForRequester($ticket, $user, $comment, $request);
    }

    public function reopen(Request $request, int $id): JsonResponse
    {
        $user = $this->requester($request);
        $ticket = MaintenanceRequest::query()->with('workOrders')->findOrFail($id);

        if ((int) $ticket->requester_id !== (int) $user->id) {
            return $this->forbidden();
        }

        if (!in_array($ticket->status, ['completed', 'closed'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only completed or closed requests can be reopened by the requester.',
            ], 422);
        }

        $validated = $request->validate([
            'comment' => ['required', 'string', 'max:1000'],
        ]);

        return $this->reopenForRequester($ticket, $user, trim($validated['comment']), $request);
    }

    private function profilePictureUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }
        $url = Storage::disk('public')->url($path);
        return str_starts_with($url, 'http') ? $url : url($url);
    }

    private function requestCode(int $id): string
    {
        return sprintf('REQ-%03d', $id);
    }

    private function countCancelledRequests($query): int
    {
        return (int) $query
            ->where(function ($q) {
                $q->where('status', 'cancelled')
                    ->orWhere(function ($inner) {
                        $inner->where('status', 'rejected')
                            ->whereHas('statusLogs', fn ($logs) => $logs
                                ->where('new_status', 'rejected')
                                ->where('comment', 'like', self::REQUEST_CANCELLED_MARKER . '%'));
                    });
            })
            ->count();
    }

    private function applyDisplayStatusCollection(iterable $requests): void
    {
        foreach ($requests as $request) {
            if ($request instanceof MaintenanceRequest) {
                $this->applyDisplayStatus($request);
            }
        }
    }

    private function applyDisplayStatus(MaintenanceRequest $request): void
    {
        $logs = $request->relationLoaded('statusLogs')
            ? $request->statusLogs
            : $request->statusLogs()->orderByDesc('created_at')->get(['id', 'request_id', 'new_status', 'comment', 'created_at']);

        $cancelled = $request->status === 'cancelled'
            || ($request->status === 'rejected'
                && $logs->contains(fn ($log) => $log->new_status === 'rejected'
                    && str_starts_with((string) ($log->comment ?? ''), self::REQUEST_CANCELLED_MARKER)));

        if ($cancelled) {
            $request->setAttribute('status', 'cancelled');
        }
    }

    private function reopenForRequester(MaintenanceRequest $ticket, User $user, string $comment, Request $request): JsonResponse
    {
        $requestCode = $this->requestCode($ticket->id);
        $latestWorkOrder = $ticket->workOrders()->latest('id')->first();
        $oldStatus = $ticket->status;

        if ($latestWorkOrder) {
            $updates = [
                'work_status' => 'assigned',
                'completed_at' => null,
            ];
            if (Schema::hasColumn('work_orders', 'completed_by_technician_at')) {
                $updates['completed_by_technician_at'] = null;
            }
            if (Schema::hasColumn('work_orders', 'status_updated_at')) {
                $updates['status_updated_at'] = now();
            }
            $latestWorkOrder->update($updates);
        }

        // Internal status remains "assigned" for compatibility with existing enums/UI filters.
        $ticket->update(['status' => 'assigned']);

        RequestStatusLog::create([
            'request_id' => $ticket->id,
            'changed_by' => $user->id,
            'old_status' => $oldStatus,
            'new_status' => 'assigned',
            'comment' => "Requester reopened request for additional work. Reason: {$comment}",
        ]);

        if ($latestWorkOrder?->assigned_to) {
            $this->notifyUser(
                (int) $latestWorkOrder->assigned_to,
                'technician',
                'request_reopened',
                $ticket->id,
                "Request #{$requestCode} has been reopened by the requester. Additional work is required."
            );
        }

        $this->notifySupervisors(
            'request_reopened',
            $ticket->id,
            "Request #{$requestCode} has been reopened."
        );

        $this->notifyUser(
            (int) $ticket->requester_id,
            'requester',
            'request_reopened',
            $ticket->id,
            "Your request #{$requestCode} has been reopened for additional maintenance work."
        );

        ActivityLogger::log($user->id, 'request_lifecycle', 'reopen', $ticket->id, "Requester reopened Request #{$ticket->id}.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Request reopened for additional work.',
        ]);
    }

    private function notifySupervisors(string $type, int $relatedId, string $message): void
    {
        User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'supervisor'))
            ->get(['id'])
            ->each(fn ($supervisor) => $this->notifyUser((int) $supervisor->id, 'supervisor', $type, $relatedId, $message));
    }

    private function notifyUser(int $userId, string $recipientRole, string $type, int $relatedId, string $message): void
    {
        UserNotification::create([
            'user_id' => $userId,
            'recipient_role' => $recipientRole,
            'type' => $type,
            'module' => 'request',
            'related_id' => $relatedId,
            'message' => $message,
            'is_read' => false,
        ]);

        $recipient = User::query()->find($userId);
        EmailNotifier::sendToUser($recipient, 'CMMS Notification', $message);
    }
}
