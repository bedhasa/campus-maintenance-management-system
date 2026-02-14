<?php

namespace Database\Seeders;

use App\Models\MaintenanceRequest;
use App\Models\PreventiveMaintenancePlan;
use App\Models\RequestStatusLog;
use App\Models\Role;
use App\Models\SparePart;
use App\Models\Specialty;
use App\Models\SystemActivityLog;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Database\Seeder;

class EnterpriseModuleSeeder extends Seeder
{
    public function run(): void
    {
        $categories = \App\Models\Category::all();
        $assets = \App\Models\Asset::all();
        $buildings = \App\Models\Building::all();
        $rooms = \App\Models\Room::all();

        if ($categories->isEmpty()) {
            return;
        }

        foreach ($categories as $category) {
            Specialty::firstOrCreate([
                'name' => $category->name . ' Technician',
                'category_id' => $category->id,
            ]);
        }

        $technicianRole = Role::query()->where('name', 'technician')->first();
        $technicians = User::query()
            ->when($technicianRole, fn ($q) => $q->whereHas('roles', fn ($rq) => $rq->where('roles.id', $technicianRole->id)))
            ->get();
        $specialties = Specialty::all();
        foreach ($technicians as $tech) {
            $pick = $specialties->random(min(2, max(1, $specialties->count())))->pluck('id')->all();
            $tech->specialties()->syncWithoutDetaching($pick);
        }

        $sampleParts = [
            ['name' => 'Circuit Breaker', 'part_code' => 'SP-CB-001', 'unit_price' => 35.00, 'quantity_available' => 120, 'minimum_stock' => 20],
            ['name' => 'PVC Pipe 1 inch', 'part_code' => 'SP-PVC-001', 'unit_price' => 12.50, 'quantity_available' => 200, 'minimum_stock' => 30],
            ['name' => 'HVAC Filter', 'part_code' => 'SP-HVAC-001', 'unit_price' => 25.00, 'quantity_available' => 90, 'minimum_stock' => 15],
        ];
        foreach ($sampleParts as $part) {
            SparePart::firstOrCreate(['part_code' => $part['part_code']], $part);
        }

        $requester = User::query()->whereHas('roles', fn ($q) => $q->where('name', 'requester'))->first();
        $supervisor = User::query()->whereHas('roles', fn ($q) => $q->whereIn('name', ['supervisor', 'admin']))->first();
        $technician = $technicians->first();

        if (!$requester || !$supervisor || !$technician) {
            return;
        }

        $category = $categories->first();
        $building = $buildings->first();
        $room = $rooms->where('building_id', $building?->id)->first();
        $asset = $assets->first();

        $maintenance = MaintenanceRequest::firstOrCreate(
            ['title' => 'Demo Electrical Fault', 'requester_id' => $requester->id],
            [
                'department_id' => $requester->dept_id,
                'description' => 'Lights flickering in corridor section A.',
                'category_id' => $category->id,
                'building_id' => $building?->id,
                'room_id' => $room?->id,
                'asset_id' => $asset?->id,
                'priority' => 'high',
                'status' => 'assigned',
                'sla_hours' => 8,
                'due_date' => now()->addHours(8),
                'is_overdue' => false,
            ]
        );

        RequestStatusLog::firstOrCreate([
            'request_id' => $maintenance->id,
            'new_status' => 'assigned',
            'changed_by' => $supervisor->id,
        ], [
            'old_status' => 'approved',
            'comment' => 'Seeded assignment log.',
        ]);

        WorkOrder::firstOrCreate(
            ['request_id' => $maintenance->id],
            [
                'created_by' => $supervisor->id,
                'assigned_to' => $technician->id,
                'priority' => 'high',
                'scheduled_date' => now()->toDateString(),
                'estimated_hours' => 2,
                'work_status' => 'assigned',
            ]
        );

        PreventiveMaintenancePlan::firstOrCreate(
            ['title' => 'Monthly Generator Inspection'],
            [
                'description' => 'Routine generator preventive inspection.',
                'asset_id' => $asset?->id,
                'category_id' => $category->id,
                'frequency_type' => 'monthly',
                'frequency_interval' => 1,
                'next_due_date' => now()->addDays(5)->toDateString(),
                'priority' => 'medium',
                'estimated_hours' => 3,
                'assigned_technician_id' => $technician->id,
                'created_by' => $supervisor->id,
                'status' => 'active',
            ]
        );

        SystemActivityLog::firstOrCreate([
            'module' => 'seed',
            'action' => 'bootstrap',
            'reference_id' => $maintenance->id,
        ], [
            'user_id' => $supervisor->id,
            'description' => 'Seeded enterprise module demo data.',
            'ip_address' => '127.0.0.1',
            'created_at' => now(),
        ]);
    }
}

