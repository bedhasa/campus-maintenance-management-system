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
            ['name' => 'HVAC', 'description' => 'Heating, ventilation, and air-conditioning faults.'],
            ['name' => 'IT Equipment', 'description' => 'Computers, printers, and network devices.'],
            ['name' => 'Furniture', 'description' => 'Desks, chairs, doors, and physical fittings.'],
        ];

        foreach ($categories as $category) {
            Category::firstOrCreate(['name' => $category['name']], $category);
        }
    }
}

