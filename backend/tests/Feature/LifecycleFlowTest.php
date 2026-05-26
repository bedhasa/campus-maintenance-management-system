<?php

namespace Tests\Feature;

use App\Models\Building;
use App\Models\Category;
use App\Models\Department;
use App\Models\MaintenanceRequest;
use App\Models\PartIssue;
use App\Models\PartRequest;
use App\Models\Role;
use App\Models\Room;
use App\Models\SparePart;
use App\Models\Specialty;
use App\Models\TechnicianRating;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LifecycleFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_request_to_supervisor_to_technician_lifecycle_creates_expected_notifications_and_status_changes(): void
    {
        $fixtures = $this->createCoreFixtures();
        $requester = $fixtures['requester'];
        $supervisor = $fixtures['supervisor'];
        $technician = $fixtures['technician'];
        $inventoryOfficer = $fixtures['inventory_officer'];
        $category = $fixtures['category'];
        $part = $fixtures['part'];

        Sanctum::actingAs($requester, ['role:requester']);
        $submitResponse = $this->postJson('/api/requester/requests', [
            'title' => 'Air conditioner not cooling',
            'description' => 'The office AC is blowing warm air.',
            'category_id' => $category->id,
            'building_id' => $fixtures['building']->id,
            'room_id' => $fixtures['room']->id,
            'priority' => 'high',
        ]);

        $submitResponse->assertCreated();
        $requestId = (int) $submitResponse->json('request.id');

        $this->assertDatabaseHas('maintenance_requests', [
            'id' => $requestId,
            'requester_id' => $requester->id,
            'status' => 'submitted',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $requester->id,
            'type' => 'request_submitted',
            'related_id' => $requestId,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $supervisor->id,
            'type' => 'request_submitted',
            'related_id' => $requestId,
        ]);

        Sanctum::actingAs($supervisor, ['role:supervisor']);
        $reviewResponse = $this->patchJson("/api/supervisor/requests/{$requestId}/review", [
            'action' => 'approve',
            'priority' => 'high',
            'comment' => 'Approved for assignment.',
        ]);

        $reviewResponse->assertOk();
        $this->assertDatabaseHas('maintenance_requests', [
            'id' => $requestId,
            'status' => 'approved',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $requester->id,
            'type' => 'request_approved',
            'related_id' => $requestId,
        ]);

        $assignResponse = $this->patchJson("/api/supervisor/requests/{$requestId}/assign", [
            'assigned_to' => $technician->id,
            'estimated_hours' => 2,
            'priority' => 'high',
        ]);

        $assignResponse->assertOk();
        $workOrderId = (int) $assignResponse->json('work_order.id');

        $this->assertDatabaseHas('work_orders', [
            'id' => $workOrderId,
            'request_id' => $requestId,
            'assigned_to' => $technician->id,
            'work_status' => 'assigned',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $technician->id,
            'type' => 'work_order_assigned',
            'related_id' => $requestId,
        ]);

        Sanctum::actingAs($technician, ['role:technician']);
        $this->patchJson("/api/technician/work-orders/{$workOrderId}/start")
            ->assertOk();

        $this->assertDatabaseHas('work_orders', [
            'id' => $workOrderId,
            'work_status' => 'in_progress',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $requester->id,
            'type' => 'request_in_progress',
            'related_id' => $requestId,
        ]);

        $pauseResponse = $this->patchJson("/api/technician/work-orders/{$workOrderId}/pause", [
            'pause_reason' => 'Waiting for safe access to ceiling panel.',
        ]);

        $pauseResponse->assertOk();

        $this->assertDatabaseHas('work_orders', [
            'id' => $workOrderId,
            'work_status' => 'paused',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $supervisor->id,
            'type' => 'request_paused',
            'related_id' => $requestId,
        ]);

        $this->patchJson("/api/technician/work-orders/{$workOrderId}/start")
            ->assertOk();

        $this->assertDatabaseHas('work_orders', [
            'id' => $workOrderId,
            'work_status' => 'in_progress',
        ]);

        $completeResponse = $this->patchJson("/api/technician/work-orders/{$workOrderId}/complete", [
            'resolution_summary' => 'Checked filters and replaced the damaged fan belt.',
            'completion_note' => 'Checked filters and replaced the damaged fan belt.',
            'problem_found' => 'Fan belt was worn out.',
            'probable_cause' => 'Wear and Tear',
            'diagnostic_steps' => [
                'Verified blower operation and inspected belt condition.',
                'Confirmed tension loss and fraying on the drive belt.',
            ],
            'action_taken' => 'Replaced the belt and tested cooling cycle.',
        ]);

        $completeResponse->assertOk();
        $this->assertDatabaseHas('work_orders', [
            'id' => $workOrderId,
            'work_status' => 'completed',
        ]);
        $this->assertDatabaseHas('maintenance_requests', [
            'id' => $requestId,
            'status' => 'completed',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $supervisor->id,
            'type' => 'request_completed',
            'related_id' => $requestId,
        ]);

        Sanctum::actingAs($requester, ['role:requester']);
        $approvalResponse = $this->patchJson("/api/requester/requests/{$requestId}/verify-completion", [
            'action' => 'accept',
        ]);

        $approvalResponse->assertOk();
        $this->assertDatabaseHas('maintenance_requests', [
            'id' => $requestId,
            'status' => 'completed',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $technician->id,
            'type' => 'request_completion_approved',
            'related_id' => $requestId,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $supervisor->id,
            'type' => 'request_completion_approved',
            'related_id' => $requestId,
        ]);

        Sanctum::actingAs($requester, ['role:requester']);
        $ratingResponse = $this->postJson("/api/requester/requests/{$requestId}/rating", [
            'rating' => 5,
            'comment' => 'Fast and professional service.',
        ]);

        $ratingResponse->assertOk();
        $this->assertDatabaseHas('technician_ratings', [
            'request_id' => $requestId,
            'technician_id' => $technician->id,
            'requester_id' => $requester->id,
            'rating' => 5,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $technician->id,
            'type' => 'technician_feedback_received',
            'related_id' => $requestId,
        ]);

        $technician->refresh();
        $this->assertSame(5.0, (float) $technician->avg_rating);
        $this->assertSame(1, (int) $technician->total_ratings);

        Sanctum::actingAs($supervisor, ['role:supervisor']);
        $closeResponse = $this->patchJson("/api/supervisor/requests/{$requestId}/close");

        $closeResponse->assertOk();
        $this->assertDatabaseHas('maintenance_requests', [
            'id' => $requestId,
            'status' => 'closed',
        ]);
        $this->assertDatabaseHas('technician_ratings', [
            'request_id' => $requestId,
            'technician_id' => $technician->id,
            'requester_id' => $requester->id,
            'rating' => 5,
        ]);

        Sanctum::actingAs($inventoryOfficer, ['role:inventory_officer']);
        $recordResponse = $this->postJson('/api/inventory/part-requests', [
            'work_order_id' => $workOrderId,
            'technician_id' => $technician->id,
            'part_id' => $part->id,
            'quantity' => 3,
            'note' => 'Requested after inspection.',
            'urgency' => 'high',
        ]);

        $recordResponse->assertCreated();
        $partRequestId = (int) $recordResponse->json('part_request.id');

        $this->assertDatabaseHas('part_requests', [
            'id' => $partRequestId,
            'status' => 'pending',
            'quantity' => 3,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $technician->id,
            'type' => 'part_request_recorded',
            'related_id' => $partRequestId,
        ]);
        $this->assertSame(10, (int) SparePart::query()->findOrFail($part->id)->quantity_available);

        $reviewPartResponse = $this->patchJson("/api/inventory/part-requests/{$partRequestId}/review", [
            'status' => 'approved',
        ]);

        $reviewPartResponse->assertOk();
        $this->assertDatabaseHas('part_requests', [
            'id' => $partRequestId,
            'status' => 'approved',
            'reviewed_by' => $inventoryOfficer->id,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $technician->id,
            'type' => 'part_request_approved',
            'related_id' => $partRequestId,
        ]);
        $this->assertSame(10, (int) SparePart::query()->findOrFail($part->id)->quantity_available);

        $issueResponse = $this->postJson("/api/inventory/part-requests/{$partRequestId}/issue");

        $issueResponse->assertCreated();
        $this->assertDatabaseHas('part_issues', [
            'part_request_id' => $partRequestId,
            'work_order_id' => $workOrderId,
            'technician_id' => $technician->id,
            'part_id' => $part->id,
            'quantity_issued' => 3,
            'issued_by' => $inventoryOfficer->id,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $technician->id,
            'type' => 'part_issued',
            'related_id' => $partRequestId,
        ]);
        $this->assertSame(7, (int) SparePart::query()->findOrFail($part->id)->quantity_available);
    }

    public function test_supervisor_can_close_completed_manual_work_order(): void
    {
        $fixtures = $this->createCoreFixtures();
        $supervisor = $fixtures['supervisor'];
        $technician = $fixtures['technician'];

        Sanctum::actingAs($supervisor, ['role:supervisor']);
        $createResponse = $this->postJson('/api/supervisor/work-orders/manual', [
            'title' => 'Manual electrical inspection',
            'description' => 'Inspect breaker panel and tighten loose terminals.',
            'category_id' => $fixtures['category']->id,
            'building_id' => $fixtures['building']->id,
            'room_id' => $fixtures['room']->id,
            'assigned_to' => $technician->id,
            'priority' => 'medium',
            'scheduled_date' => now()->toDateString(),
            'scheduled_time' => '10:00',
            'estimated_hours' => 2,
            'release' => true,
        ]);

        $createResponse->assertCreated();
        $workOrderId = (int) $createResponse->json('work_order.id');

        Sanctum::actingAs($technician, ['role:technician']);
        $this->patchJson("/api/technician/work-orders/{$workOrderId}/start")->assertOk();
        $this->patchJson("/api/technician/work-orders/{$workOrderId}/complete", [
            'resolution_summary' => 'Completed direct manual task.',
            'completion_note' => 'Completed direct manual task.',
            'problem_found' => 'Loose fitting was identified during inspection.',
            'probable_cause' => 'Loose Connection',
            'diagnostic_steps' => [
                'Inspected mounting hardware and connection torque.',
                'Verified stability after correction.',
            ],
            'action_taken' => 'Secured the fitting and verified stable operation.',
        ])->assertOk();

        $this->assertDatabaseHas('work_orders', [
            'id' => $workOrderId,
            'request_id' => null,
            'title' => 'Manual electrical inspection',
            'work_status' => 'completed',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $technician->id,
            'type' => 'manual_work_order_assigned',
            'related_id' => $workOrderId,
        ]);

        Sanctum::actingAs($supervisor, ['role:supervisor']);
        $closeResponse = $this->patchJson("/api/supervisor/work-orders/{$workOrderId}/close");

        $closeResponse->assertOk();
        $this->assertDatabaseHas('work_orders', [
            'id' => $workOrderId,
            'work_status' => 'completed',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $technician->id,
            'type' => 'work_order_closed',
            'related_id' => $workOrderId,
        ]);
    }

    private function createCoreFixtures(): array
    {
        $department = Department::create([
            'name' => 'Facilities',
            'faculty' => 'Operations',
        ]);

        $building = Building::create([
            'name' => 'Main Block',
        ]);

        $room = Room::create([
            'building_id' => $building->id,
            'name' => 'M-101',
        ]);

        $category = Category::create([
            'name' => 'Electrical',
            'description' => 'Electrical maintenance issues.',
        ]);

        $specialty = Specialty::create([
            'name' => 'Electrical Repairs',
            'category_id' => $category->id,
        ]);

        $part = SparePart::create([
            'name' => 'Fan Belt',
            'part_code' => 'FB-100',
            'unit_price' => 15.00,
            'quantity_available' => 10,
            'minimum_stock' => 5,
        ]);

        $roles = collect([
            'requester' => Role::create(['name' => 'requester', 'description' => 'Requester role']),
            'supervisor' => Role::create(['name' => 'supervisor', 'description' => 'Supervisor role']),
            'technician' => Role::create(['name' => 'technician', 'description' => 'Technician role']),
            'inventory_officer' => Role::create(['name' => 'inventory_officer', 'description' => 'Inventory officer role']),
        ]);

        $requester = User::factory()->create([
            'fname' => 'Rita',
            'lname' => 'Requester',
            'username' => 'requester1',
            'email' => 'requester1@example.com',
            'password' => Hash::make('password'),
            'dept_id' => $department->id,
        ]);
        $supervisor = User::factory()->create([
            'fname' => 'Sam',
            'lname' => 'Supervisor',
            'username' => 'supervisor1',
            'email' => 'supervisor1@example.com',
            'password' => Hash::make('password'),
            'dept_id' => $department->id,
        ]);
        $technician = User::factory()->create([
            'fname' => 'Tina',
            'lname' => 'Tech',
            'username' => 'technician1',
            'email' => 'technician1@example.com',
            'password' => Hash::make('password'),
            'dept_id' => $department->id,
        ]);
        $inventoryOfficer = User::factory()->create([
            'fname' => 'Bdio',
            'lname' => 'Inventory',
            'username' => 'bdio',
            'email' => 'bdio@example.com',
            'password' => Hash::make('123456'),
            'dept_id' => $department->id,
        ]);

        $requester->roles()->attach($roles['requester']->id);
        $supervisor->roles()->attach($roles['supervisor']->id);
        $technician->roles()->attach($roles['technician']->id);
        $inventoryOfficer->roles()->attach($roles['inventory_officer']->id);

        $technician->specialties()->attach($specialty->id, ['created_at' => now()]);

        return [
            'department' => $department,
            'building' => $building,
            'room' => $room,
            'category' => $category,
            'specialty' => $specialty,
            'part' => $part,
            'requester' => $requester,
            'supervisor' => $supervisor,
            'technician' => $technician,
            'inventory_officer' => $inventoryOfficer,
        ];
    }
}
