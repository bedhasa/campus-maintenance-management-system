<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('technician_progress_notes')) {
            Schema::create('technician_progress_notes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
                $table->foreignId('technician_id')->constrained('users')->cascadeOnDelete();
                $table->text('note');
                $table->timestamps();

                $table->index(['work_order_id', 'created_at']);
                $table->index(['technician_id', 'created_at']);
            });
        }

        if (!Schema::hasTable('technician_completion_reports')) {
            Schema::create('technician_completion_reports', function (Blueprint $table) {
                $table->id();
                $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
                $table->foreignId('technician_id')->constrained('users')->cascadeOnDelete();
                $table->text('completion_note')->nullable();
                $table->text('problem_found')->nullable();
                $table->text('action_taken')->nullable();
                $table->text('delay_reason')->nullable();
                $table->string('image_path')->nullable();
                $table->timestamp('submitted_at')->nullable();
                $table->timestamps();

                $table->unique('work_order_id');
                $table->index(['technician_id', 'submitted_at']);
            });
        }

        if (!Schema::hasTable('technician_completion_report_spare_parts')) {
            Schema::create('technician_completion_report_spare_parts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('completion_report_id')->constrained('technician_completion_reports')->cascadeOnDelete();
                $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
                $table->foreignId('technician_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('spare_part_id')->constrained('spare_parts')->cascadeOnDelete();
                $table->unsignedInteger('quantity_used');
                $table->decimal('unit_price', 12, 2)->default(0);
                $table->decimal('total_price', 12, 2)->default(0);
                $table->timestamps();

                $table->index(['completion_report_id', 'spare_part_id']);
                $table->index(['work_order_id', 'technician_id']);
            });
        }
    }

    public function down(): void
    {
        // Keep non-destructive behavior for production safety.
    }
};
