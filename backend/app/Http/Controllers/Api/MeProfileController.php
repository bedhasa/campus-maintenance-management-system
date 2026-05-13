<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class MeProfileController extends ModuleController
{
    private function profilePictureUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }
        $url = Storage::disk('public')->url($path);
        return str_starts_with($url, 'http') ? $url : url($url);
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->load(['department:id,name,faculty', 'roles:id,name,description', 'specialties:id,name']);
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
                'profile_picture_url' => $this->profilePictureUrl($user->profile_picture),
                'avg_rating' => (float) ($user->avg_rating ?? 0),
                'total_ratings' => (int) ($user->total_ratings ?? 0),
                'department' => $user->department,
                'roles' => $user->roles,
                'specialties' => $user->specialties,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'fname' => ['sometimes', 'string', 'max:255'],
            'lname' => ['sometimes', 'string', 'max:255'],
            'username' => ['sometimes', 'string', 'max:255', Rule::unique('users', 'username')->ignore($user->id)],
            'phone' => ['sometimes', 'string', 'max:50'],
            'profile_picture' => ['sometimes', 'image', 'max:4096', 'mimes:jpg,jpeg,png,webp'],
        ]);

        if ($request->hasFile('profile_picture')) {
            if ($user->profile_picture) {
                Storage::disk('public')->delete($user->profile_picture);
            }
            $validated['profile_picture'] = $request->file('profile_picture')->store('profile-pictures', 'public');
        }

        $user->update($validated);

        return $this->show($request);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $user = $request->user();
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

        $user->update(['password' => Hash::make($validated['password'])]);
        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully.',
        ]);
    }
}
