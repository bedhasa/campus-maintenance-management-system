<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'sqlite' || !Schema::hasTable('work_orders')) {
            return;
        }

        Schema::disableForeignKeyConstraints();
        DB::statement('PRAGMA foreign_keys=OFF');

        Schema::create('work_orders_new', function (Blueprint $table) {
            $table->id();
            $table->foreignId('request_id')->nullable()->constrained('maintenance_requests')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('priority', ['low', 'medium', 'high', 'urgent']);
            $table->date('scheduled_date')->nullable();
            $table->time('scheduled_time')->nullable();
            $table->decimal('estimated_hours', 8, 2)->nullable();
            $table->enum('work_status', ['draft', 'assigned', 'in_progress', 'paused', 'completed'])->default('draft');
            $table->text('completion_note')->nullable();
            $table->text('problem_found')->nullable();
            $table->text('action_taken')->nullable();
            $table->text('delay_reason')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('paused_at')->nullable();
            $table->timestamp('resumed_at')->nullable();
            $table->timestamp('status_updated_at')->nullable();
            $table->timestamp('completed_by_technician_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        DB::statement(
            'INSERT INTO work_orders_new (
                id, request_id, created_by, assigned_to, priority, scheduled_date, scheduled_time, estimated_hours,
                work_status, completion_note, problem_found, action_taken, delay_reason, started_at, paused_at,
                resumed_at, status_updated_at, completed_by_technician_at, completed_at, created_at, updated_at
            )
            SELECT
                id, request_id, created_by, assigned_to, priority, scheduled_date, scheduled_time, estimated_hours,
                work_status, completion_note, problem_found, action_taken, delay_reason, started_at, paused_at,
                resumed_at, status_updated_at, completed_by_technician_at, completed_at, created_at, updated_at
            FROM work_orders'
        );

        Schema::drop('work_orders');
        Schema::rename('work_orders_new', 'work_orders');

        Schema::table('work_orders', function (Blueprint $table) {
            $table->index(['assigned_to', 'work_status']);
            $table->index(['request_id', 'work_status']);
        });

        DB::statement('PRAGMA foreign_keys=ON');
        Schema::enableForeignKeyConstraints();
    }

    public function down(): void
    {
        // Intentionally left non-destructive.
    }
};
