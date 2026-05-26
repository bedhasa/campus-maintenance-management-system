<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Electrical', 'description' => 'Power, lighting, and wiring issues.'],
            ['name' => 'Plumbing', 'description' => 'Leakage, drainage, and water system issues.'],
            ['name' => 'Construction', 'description' => 'Building structure, wall, ceiling, floor, roofing, and general construction-related maintenance issues.'],
            ['name' => 'Networking Issue (IT)', 'description' => 'Computers, printers, and network devices.'],
            ['name' => 'Furniture', 'description' => 'Desks, chairs, doors, and physical fittings.'],
        ];

        foreach ($categories as $category) {
            Category::firstOrCreate(['name' => $category['name']], $category);
        }
    }
}

