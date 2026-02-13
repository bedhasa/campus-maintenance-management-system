<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'requester', 'description' => 'Creates and tracks maintenance requests.'],
            ['name' => 'technician', 'description' => 'Handles assigned maintenance work orders.'],
            ['name' => 'supervisor', 'description' => 'Oversees technicians and approvals.'],
            ['name' => 'admin', 'description' => 'Manages system configuration and users.'],
        ];

        foreach ($roles as $role) {
            Role::firstOrCreate(
                ['name' => $role['name']],
                $role
            );
        }
    }
}
