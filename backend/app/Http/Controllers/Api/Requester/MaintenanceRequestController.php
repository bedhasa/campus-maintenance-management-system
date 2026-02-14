<?php

namespace App\Http\Controllers\Api\Requester;

use App\Models\MaintenanceRequest;
use App\Models\RequestImage;
use App\Models\RequestMessage;
use App\Models\RequestStatusLog;
use App\Models\UserNotification;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
                'requester:id,fname,lname,phone,email',
                'category:id,name',
                'building:id,name',
                'room:id,name',
                'asset:id,name',
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
            ])
            ->findOrFail($id);

        if ($ticket->requester_id !== $user->id) {
            return $this->forbidden();
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
            'message' => "Request #{$ticket->id} submitted successfully.",
            'is_read' => false,
        ]);

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
        if ($message->created_at?->diffInMinutes(now()) > 5) {
            return response()->json([
                'success' => false,
                'message' => 'You can edit messages only within 5 minutes of sending.',
            ], 422);
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
        if ($message->created_at?->diffInMinutes(now()) > 5) {
            return response()->json([
                'success' => false,
                'message' => 'You can delete messages only within 5 minutes of sending.',
            ], 422);
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
}
