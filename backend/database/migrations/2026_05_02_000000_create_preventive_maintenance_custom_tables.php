<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('preventive_maintenances')) {
            Schema::create('preventive_maintenances', function (Blueprint $table) {
                $table->id();
                $table->string('asset_name', 200)->nullable();
                $table->string('title', 200);
                $table->text('description')->nullable();
                $table->enum('frequency', ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
                $table->date('scheduled_date');
                $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('medium');
                $table->foreignId('assigned_technician_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->enum('status', ['scheduled', 'assigned', 'in_progress', 'completed'])->default('assigned');
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('preventive_maintenance_checklists')) {
            Schema::create('preventive_maintenance_checklists', function (Blueprint $table) {
                $table->id();
                $table->foreignId('preventive_maintenance_id')->constrained('preventive_maintenances')->cascadeOnDelete();
                $table->string('task_description');
                $table->boolean('is_completed')->default(false);
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('preventive_maintenance_reports')) {
            Schema::create('preventive_maintenance_reports', function (Blueprint $table) {
                $table->id();
                $table->foreignId('preventive_maintenance_id')->constrained('preventive_maintenances')->cascadeOnDelete();
                $table->text('condition_before')->nullable();
                $table->text('work_performed');
                $table->text('parts_used')->nullable();
                $table->text('recommendations')->nullable();
                $table->text('completion_notes')->nullable();
                $table->string('before_image_path')->nullable();
                $table->string('after_image_path')->nullable();
                $table->timestamp('submitted_at')->useCurrent();
                $table->timestamps();
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
