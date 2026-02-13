<?php

namespace Database\Seeders;

use App\Models\Department;
use Illuminate\Database\Seeder;

class DepartmentSeeder extends Seeder
{
    public function run(): void
    {
        $departments = [
            ['name' => 'Facilities Management', 'faculty' => 'Operations'],
            ['name' => 'Information Technology', 'faculty' => 'Technology'],
            ['name' => 'Engineering Services', 'faculty' => 'Engineering'],
            ['name' => 'Administration', 'faculty' => 'Administration'],
            ['name' => 'Campus Safety', 'faculty' => 'Safety'],
        ];

        foreach ($departments as $department) {
            Department::firstOrCreate(
                ['name' => $department['name']],
                $department
            );
        }
    }
}
