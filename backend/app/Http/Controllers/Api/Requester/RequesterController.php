<?php

namespace App\Http\Controllers\Api\Requester;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RequesterController extends Controller
{
    protected function requester(Request $request): User
    {
        $user = $request->user();

        if (!$user || (!$user->tokenCan('role:requester') && !$user->tokenCan('role:admin'))) {
            abort(403, 'Requester role is required.');
        }

        return $user;
    }

    protected function forbidden(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'You are not allowed to access this request.',
        ], 403);
    }
}

