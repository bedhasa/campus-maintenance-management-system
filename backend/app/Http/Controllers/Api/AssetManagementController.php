<?php

namespace App\Http\Controllers\Api;

use App\Models\Asset;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AssetManagementController extends ModuleController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:150'],
            'building_id' => ['nullable', 'integer', 'exists:buildings,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $query = Asset::query()
            ->with([
                'category:id,name',
                'building:id,name',
                'room:id,name,building_id',
            ])
            ->orderBy('name');

        if (!empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(function ($inner) use ($search) {
                $inner->where('name', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%");
            });
        }

        if (!empty($validated['building_id'])) {
            $query->where('building_id', $validated['building_id']);
        }

        if (!empty($validated['category_id'])) {
            $query->where('category_id', $validated['category_id']);
        }

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        return response()->json([
            'success' => true,
            'assets' => $query->get([
                'id',
                'name',
                'category_id',
                'building_id',
                'room_id',
                'serial_number',
                'status',
                'created_at',
                'updated_at',
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $validated = $this->validatePayload($request);

        $asset = Asset::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Asset created successfully.',
            'asset' => $asset->load([
                'category:id,name',
                'building:id,name',
                'room:id,name,building_id',
            ]),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $asset = Asset::query()->findOrFail($id);
        $validated = $this->validatePayload($request);
        $asset->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Asset updated successfully.',
            'asset' => $asset->fresh()->load([
                'category:id,name',
                'building:id,name',
                'room:id,name,building_id',
            ]),
        ]);
    }

    private function validatePayload(Request $request): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'building_id' => ['required', 'integer', 'exists:buildings,id'],
            'room_id' => ['required', 'integer', 'exists:rooms,id'],
            'serial_number' => ['nullable', 'string', 'max:100'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        $roomMatchesBuilding = Room::query()
            ->where('id', $validated['room_id'])
            ->where('building_id', $validated['building_id'])
            ->exists();

        if (!$roomMatchesBuilding) {
            throw ValidationException::withMessages([
                'room_id' => 'Selected room does not belong to the selected building.',
            ]);
        }

        return $validated;
    }
}
