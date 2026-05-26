<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // =========================
        // PREVENTIVE MAINTENANCES
        // =========================
        if (!Schema::hasTable('preventive_maintenances')) {
            Schema::create('preventive_maintenances', function (Blueprint $table) {
                $table->id();

                $table->string('asset_name', 200)->nullable();
                $table->string('title', 200);
                $table->text('description')->nullable();

                $table->enum('frequency', ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
                $table->date('scheduled_date');

                $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('medium');

                $table->unsignedBigInteger('assigned_technician_id')->nullable();
                $table->unsignedBigInteger('created_by');

                $table->enum('status', ['scheduled', 'assigned', 'in_progress', 'completed'])->default('assigned');

                $table->text('notes')->nullable();

                $table->timestamps();

                // Foreign keys (short names)
                $table->foreign('assigned_technician_id', 'pm_assigned_tech_fk')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();

                $table->foreign('created_by', 'pm_created_by_fk')
                    ->references('id')
                    ->on('users')
                    ->cascadeOnDelete();
            });
        }

        // =========================
        // CHECKLISTS
        // =========================
        if (!Schema::hasTable('preventive_maintenance_checklists')) {
            Schema::create('preventive_maintenance_checklists', function (Blueprint $table) {
                $table->id();

                $table->unsignedBigInteger('preventive_maintenance_id');

                $table->foreign('preventive_maintenance_id', 'pmc_pm_fk')
                    ->references('id')
                    ->on('preventive_maintenances')
                    ->cascadeOnDelete();

                $table->string('task_description');
                $table->boolean('is_completed')->default(false);
                $table->timestamp('completed_at')->nullable();

                $table->timestamps();

                // FIXED INDEX NAME
                $table->index('preventive_maintenance_id', 'pmc_pm_idx');
            });
        }

        // =========================
        // REPORTS
        // =========================
        if (!Schema::hasTable('preventive_maintenance_reports')) {
            Schema::create('preventive_maintenance_reports', function (Blueprint $table) {
                $table->id();

                $table->unsignedBigInteger('preventive_maintenance_id');

                $table->foreign('preventive_maintenance_id', 'pmr_pm_fk')
                    ->references('id')
                    ->on('preventive_maintenances')
                    ->cascadeOnDelete();

                $table->text('condition_before')->nullable();
                $table->text('work_performed');
                $table->text('parts_used')->nullable();
                $table->text('recommendations')->nullable();
                $table->text('completion_notes')->nullable();

                $table->string('before_image_path')->nullable();
                $table->string('after_image_path')->nullable();

                $table->timestamp('submitted_at')->useCurrent();

                $table->timestamps();

                // INDEX (safe name)
                $table->index('preventive_maintenance_id', 'pmr_pm_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('preventive_maintenance_reports');
        Schema::dropIfExists('preventive_maintenance_checklists');
        Schema::dropIfExists('preventive_maintenances');
    }
};