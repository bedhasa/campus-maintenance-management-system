<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\PartRequest;
use App\Models\Role;
use App\Models\SparePart;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InventoryOfficerFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_officer_can_manage_spare_part_master_data(): void
    {
        $fixtures = $this->createInventoryFixtures();

        Sanctum::actingAs($fixtures['inventory_officer'], ['role:inventory_officer']);

        $createResponse = $this->postJson('/api/inventory/spare-parts', [
            'name' => 'Thermostat',
            'part_code' => 'TH-200',
            'unit_price' => 18.50,
            'quantity_available' => 25,
            'minimum_stock' => 6,
        ]);

        $createResponse->assertCreated();
        $partId = (int) $createResponse->json('spare_part.id');

        $this->assertDatabaseHas('spare_parts', [
            'id' => $partId,
            'name' => 'Thermostat',
            'part_code' => 'TH-200',
            'quantity_available' => 25,
            'minimum_stock' => 6,
        ]);

        $updateResponse = $this->putJson("/api/inventory/spare-parts/{$partId}", [
            'name' => 'Thermostat Pro',
            'part_code' => 'TH-200',
            'unit_price' => 19.25,
            'quantity_available' => 30,
            'minimum_stock' => 8,
        ]);

        $updateResponse->assertOk();

        $this->assertDatabaseHas('spare_parts', [
            'id' => $partId,
            'name' => 'Thermostat Pro',
            'part_code' => 'TH-200',
            'quantity_available' => 30,
            'minimum_stock' => 8,
        ]);
    }

    public function test_inventory_officer_records_requests_with_stock_snapshot_and_blocks_duplicates(): void
    {
        $fixtures = $this->createInventoryFixtures();
        $inventoryOfficer = $fixtures['inventory_officer'];
        $technician = $fixtures['technician'];
        $workOrder = $fixtures['work_order'];
        $part = $fixtures['part'];

        Sanctum::actingAs($inventoryOfficer, ['role:inventory_officer']);

        $payload = [
            'work_order_id' => $workOrder->id,
            'technician_id' => $technician->id,
            'part_id' => $part->id,
            'quantity' => 12,
            'note' => 'Initial request from the site.',
            'urgency' => 'high',
        ];

        $recordResponse = $this->postJson('/api/inventory/part-requests', $payload);

        $recordResponse->assertCreated();
        $partRequestId = (int) $recordResponse->json('part_request.id');

        $this->assertDatabaseHas('part_requests', [
            'id' => $partRequestId,
            'work_order_id' => $workOrder->id,
            'technician_id' => $technician->id,
            'part_id' => $part->id,
            'quantity' => 12,
            'status' => 'pending',
        ]);
        $this->assertSame(10, (int) $recordResponse->json('stock.available'));
        $this->assertFalse((bool) $recordResponse->json('stock.sufficient'));
        $this->assertSame(10, (int) $recordResponse->json('part_request.stock_available'));

        $duplicateResponse = $this->postJson('/api/inventory/part-requests', $payload);

        $duplicateResponse->assertOk();
        $this->assertSame($partRequestId, (int) $duplicateResponse->json('part_request.id'));
        $this->assertDatabaseCount('part_requests', 1);
    }

    private function createInventoryFixtures(): array
    {
        $department = Department::create([
            'name' => 'Facilities',
            'faculty' => 'Operations',
        ]);

        $roles = collect([
            'technician' => Role::create(['name' => 'technician', 'description' => 'Technician role']),
            'inventory_officer' => Role::create(['name' => 'inventory_officer', 'description' => 'Inventory officer role']),
        ]);

        $technician = User::factory()->create([
            'fname' => 'Tina',
            'lname' => 'Tech',
            'username' => 'tech-inventory',
            'email' => 'tech-inventory@example.com',
            'password' => Hash::make('password'),
            'dept_id' => $department->id,
        ]);

        $inventoryOfficer = User::factory()->create([
            'fname' => 'Bdio',
            'lname' => 'Inventory',
            'username' => 'inventory-officer',
            'email' => 'inventory-officer@example.com',
            'password' => Hash::make('password'),
            'dept_id' => $department->id,
        ]);

        $technician->roles()->attach($roles['technician']->id);
        $inventoryOfficer->roles()->attach($roles['inventory_officer']->id);

        $workOrder = WorkOrder::create([
            'request_id' => null,
            'created_by' => $inventoryOfficer->id,
            'assigned_to' => $technician->id,
            'priority' => 'high',
            'work_status' => 'assigned',
        ]);

        $part = SparePart::create([
            'name' => 'Fan Belt',
            'part_code' => 'FB-100',
            'unit_price' => 15.00,
            'quantity_available' => 10,
            'minimum_stock' => 5,
        ]);

        return [
            'department' => $department,
            'technician' => $technician,
            'inventory_officer' => $inventoryOfficer,
            'work_order' => $workOrder,
            'part' => $part,
        ];
    }
}
