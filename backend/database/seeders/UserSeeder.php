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

            // =====================
            // ADMIN + SUPERVISOR
            // =====================
            [
                'fname' => 'BEDASA',
                'lname' => 'NEGASH',
                'username' => 'admin.supervisor',
                'email' => 'admin@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'NaScR/0219/15',
                'dept_id' => $departments->random()->id,
                'phone' => '0911000001',
                'roles' => [$roleSupervisor, $roleAdmin],
            ],

            // =====================
            // REQUESTERS
            // =====================
            [
                'fname' => 'AYDA',
                'lname' => 'JEMAL',
                'username' => 'ayda.requester',
                'email' => 'ayda@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'NaScR/0203/15',
                'dept_id' => $departments->random()->id,
                'phone' => '0911000002',
                'roles' => [$roleRequester],
            ],
            [
                'fname' => 'HANA',
                'lname' => 'TESFAYE',
                'username' => 'hana.requester',
                'email' => 'hana@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'NaScR/0456/15',
                'dept_id' => $departments->random()->id,
                'phone' => '0911000003',
                'roles' => [$roleRequester],
            ],

            // =====================
            // INVENTORY OFFICERS
            // =====================
            [
                'fname' => 'KENENI',
                'lname' => 'GEMECHU',
                'username' => 'keneni.inventory',
                'email' => 'keneni@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'NaScR/0830/15',
                'dept_id' => $departments->random()->id,
                'phone' => '0911000004',
                'roles' => [$roleInventoryOfficer],
            ],

            // =====================
            // TECHNICIANS (MANY)
            // =====================
            [
                'fname' => 'ANAOL',
                'lname' => 'GEMEDO',
                'username' => 'anaol.tech',
                'email' => 'anaol@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'NaScR/0169/15',
                'dept_id' => $departments->random()->id,
                'phone' => '0911000005',
                'roles' => [$roleTechnician],
            ],
            [
                'fname' => 'ATEM',
                'lname' => 'FAYDU',
                'username' => 'daniel.tech',
                'email' => 'daniel@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'NaScR/0675/15',
                'dept_id' => $departments->random()->id,
                'phone' => '0911000006',
                'roles' => [$roleTechnician],
            ],
            [
                'fname' => 'BINIAM',
                'lname' => 'KASSA',
                'username' => 'biniam.tech',
                'email' => 'biniam@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'NaScR/0550/15',
                'dept_id' => $departments->random()->id,
                'phone' => '0911000007',
                'roles' => [$roleTechnician],
            ],
            [
                'fname' => 'MULUGETA',
                'lname' => 'HAILE',
                'username' => 'mulu.tech',
                'email' => 'mulu@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'NaScR/0888/15',
                'dept_id' => $departments->random()->id,
                'phone' => '0911000008',
                'roles' => [$roleTechnician],
            ],
            [
                'fname' => 'ABEBE',
                'lname' => 'KEBEDE',
                'username' => 'abebe.tech',
                'email' => 'abebe@demo.com',
                'password' => Hash::make('123456'),
                'university_id_number' => 'NaScR/0999/15',
                'dept_id' => $departments->random()->id,
                'phone' => '0911000009',
                'roles' => [$roleTechnician],
            ],
        ];

        foreach ($demoUsers as $data) {

            $roles = $data['roles'];
            unset($data['roles']);

            $user = User::firstOrCreate(
                ['email' => $data['email']],
                $data
            );

            if (!empty($roles)) {
                $user->roles()->sync(collect($roles)->pluck('id')->all());
            }
        }
    }
}