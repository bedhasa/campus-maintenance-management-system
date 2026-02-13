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
            'Main Library' => ['101', '102', '201', '202'],
            'Engineering Block A' => ['A-01', 'A-02', 'A-101', 'A-102'],
            'ICT Center' => ['Lab-1', 'Lab-2', 'Server Room'],
            'Administration' => ['Reception', 'Office-1', 'Office-2'],
        ];

        foreach ($data as $buildingName => $rooms) {
            $building = Building::firstOrCreate(['name' => $buildingName]);

            foreach ($rooms as $roomName) {
                Room::firstOrCreate([
                    'building_id' => $building->id,
                    'name' => $roomName,
                ]);
            }
        }
    }
}

