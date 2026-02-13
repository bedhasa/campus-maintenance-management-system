<?php

namespace App\Http\Controllers\Api\Requester;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ProfileController extends RequesterController
{
    public function show(Request $request): JsonResponse
    {
        $user = $this->requester($request)->load(['department:id,name,faculty', 'roles:id,name,description']);

        return response()->json([
            'success' => true,
            'profile' => [
                'id' => $user->id,
                'fname' => $user->fname,
                'lname' => $user->lname,
                'username' => $user->username,
                'email' => $user->email,
                'university_id_number' => $user->university_id_number,
                'phone' => $user->phone,
                'department' => $user->department,
                'roles' => $user->roles,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $this->requester($request);

        $validated = $request->validate([
            'fname' => ['sometimes', 'string', 'max:255'],
            'lname' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'string', 'max:50'],
        ]);

        $user->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $user = $this->requester($request);

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Current password is incorrect.',
            ], 422);
        }

        $user->update([
            'password' => Hash::make($validated['password']),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully.',
        ]);
    }
}

