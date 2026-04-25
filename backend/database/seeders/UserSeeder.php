<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $departments = Department::all();
        if ($departments->isEmpty()) {
            return;
        }

        $roleRequester = Role::where('name', 'requester')->first();
        $roleTechnician = Role::where('name', 'technician')->first();
        $roleInventoryOfficer = Role::where('name', 'inventory_officer')->first();
        $roleSupervisor = Role::where('name', 'supervisor')->first();
        $roleAdmin = Role::where('name', 'admin')->first();

        $demoUsers = [
            [
                'fname' => 'Rita',
                'lname' => 'Requester',
                'username' => 'requester.demo',
                'email' => 'requester@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'U1001001',
                'dept_id' => $departments->first()->id,
                'phone' => '555-100-1001',
                'roles' => [$roleRequester],
            ],
            [
                'fname' => 'Theo',
                'lname' => 'Technician',
                'username' => 'technician.demo',
                'email' => 'technician@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'U1001002',
                'dept_id' => $departments->first()->id,
                'phone' => '555-100-1002',
                'roles' => [$roleTechnician],
            ],
            [
                'fname' => 'Bdio',
                'lname' => 'Inventory',
                'username' => 'bdio',
                'email' => 'bdio@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'U1001006',
                'dept_id' => $departments->first()->id,
                'phone' => '555-100-1006',
                'roles' => [$roleInventoryOfficer],
            ],
            [
                'fname' => 'Sofia',
                'lname' => 'Supervisor',
                'username' => 'supervisor.demo',
                'email' => 'supervisor@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'U1001003',
                'dept_id' => $departments->first()->id,
                'phone' => '555-100-1003',
                'roles' => [$roleSupervisor],
            ],
            [
                'fname' => 'Alex',
                'lname' => 'Multi',
                'username' => 'multi.demo',
                'email' => 'multi@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'U1001004',
                'dept_id' => $departments->first()->id,
                'phone' => '555-100-1004',
                'roles' => [$roleRequester, $roleTechnician],
            ],
            [
                'fname' => 'Sam',
                'lname' => 'OpsAdmin',
                'username' => 'opsadmin.demo',
                'email' => 'opsadmin@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'U1001005',
                'dept_id' => $departments->first()->id,
                'phone' => '555-100-1005',
                'roles' => [$roleSupervisor, $roleAdmin],
            ],
        ];

        foreach ($demoUsers as $data) {
            $roles = array_filter($data['roles']);
            unset($data['roles']);

            $user = User::firstOrCreate(['email' => $data['email']], $data);
            if (!empty($roles)) {
                $user->roles()->sync(collect($roles)->pluck('id')->all());
            }
        }

        User::factory()
            ->count(12)
            ->state(fn () => ['dept_id' => $departments->random()->id])
            ->create()
            ->each(function (User $user) use ($roleRequester, $roleTechnician, $roleInventoryOfficer, $roleSupervisor, $roleAdmin) {
                $roles = collect([$roleRequester, $roleTechnician, $roleInventoryOfficer, $roleSupervisor, $roleAdmin])
                    ->filter()
                    ->random(rand(1, 2))
                    ->pluck('id')
                    ->all();
                $user->roles()->sync($roles);
            });
    }
}
