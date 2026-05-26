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
        $library = Building::where('name', 'Main Library')->first();
        $informatics = Building::where('name', 'Informatics Building')->first();
        $dorm = Building::where('name', 'Block 1 Dorm')->first();

        $networkCategory = Category::where('name', 'Networking Issue (IT)')->first();
        $electricalCategory = Category::where('name', 'Electrical')->first();
        $furnitureCategory = Category::where('name', 'Furniture')->first();
        $constructionCategory = Category::where('name', 'Construction')->first();

        if (
            !$library || !$informatics || !$dorm ||
            !$networkCategory || !$electricalCategory
        ) {
            return;
        }

        $assets = [
            // Electrical Assets
            [
                'name' => 'Generator_1',
                'serial_number' => 'GEN-1001',
                'category_id' => $electricalCategory->id,
                'building_id' => $library->id,
            ],
            [
                'name' => 'Generator_2',
                'serial_number' => 'GEN-1002',
                'category_id' => $electricalCategory->id,
                'building_id' => $informatics->id,
            ],
            [
                'name' => 'Transformer_1',
                'serial_number' => 'TR-2001',
                'category_id' => $electricalCategory->id,
                'building_id' => $informatics->id,
            ],
            [
                'name' => 'Main Power Panel',
                'serial_number' => 'ELEC-3001',
                'category_id' => $electricalCategory->id,
                'building_id' => $library->id,
            ],

            // IT Assets
            [
                'name' => 'Cisco Network Switch',
                'serial_number' => 'IT-4001',
                'category_id' => $networkCategory->id,
                'building_id' => $informatics->id,
            ],
            [
                'name' => 'Dell Server',
                'serial_number' => 'IT-4002',
                'category_id' => $networkCategory->id,
                'building_id' => $informatics->id,
            ],
            [
                'name' => 'Computer Lab Projector',
                'serial_number' => 'IT-4003',
                'category_id' => $networkCategory->id,
                'building_id' => $informatics->id,
            ],

            // Furniture Assets
            [
                'name' => 'Library Reading Table',
                'serial_number' => 'FUR-5001',
                'category_id' => $furnitureCategory->id,
                'building_id' => $library->id,
            ],
            [
                'name' => 'Student Chair Set',
                'serial_number' => 'FUR-5002',
                'category_id' => $furnitureCategory->id,
                'building_id' => $dorm->id,
            ],

            // Construction Assets
            [
                'name' => 'Water Tank System',
                'serial_number' => 'CON-6001',
                'category_id' => $constructionCategory->id,
                'building_id' => $dorm->id,
            ],
            
        ];

        foreach ($assets as $asset) {

            $room = Room::where('building_id', $asset['building_id'])->first();

            Asset::firstOrCreate(
                ['serial_number' => $asset['serial_number']],
                [
                    'name' => $asset['name'],
                    'category_id' => $asset['category_id'],
                    'building_id' => $asset['building_id'],
                    'room_id' => $room?->id,
                    'status' => 'active',
                ]
            );
        }
    }
}