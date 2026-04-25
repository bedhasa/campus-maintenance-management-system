<?php

namespace App\Http\Controllers\Api\Requester;

use App\Models\MaintenanceRequest;
use App\Models\RequestImage;
use App\Models\RequestMessage;
use App\Models\RequestStatusLog;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class MaintenanceRequestController extends RequesterController
{
    public function dashboard(Request $request): JsonResponse
    {
        $user = $this->requester($request);

        $base = MaintenanceRequest::query()->where('requester_id', $user->id);

        return response()->json([
            'success' => true,
            'summary' => [
                'total' => (clone $base)->count(),
                'submitted' => (clone $base)->where('status', 'submitted')->count(),
                'in_progress' => (clone $base)->whereIn('status', ['approved', 'assigned', 'in_progress'])->count(),
                'completed' => (clone $base)->where('status', 'completed')->count(),
                'rejected' => (clone $base)->where('status', 'rejected')->count(),
                'closed' => (clone $base)->where('status', 'closed')->count(),
            ],
            'recent_requests' => MaintenanceRequest::query()
                ->where('requester_id', $user->id)
                ->with(['category:id,name', 'building:id,name', 'room:id,name'])
                ->latest()
                ->limit(5)
                ->get(),
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
            ->with(['category:id,name', 'building:id,name', 'room:id,name', 'asset:id,name'])
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

        User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'supervisor'))
            ->get(['id'])
            ->each(fn ($supervisor) => UserNotification::create([
                'user_id' => $supervisor->id,
                'recipient_role' => 'supervisor',
                'type' => 'request_submitted',
                'module' => 'request',
                'related_id' => $ticket->id,
                'message' => "A new maintenance request #{$this->requestCode($ticket->id)} requires your review.",
                'is_read' => false,
            ]));

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

        if (!in_array($ticket->status, ['submitted', 'rejected'], true)) {
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

        $ticket->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Request updated.',
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
            $ticket->update(['status' => 'closed']);

            RequestStatusLog::create([
                'request_id' => $ticket->id,
                'changed_by' => $user->id,
                'old_status' => $oldStatus,
                'new_status' => 'closed',
                'comment' => 'Requester verified completion and closed request.',
            ]);

            if ($latestWorkOrder?->assigned_to) {
                $this->notifyUser(
                    (int) $latestWorkOrder->assigned_to,
                    'technician',
                    'request_closed',
                    $ticket->id,
                    "Request #{$requestCode} has been accepted and closed by the requester."
                );
            }

            $this->notifySupervisors(
                'request_closed',
                $ticket->id,
                "Request #{$requestCode} has been successfully closed."
            );

            ActivityLogger::log($user->id, 'request_lifecycle', 'close', $ticket->id, "Requester closed Request #{$ticket->id}.", $request);

            return response()->json([
                'success' => true,
                'message' => 'Request accepted and closed.',
            ]);
        }

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

        ActivityLogger::log($user->id, 'request_lifecycle', 'reopen', $ticket->id, "Requester reopened Request #{$ticket->id}.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Request reopened for additional work.',
        ]);
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
    }
}
