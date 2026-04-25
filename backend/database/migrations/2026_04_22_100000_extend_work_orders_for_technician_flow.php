<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('work_orders')) {
            Schema::table('work_orders', function (Blueprint $table) {
                if (!Schema::hasColumn('work_orders', 'problem_found')) {
                    $table->text('problem_found')->nullable()->after('completion_note');
                }
                if (!Schema::hasColumn('work_orders', 'action_taken')) {
                    $table->text('action_taken')->nullable()->after('problem_found');
                }
                if (!Schema::hasColumn('work_orders', 'started_at')) {
                    $table->timestamp('started_at')->nullable()->after('delay_reason');
                }
                if (!Schema::hasColumn('work_orders', 'paused_at')) {
                    $table->timestamp('paused_at')->nullable()->after('started_at');
                }
                if (!Schema::hasColumn('work_orders', 'resumed_at')) {
                    $table->timestamp('resumed_at')->nullable()->after('paused_at');
                }
                if (!Schema::hasColumn('work_orders', 'status_updated_at')) {
                    $table->timestamp('status_updated_at')->nullable()->after('resumed_at');
                }
                if (!Schema::hasColumn('work_orders', 'completed_by_technician_at')) {
                    $table->timestamp('completed_by_technician_at')->nullable()->after('status_updated_at');
                }
            });

            $driver = DB::getDriverName();
            if ($driver === 'mysql') {
                DB::statement("ALTER TABLE work_orders MODIFY COLUMN work_status ENUM('draft','assigned','in_progress','paused','completed') NOT NULL DEFAULT 'draft'");
            }
        }

        if (!Schema::hasTable('work_order_status_logs')) {
            Schema::create('work_order_status_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
                $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('old_status', 50)->nullable();
                $table->string('new_status', 50);
                $table->text('comment')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->index(['work_order_id', 'created_at']);
                $table->index(['new_status', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        // Keep non-destructive behavior for production safety.
    }
};
