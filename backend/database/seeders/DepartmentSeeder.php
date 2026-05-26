<?php

namespace Database\Seeders;

use App\Models\Department;
use Illuminate\Database\Seeder;

class DepartmentSeeder extends Seeder
{
    public function run(): void
    {
        $departments = [
            ['name' => 'Information Systems', 'faculty' => 'Faculty of Informatics'],
            ['name' => 'Information Technology', 'faculty' => 'Faculty of Informatics'],
            ['name' => 'Computer Science', 'faculty' => 'Faculty of Informatics'],

            ['name' => 'Electrical Engineering', 'faculty' => 'Faculty of Electrical Engineering'],
            ['name' => 'Biomedical Engineering', 'faculty' => 'Faculty of Electrical Engineering'],

            ['name' => 'Administration', 'faculty' => 'Administration'],
        ];

        foreach ($departments as $department) {
            Department::firstOrCreate(
                ['name' => $department['name']],
                $department
            );
        }
    }
}