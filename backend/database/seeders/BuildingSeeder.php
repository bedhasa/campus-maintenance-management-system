<?php

namespace Database\Seeders;

use App\Models\Building;
use App\Models\Room;
use Illuminate\Database\Seeder;

class BuildingSeeder extends Seeder
{
    public function run(): void
    {
        $data = [
            'Main Library' => [
                'Reading Room 1',
                'Reading Room 2',
                'Computer Lab',
                'Staff Office'
            ],

            'Informatics Building' => [
                'Lab-1',
                'Lab-2',
                'Network Room',
                'Classroom-101',
                'Classroom-102'
            ],

            'Block 1 Dorm' => [],
        ];

        // Create buildings and normal rooms
        foreach ($data as $buildingName => $rooms) {
            $building = Building::firstOrCreate([
                'name' => $buildingName
            ]);

            foreach ($rooms as $roomName) {
                Room::firstOrCreate([
                    'building_id' => $building->id,
                    'name' => $roomName,
                ]);
            }
        }

        // Generate Dorm_1 to Dorm_415
        $dormBuilding = Building::where('name', 'Block 1 Dorm')->first();

        for ($i = 1; $i <= 415; $i++) {
            Room::firstOrCreate([
                'building_id' => $dormBuilding->id,
                'name' => 'Dorm_' . $i,
            ]);
        }
    }
}