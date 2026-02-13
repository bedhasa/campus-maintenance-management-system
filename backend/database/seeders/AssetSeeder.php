<?php

namespace Database\Seeders;

use App\Models\Asset;
use App\Models\Building;
use App\Models\Category;
use App\Models\Room;
use Illuminate\Database\Seeder;

class AssetSeeder extends Seeder
{
    public function run(): void
    {
        $building = Building::first();
        $room = Room::first();
        $category = Category::first();

        if (!$building || !$room || !$category) {
            return;
        }

        $assets = [
            ['name' => 'Main Distribution Panel', 'serial_number' => 'ELEC-1001'],
            ['name' => 'Split AC Unit', 'serial_number' => 'HVAC-2001'],
            ['name' => 'Network Switch 24-Port', 'serial_number' => 'IT-3001'],
        ];

        foreach ($assets as $asset) {
            Asset::firstOrCreate(
                ['serial_number' => $asset['serial_number']],
                [
                    'name' => $asset['name'],
                    'category_id' => $category->id,
                    'building_id' => $building->id,
                    'room_id' => $room->id,
                    'status' => 'active',
                ]
            );
        }
    }
}

