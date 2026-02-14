<?php

namespace App\Http\Controllers\Api\Requester;

use App\Models\Room;
use App\Models\UserSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends RequesterController
{
    private function defaultSettings(): array
    {
        return [
            'language' => 'en',
            'dark_mode' => false,
            'font_size' => 'medium',
            'notify_status' => true,
            'notify_chat' => true,
            'notify_feedback' => true,
            'default_building_id' => null,
            'default_room_id' => null,
            'timezone' => 'Africa/Addis_Ababa',
        ];
    }

    private function payload(UserSetting $setting): array
    {
        return [
            'language' => $setting->language,
            'dark_mode' => (bool) $setting->dark_mode,
            'font_size' => $setting->font_size,
            'notifications' => [
                'status' => (bool) $setting->notify_status,
                'chat' => (bool) $setting->notify_chat,
                'feedback' => (bool) $setting->notify_feedback,
            ],
            'default_location' => [
                'building_id' => $setting->default_building_id,
                'building_name' => $setting->defaultBuilding?->name,
                'room_id' => $setting->default_room_id,
                'room_name' => $setting->defaultRoom?->name,
            ],
            'timezone' => $setting->timezone,
        ];
    }

    public function show(Request $request): JsonResponse
    {
        $user = $this->requester($request);

        $setting = UserSetting::query()->firstOrCreate(
            ['user_id' => $user->id],
            $this->defaultSettings()
        );
        $setting->load(['defaultBuilding:id,name', 'defaultRoom:id,name,building_id']);

        return response()->json([
            'success' => true,
            'settings' => $this->payload($setting),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $this->requester($request);

        $validated = $request->validate([
            'language' => ['sometimes', 'in:en,am'],
            'dark_mode' => ['sometimes', 'boolean'],
            'font_size' => ['sometimes', 'in:small,medium,large'],
            'notifications' => ['sometimes', 'array'],
            'notifications.status' => ['sometimes', 'boolean'],
            'notifications.chat' => ['sometimes', 'boolean'],
            'notifications.feedback' => ['sometimes', 'boolean'],
            'default_location' => ['sometimes', 'array'],
            'default_location.building_id' => ['nullable', 'integer', 'exists:buildings,id'],
            'default_location.room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'timezone' => ['sometimes', 'string', 'max:64'],
        ]);

        $setting = UserSetting::query()->firstOrCreate(
            ['user_id' => $user->id],
            $this->defaultSettings()
        );

        $updates = [];
        if (array_key_exists('language', $validated)) {
            $updates['language'] = $validated['language'];
        }
        if (array_key_exists('dark_mode', $validated)) {
            $updates['dark_mode'] = (bool) $validated['dark_mode'];
        }
        if (array_key_exists('font_size', $validated)) {
            $updates['font_size'] = $validated['font_size'];
        }
        if (!empty($validated['notifications'])) {
            if (array_key_exists('status', $validated['notifications'])) {
                $updates['notify_status'] = (bool) $validated['notifications']['status'];
            }
            if (array_key_exists('chat', $validated['notifications'])) {
                $updates['notify_chat'] = (bool) $validated['notifications']['chat'];
            }
            if (array_key_exists('feedback', $validated['notifications'])) {
                $updates['notify_feedback'] = (bool) $validated['notifications']['feedback'];
            }
        }
        if (!empty($validated['default_location']) || array_key_exists('default_location', $validated)) {
            $buildingId = $validated['default_location']['building_id'] ?? null;
            $roomId = $validated['default_location']['room_id'] ?? null;

            if ($roomId) {
                $room = Room::query()->find($roomId);
                if (!$room) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Selected room was not found.',
                    ], 422);
                }
                if ($buildingId && (int) $room->building_id !== (int) $buildingId) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Selected room does not belong to selected building.',
                    ], 422);
                }
                if (!$buildingId) {
                    $buildingId = (int) $room->building_id;
                }
            }

            $updates['default_building_id'] = $buildingId;
            $updates['default_room_id'] = $roomId;
        }
        if (array_key_exists('timezone', $validated)) {
            $updates['timezone'] = $validated['timezone'];
        }

        if (!empty($updates)) {
            $setting->update($updates);
        }

        $setting->refresh()->load(['defaultBuilding:id,name', 'defaultRoom:id,name,building_id']);

        return response()->json([
            'success' => true,
            'message' => 'Settings updated successfully.',
            'settings' => $this->payload($setting),
        ]);
    }
}

