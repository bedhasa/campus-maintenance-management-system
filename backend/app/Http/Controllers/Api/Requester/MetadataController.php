<?php

namespace App\Http\Controllers\Api\Requester;

use App\Models\Asset;
use App\Models\Building;
use App\Models\Category;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MetadataController extends RequesterController
{
    public function buildings(Request $request): JsonResponse
    {
        $this->requester($request);

        return response()->json([
            'success' => true,
            'buildings' => Building::query()
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    public function rooms(Request $request): JsonResponse
    {
        $this->requester($request);

        $validated = $request->validate([
            'building_id' => ['nullable', 'integer', 'exists:buildings,id'],
        ]);

        $query = Room::query()->orderBy('name');
        if (!empty($validated['building_id'])) {
            $query->where('building_id', $validated['building_id']);
        }

        return response()->json([
            'success' => true,
            'rooms' => $query->get(['id', 'building_id', 'name']),
        ]);
    }

    public function categories(Request $request): JsonResponse
    {
        $this->requester($request);

        return response()->json([
            'success' => true,
            'categories' => Category::query()
                ->orderBy('name')
                ->get(['id', 'name', 'description']),
        ]);
    }

    public function assets(Request $request): JsonResponse
    {
        $this->requester($request);

        $validated = $request->validate([
            'building_id' => ['nullable', 'integer', 'exists:buildings,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
        ]);

        $query = Asset::query()
            ->where('status', 'active')
            ->with(['category:id,name', 'building:id,name', 'room:id,name'])
            ->orderBy('name');

        if (!empty($validated['building_id'])) {
            $query->where('building_id', $validated['building_id']);
        }
        if (!empty($validated['room_id'])) {
            $query->where('room_id', $validated['room_id']);
        }
        if (!empty($validated['category_id'])) {
            $query->where('category_id', $validated['category_id']);
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
            ]),
        ]);
    }
}

