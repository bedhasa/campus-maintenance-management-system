<?php

namespace App\Http\Controllers\Api;

use App\Models\Asset;
use App\Models\Building;
use App\Models\Department;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AssetManagementController extends ModuleController
{
    public function listBuildings(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        return response()->json([
            'success' => true,
            'buildings' => Building::query()->orderBy('name')->get(['id', 'name', 'created_at']),
        ]);
    }

    public function storeBuilding(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:buildings,name'],
        ]);

        $building = Building::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Building registered successfully.',
            'building' => $building,
        ], 201);
    }

    public function updateBuilding(Request $request, int $id): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $building = Building::query()->findOrFail($id);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:buildings,name,' . $building->id],
        ]);

        $building->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Building updated successfully.',
            'building' => $building->fresh(),
        ]);
    }

    public function listDepartments(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        return response()->json([
            'success' => true,
            'departments' => Department::query()->orderBy('name')->get(['id', 'name', 'faculty', 'created_at']),
        ]);
    }

    public function storeDepartment(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'faculty' => ['required', 'string', 'max:255'],
        ]);

        $department = Department::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Department registered successfully.',
            'department' => $department,
        ], 201);
    }

    public function updateDepartment(Request $request, int $id): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $department = Department::query()->findOrFail($id);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'faculty' => ['required', 'string', 'max:255'],
        ]);

        $department->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Department updated successfully.',
            'department' => $department->fresh(),
        ]);
    }

    public function listRooms(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $validated = $request->validate([
            'building_id' => ['nullable', 'integer', 'exists:buildings,id'],
        ]);

        $query = Room::query()
            ->with(['building:id,name'])
            ->orderBy('building_id')
            ->orderBy('name');

        if (!empty($validated['building_id'])) {
            $query->where('building_id', $validated['building_id']);
        }

        return response()->json([
            'success' => true,
            'rooms' => $query->get(['id', 'building_id', 'name', 'created_at']),
        ]);
    }

    public function storeRoom(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $validated = $request->validate([
            'building_id' => ['required', 'integer', 'exists:buildings,id'],
            'name' => ['required', 'string', 'max:50'],
        ]);

        $exists = Room::query()
            ->where('building_id', $validated['building_id'])
            ->where('name', $validated['name'])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'name' => 'This room already exists in the selected building.',
            ]);
        }

        $room = Room::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Room registered successfully.',
            'room' => $room->load(['building:id,name']),
        ], 201);
    }

    public function updateRoom(Request $request, int $id): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $room = Room::query()->findOrFail($id);
        $validated = $request->validate([
            'building_id' => ['required', 'integer', 'exists:buildings,id'],
            'name' => ['required', 'string', 'max:50'],
        ]);

        $exists = Room::query()
            ->where('building_id', $validated['building_id'])
            ->where('name', $validated['name'])
            ->where('id', '!=', $room->id)
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'name' => 'This room already exists in the selected building.',
            ]);
        }

        $room->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Room updated successfully.',
            'room' => $room->fresh()->load(['building:id,name']),
        ]);
    }

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
                'image_path',
                'created_at',
                'updated_at',
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['supervisor', 'admin']);

        $validated = $this->validatePayload($request);

        if ($request->hasFile('image')) {
            $validated['image_path'] = $request->file('image')->store('asset-images', 'public');
        }

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
        $validated = $this->validatePayload($request, true);

        if ($request->hasFile('image')) {
            $validated['image_path'] = $request->file('image')->store('asset-images', 'public');
        }

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

    private function validatePayload(Request $request, bool $isUpdate = false): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'building_id' => ['required', 'integer', 'exists:buildings,id'],
            'room_id' => ['required', 'integer', 'exists:rooms,id'],
            'serial_number' => ['nullable', 'string', 'max:100'],
            'status' => ['required', 'in:active,inactive'],
            'image' => ['nullable', 'image', 'max:4096'],
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
