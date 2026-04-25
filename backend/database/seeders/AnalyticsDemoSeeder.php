<?php

namespace Database\Seeders;

use App\Models\Asset;
use App\Models\Building;
use App\Models\Category;
use App\Models\MaintenanceRequest;
use App\Models\Role;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class AnalyticsDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (MaintenanceRequest::query()->count() >= 25) {
            return;
        }

        $requesterRole = Role::query()->where('name', 'requester')->first();
        $technicianRole = Role::query()->where('name', 'technician')->first();

        $requesters = User::query()
            ->when($requesterRole, fn ($q) => $q->whereHas('roles', fn ($rq) => $rq->where('roles.id', $requesterRole->id)))
            ->get();
        $technicians = User::query()
            ->when($technicianRole, fn ($q) => $q->whereHas('roles', fn ($rq) => $rq->where('roles.id', $technicianRole->id)))
            ->get();
        $categories = Category::all();
        $buildings = Building::all();
        $assets = Asset::all();

        if ($requesters->isEmpty() || $categories->isEmpty() || $buildings->isEmpty()) {
            return;
        }

        $statuses = ['submitted', 'approved', 'assigned', 'in_progress', 'completed', 'rejected', 'closed'];
        $weights = [8, 10, 10, 12, 18, 6, 8];
        $priorityOptions = ['low', 'medium', 'high', 'urgent'];

        for ($i = 0; $i < 70; $i++) {
            $createdAt = Carbon::now()->subDays(rand(0, 180))->subHours(rand(0, 23));
            $status = $this->weightedPick($statuses, $weights);
            $priority = $priorityOptions[array_rand($priorityOptions)];

            $category = $categories->random();
            $building = $buildings->random();
            $buildingAssets = $assets->where('building_id', $building->id);
            $asset = $buildingAssets->isNotEmpty() ? $buildingAssets->random() : $assets->first();

            $slaHours = match ($priority) {
                'urgent' => 4,
                'high' => 12,
                'medium' => 24,
                default => 72,
            };
            $dueDate = $createdAt->copy()->addHours($slaHours);
            $isDone = in_array($status, ['completed', 'closed'], true);
            $candidateUpdatedAt = $createdAt->copy()->addHours(rand(1, 80));
            $updatedAt = $isDone
                ? $createdAt->copy()->addHours(rand(2, 120))
                : ($candidateUpdatedAt->lt(Carbon::now()) ? $candidateUpdatedAt : Carbon::now());

            $request = MaintenanceRequest::create([
                'requester_id' => $requesters->random()->id,
                'department_id' => $requesters->random()->dept_id,
                'title' => "Demo Issue #{$i} - {$category->name}",
                'description' => "Auto-generated analytics demo request for {$category->name}.",
                'category_id' => $category->id,
                'building_id' => $building->id,
                'room_id' => null,
                'custom_location' => null,
                'asset_id' => $asset?->id,
                'priority' => $priority,
                'status' => $status,
                'due_date' => $dueDate,
                'sla_hours' => $slaHours,
                'is_overdue' => !$isDone && $dueDate->lt(Carbon::now()),
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ]);

            if (in_array($status, ['assigned', 'in_progress', 'completed', 'closed'], true) && $technicians->isNotEmpty()) {
                $technician = $technicians->random();
                $workStatus = in_array($status, ['completed', 'closed'], true) ? 'completed' : ($status === 'in_progress' ? 'in_progress' : 'assigned');
                $completedAt = $workStatus === 'completed' ? $updatedAt : null;

                WorkOrder::create([
                    'request_id' => $request->id,
                    'created_by' => $technician->id,
                    'assigned_to' => $technician->id,
                    'priority' => $priority,
                    'scheduled_date' => $createdAt->toDateString(),
                    'scheduled_time' => null,
                    'estimated_hours' => rand(1, 8),
                    'work_status' => $workStatus,
                    'completed_at' => $completedAt,
                    'created_at' => $createdAt,
                    'updated_at' => $updatedAt,
                ]);
            }
        }
    }

    private function weightedPick(array $values, array $weights): string
    {
        $total = array_sum($weights);
        $rand = rand(1, $total);
        $running = 0;
        foreach ($values as $i => $value) {
            $running += $weights[$i];
            if ($rand <= $running) {
                return $value;
            }
        }
        return $values[0];
    }
}
