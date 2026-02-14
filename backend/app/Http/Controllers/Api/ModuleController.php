<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\RoleGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ModuleController extends Controller
{
    protected function authorizeRoles(Request $request, array $roles): User
    {
        return RoleGuard::authorize($request, $roles);
    }

    protected function forbidden(string $message = 'You are not authorized to perform this action.'): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], 403);
    }
}

