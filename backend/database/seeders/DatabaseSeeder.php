<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            DepartmentSeeder::class,
            RoleSeeder::class,
            BuildingSeeder::class,
            CategorySeeder::class,
            AssetSeeder::class,
            UserSeeder::class,
            EnterpriseModuleSeeder::class,
        ]);
    }
}
