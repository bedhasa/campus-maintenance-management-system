<?php

namespace App\Http\Controllers\Api;

use App\Models\MaintenanceRequest;
use App\Models\TechnicianRating;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RequesterFeedbackController extends ModuleController
{
    public function rate(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['requester', 'admin']);
        $ticket = MaintenanceRequest::query()->with('workOrders')->findOrFail($id);

        if (!$user->tokenCan('role:admin') && (int) $ticket->requester_id !== (int) $user->id) {
            return $this->forbidden();
        }

        if ($ticket->status !== 'closed') {
            return response()->json([
                'success' => false,
                'message' => 'Rating is allowed only after supervisor closure.',
            ], 422);
        }

        $validated = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $technicianId = $ticket->workOrders()->latest()->value('assigned_to');
        if (!$technicianId) {
            return response()->json([
                'success' => false,
                'message' => 'No technician assignment found for this request.',
            ], 422);
        }

        $rating = TechnicianRating::query()->updateOrCreate(
            ['request_id' => $ticket->id],
            [
                'technician_id' => $technicianId,
                'requester_id' => $user->id,
                'rating' => $validated['rating'],
                'comment' => $validated['comment'] ?? null,
                'created_at' => now(),
            ]
        );

        $tech = User::query()->find($technicianId);
        if ($tech) {
            $avg = TechnicianRating::query()->where('technician_id', $technicianId)->avg('rating');
            $count = TechnicianRating::query()->where('technician_id', $technicianId)->count();
            $tech->update([
                'avg_rating' => round((float) $avg, 2),
                'total_ratings' => $count,
            ]);

            UserNotification::create([
                'user_id' => $tech->id,
                'recipient_role' => 'technician',
                'type' => 'technician_feedback_received',
                'module' => 'work_order',
                'related_id' => $ticket->id,
                'message' => "You received a {$validated['rating']}/5 rating for Request #{$ticket->id}.",
                'is_read' => false,
            ]);
        }

        ActivityLogger::log($user->id, 'rating', 'submit', $ticket->id, "Rating submitted for request #{$ticket->id}.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Rating submitted.',
            'rating' => $rating,
        ]);
    }
}
