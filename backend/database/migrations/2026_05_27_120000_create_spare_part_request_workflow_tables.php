<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('spare_part_requests')) {
            return;
        }

        Schema::create('spare_part_requests', function (Blueprint $table) {
            $table->id();

            $table->string('request_number', 40)->unique();

            $table->foreignId('technician_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('work_order_id')->nullable()->constrained('work_orders')->nullOnDelete();

            $table->string('title', 180);
            $table->text('description')->nullable();

            $table->enum('urgency', ['low', 'medium', 'high', 'critical'])->default('medium');
            $table->date('needed_date')->nullable();

            $table->enum('status', ['pending', 'approved', 'rejected', 'expired', 'collected'])->default('pending');

            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('approval_note')->nullable();

            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();

            $table->timestamp('pickup_deadline')->nullable();
            $table->timestamp('expired_at')->nullable();

            $table->foreignId('collected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('collected_at')->nullable();

            // Used to enforce rollback/idempotency for expiry logic.
            $table->timestamp('stock_deducted_at')->nullable();
            $table->timestamp('stock_rolled_back_at')->nullable();

            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['technician_id', 'status']);
            $table->index(['work_order_id', 'status']);
            $table->index(['urgency', 'status']);
            $table->index(['pickup_deadline', 'status']);
        });

        Schema::create('spare_part_request_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('spare_part_request_id')->constrained('spare_part_requests')->cascadeOnDelete();
            $table->foreignId('spare_part_id')->constrained('spare_parts')->cascadeOnDelete();

            $table->unsignedInteger('requested_quantity');
            $table->unsignedInteger('approved_quantity')->nullable();

            // Snapshots for receipt/history resilience.
            $table->string('part_code_snapshot', 80)->nullable();
            $table->string('part_name_snapshot', 190)->nullable();
            $table->string('unit_snapshot', 40)->nullable();
            $table->string('category_snapshot', 120)->nullable();
            $table->decimal('unit_price_snapshot', 12, 2)->default(0);

            $table->timestamps();

            $table->unique(['spare_part_request_id', 'spare_part_id'], 'spr_items_unique_part_per_request');
            $table->index(['spare_part_id']);
        });

        Schema::create('inventory_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('transaction_code', 50)->unique();
            $table->enum('type', ['spr_approve_deduct', 'spr_expire_rollback', 'spr_collect_confirm']);
            $table->foreignId('spare_part_request_id')->nullable()->constrained('spare_part_requests')->nullOnDelete();
            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('performed_at')->useCurrent();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['type', 'performed_at']);
            $table->index(['spare_part_request_id', 'performed_at']);
        });

        Schema::create('inventory_transaction_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_transaction_id')->constrained('inventory_transactions')->cascadeOnDelete();
            $table->foreignId('spare_part_id')->constrained('spare_parts')->cascadeOnDelete();
            $table->integer('quantity'); // can be negative for deductions
            $table->decimal('unit_price_snapshot', 12, 2)->default(0);
            $table->decimal('total_price_snapshot', 12, 2)->default(0);
            $table->string('part_code_snapshot', 80)->nullable();
            $table->string('part_name_snapshot', 190)->nullable();
            $table->string('unit_snapshot', 40)->nullable();
            $table->string('category_snapshot', 120)->nullable();
            $table->timestamps();

            $table->index(['spare_part_id']);
        });
    }

    public function down(): void
    {
        // Keep audit history by design.
    }
};

