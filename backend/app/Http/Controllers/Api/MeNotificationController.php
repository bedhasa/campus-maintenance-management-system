<?php

namespace App\Http\Controllers\Api;

use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeNotificationController extends ModuleController
{
    private function activeRole(Request $request): ?string
    {
        $abilities = $request->user()?->currentAccessToken()?->abilities ?? [];
        foreach ($abilities as $ability) {
            if (str_starts_with($ability, 'role:') && $ability !== 'role:select') {
                return str_replace('role:', '', $ability);
            }
        }

        return null;
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $this->activeRole($request);

        $notifications = UserNotification::query()
            ->where(function ($q) use ($user, $role) {
                $q->where('user_id', $user->id);
                if ($role) {
                    $q->orWhere(function ($inner) use ($role) {
                        $inner->whereNull('user_id')
                            ->where('recipient_role', $role);
                    });
                }
            })
            ->latest()
            ->paginate(20);

        return response()->json([
            'success' => true,
            'notifications' => $notifications,
        ]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $notification = UserNotification::query()->findOrFail($id);
        if ((int) $notification->user_id !== (int) $user->id) {
            return $this->forbidden();
        }

        $notification->update(['is_read' => true]);
        return response()->json(['success' => true]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();
        UserNotification::query()->where('user_id', $user->id)->where('is_read', false)->update(['is_read' => true]);
        return response()->json(['success' => true]);
    }
}
