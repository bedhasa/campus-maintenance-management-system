<?php

namespace Database\Seeders;

use App\Models\Asset;
use App\Models\Building;
use App\Models\Category;
use App\Models\MaintenanceRequest;
use App\Models\RequestStatusLog;
use App\Models\Role;
use App\Models\Room;
use App\Models\SparePart;
use App\Models\Specialty;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Database\Seeder;

class EnterpriseModuleSeeder extends Seeder
{
    public function run(): void
    {
        $categories = Category::all();
        $assets = Asset::all();
        $buildings = Building::all();
        $rooms = Room::all();

        if ($categories->isEmpty()) {
            return;
        }

        /*
        |--------------------------------------------------------------------------
        | CREATE SPECIALTIES
        |--------------------------------------------------------------------------
        */

        foreach ($categories as $category) {

            Specialty::firstOrCreate(
                ['name' => $category->name . ' Technician'],
                [
                    'category_id' => $category->id,
                ]
            );
        }

        /*
        |--------------------------------------------------------------------------
        | ASSIGN SPECIALTIES TO TECHNICIANS
        |--------------------------------------------------------------------------
        */

        $technicianRole = Role::where('name', 'technician')->first();

        $technicians = User::query()
            ->when($technicianRole, function ($q) use ($technicianRole) {
                $q->whereHas('roles', function ($rq) use ($technicianRole) {
                    $rq->where('roles.id', $technicianRole->id);
                });
            })
            ->get();

        $specialties = Specialty::all();

        foreach ($technicians as $tech) {

            $randomSpecialties = $specialties
                ->random(min(2, $specialties->count()))
                ->pluck('id')
                ->all();

            $tech->specialties()->syncWithoutDetaching($randomSpecialties);
        }

        /*
        |--------------------------------------------------------------------------
        | SPARE PARTS
        |--------------------------------------------------------------------------
        */

        $sampleParts = [

            // ELECTRICAL
            [
                'name' => 'LED Bulb 18W',
                'part_code' => 'ELEC-001',
                'unit_price' => 180,
                'quantity_available' => 120,
                'minimum_stock' => 20,
            ],

            [
                'name' => 'Circuit Breaker 40A',
                'part_code' => 'ELEC-002',
                'unit_price' => 850,
                'quantity_available' => 30,
                'minimum_stock' => 5,
            ],

            [
                'name' => 'Electric Cable 2.5mm',
                'part_code' => 'ELEC-003',
                'unit_price' => 45,
                'quantity_available' => 500,
                'minimum_stock' => 100,
            ],

            // PLUMBING
            [
                'name' => 'PVC Pipe 1 inch',
                'part_code' => 'PLMB-001',
                'unit_price' => 250,
                'quantity_available' => 60,
                'minimum_stock' => 10,
            ],

            [
                'name' => 'Water Tap',
                'part_code' => 'PLMB-002',
                'unit_price' => 320,
                'quantity_available' => 25,
                'minimum_stock' => 5,
            ],

            // GENERATOR
            [
                'name' => 'Generator Oil Filter',
                'part_code' => 'GEN-001',
                'unit_price' => 1200,
                'quantity_available' => 15,
                'minimum_stock' => 3,
            ],

            [
                'name' => 'Generator Air Filter',
                'part_code' => 'GEN-002',
                'unit_price' => 950,
                'quantity_available' => 10,
                'minimum_stock' => 2,
            ],

            [
                'name' => 'Generator Battery',
                'part_code' => 'GEN-003',
                'unit_price' => 4500,
                'quantity_available' => 6,
                'minimum_stock' => 1,
            ],

            // NETWORKING
            [
                'name' => 'RJ45 Connector',
                'part_code' => 'NET-001',
                'unit_price' => 15,
                'quantity_available' => 300,
                'minimum_stock' => 50,
            ],

            [
                'name' => 'Cat6 Network Cable',
                'part_code' => 'NET-002',
                'unit_price' => 35,
                'quantity_available' => 400,
                'minimum_stock' => 100,
            ],

            [
                'name' => '24-Port Network Switch',
                'part_code' => 'NET-003',
                'unit_price' => 8500,
                'quantity_available' => 8,
                'minimum_stock' => 2,
            ],
        ];

        foreach ($sampleParts as $part) {

            SparePart::firstOrCreate(
                ['part_code' => $part['part_code']],
                $part
            );
        }

        /*
        |--------------------------------------------------------------------------
        | USERS
        |--------------------------------------------------------------------------
        */

        $requester = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'requester'))
            ->first();

        $supervisor = User::query()
            ->whereHas('roles', fn ($q) => $q->whereIn('name', ['supervisor', 'admin']))
            ->first();

        if (!$requester || !$supervisor || $technicians->isEmpty()) {
            return;
        }

        /*
        |--------------------------------------------------------------------------
        | REALISTIC MAINTENANCE REQUESTS
        |--------------------------------------------------------------------------
        */

        $requests = [

            [
                'title' => 'Water leakage in Dorm Block 3 bathroom',
                'description' => 'Continuous water leakage from broken pipe near student shower area.',
                'category' => 'Plumbing',
                'priority' => 'high',
                'status' => 'assigned',
            ],

            [
                'title' => 'No internet connection in Informatics Lab 2',
                'description' => 'Network connection lost for all desktop computers in Lab 2.',
                'category' => 'Networking Issue (IT)',
                'priority' => 'high',
                'status' => 'in_progress',
            ],

            [
                'title' => 'Classroom lights not working in Block A Room 203',
                'description' => 'Multiple ceiling lights are not functioning during night classes.',
                'category' => 'Electrical',
                'priority' => 'medium',
                'status' => 'assigned',
            ],

            [
                'title' => 'Broken student desk in Main Library',
                'description' => 'Several reading desks are damaged and unstable.',
                'category' => 'Furniture',
                'priority' => 'low',
                'status' => 'submitted',
            ],

            [
                'title' => 'Generator overheating during power interruption',
                'description' => 'Main campus generator overheats after 20 minutes of operation.',
                'category' => 'Electrical',
                'priority' => 'urgent',
                'status' => 'in_progress',
            ],

            [
                'title' => 'Cracked wall near Dorm Block 1 entrance',
                'description' => 'Visible wall crack expanding near student dormitory entrance.',
                'category' => 'Construction',
                'priority' => 'high',
                'status' => 'assigned',
            ],
        ];

        foreach ($requests as $item) {

            $category = Category::where('name', $item['category'])->first();

            if (!$category) {
                continue;
            }

            $building = $buildings->random();

            $room = $rooms
                ->where('building_id', $building->id)
                ->random();

            $asset = $assets->random();

            $technician = $technicians->random();

            $maintenance = MaintenanceRequest::firstOrCreate(

                [
                    'title' => $item['title'],
                ],

                [
                    'requester_id' => $requester->id,
                    'department_id' => $requester->dept_id,
                    'description' => $item['description'],
                    'category_id' => $category->id,
                    'building_id' => $building->id,
                    'room_id' => $room?->id,
                    'asset_id' => $asset?->id,
                    'priority' => $item['priority'],
                    'status' => $item['status'],
                    'sla_hours' => 8,
                    'due_date' => now()->addHours(8),
                    'is_overdue' => false,
                ]
            );

            /*
            |--------------------------------------------------------------------------
            | STATUS LOGS
            |--------------------------------------------------------------------------
            */

            RequestStatusLog::firstOrCreate(

                [
                    'request_id' => $maintenance->id,
                    'new_status' => $item['status'],
                ],

                [
                    'old_status' => 'pending',
                    'changed_by' => $supervisor->id,
                    'comment' => 'Assigned to maintenance team.',
                ]
            );

            /*
            |--------------------------------------------------------------------------
            | WORK ORDERS
            |--------------------------------------------------------------------------
            */

           WorkOrder::firstOrCreate(

    [
        'request_id' => $maintenance->id,
    ],

    [
        'created_by' => $supervisor->id,
        'assigned_to' => $technician->id,
        'priority' => $item['priority'],
        'scheduled_date' => now()->toDateString(),
        'estimated_hours' => rand(1, 5),

        'work_status' => match ($item['status']) {
            'submitted' => 'assigned',
            'approved' => 'assigned',
            'assigned' => 'assigned',
            'in_progress' => 'in_progress',
            'completed' => 'completed',
            default => 'assigned',
        },
    ]
);
        }
    }
}