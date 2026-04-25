<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('part_requests')) {
            Schema::create('part_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('work_order_id')->nullable()->constrained('work_orders')->nullOnDelete();
                $table->foreignId('technician_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('part_id')->constrained('spare_parts')->cascadeOnDelete();
                $table->unsignedInteger('quantity');
                $table->text('note')->nullable();
                $table->enum('urgency', ['low', 'medium', 'high'])->default('low');
                $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
                $table->timestamp('request_date')->useCurrent();
                $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('reviewed_at')->nullable();
                $table->timestamps();
                $table->index(['status', 'request_date']);
                $table->index(['technician_id', 'status']);
                $table->index(['part_id', 'status']);
            });
        }

        if (!Schema::hasTable('part_issues')) {
            Schema::create('part_issues', function (Blueprint $table) {
                $table->id();
                $table->foreignId('part_request_id')->nullable()->constrained('part_requests')->nullOnDelete()->unique();
                $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
                $table->foreignId('technician_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('part_id')->constrained('spare_parts')->cascadeOnDelete();
                $table->unsignedInteger('quantity_issued');
                $table->foreignId('issued_by')->constrained('users')->cascadeOnDelete();
                $table->timestamp('issue_date')->useCurrent();
                $table->timestamps();
                $table->index(['work_order_id', 'issue_date']);
                $table->index(['technician_id', 'issue_date']);
                $table->index(['part_id', 'issue_date']);
            });
        }

        if (Schema::hasTable('spare_parts')) {
            Schema::table('spare_parts', function (Blueprint $table) {
                if (!Schema::hasColumn('spare_parts', 'minimum_stock')) {
                    $table->unsignedInteger('minimum_stock')->default(5)->after('quantity_available');
                }
            });
        }
    }

    public function down(): void
    {
        // Keep inventory history data intact by design.
    }
};
