<?php

namespace App\Http\Controllers\Api\Requester;

use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends RequesterController
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->requester($request);

        return response()->json([
            'success' => true,
            'notifications' => UserNotification::query()
                ->where('user_id', $user->id)
                ->latest()
                ->paginate(20),
        ]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $user = $this->requester($request);
        $notification = UserNotification::findOrFail($id);

        if ((int) $notification->user_id !== (int) $user->id) {
            return $this->forbidden();
        }

        $notification->update(['is_read' => true]);

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read.',
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $this->requester($request);

        UserNotification::query()
            ->where('user_id', $user->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read.',
        ]);
    }
}

