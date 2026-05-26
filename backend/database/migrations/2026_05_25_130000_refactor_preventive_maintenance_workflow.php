<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('preventive_maintenance_plans', function (Blueprint $table) {
            if (!Schema::hasColumn('preventive_maintenance_plans', 'start_date')) {
                $table->date('start_date')->nullable()->after('frequency_interval');
            }
            if (!Schema::hasColumn('preventive_maintenance_plans', 'checklist')) {
                $table->json('checklist')->nullable()->after('priority');
            }
        });

        Schema::table('preventive_maintenances', function (Blueprint $table) {
            if (!Schema::hasColumn('preventive_maintenances', 'plan_id')) {
                $table->foreignId('plan_id')
                    ->nullable()
                    ->after('asset_id')
                    ->constrained('preventive_maintenance_plans')
                    ->nullOnDelete();
            }
        });

        if (!Schema::hasTable('preventive_maintenance_spare_parts')) {
            Schema::create('preventive_maintenance_spare_parts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('preventive_maintenance_id');
                $table->unsignedBigInteger('spare_part_id');
                $table->unsignedInteger('quantity_used');
                $table->decimal('unit_price', 12, 2);
                $table->decimal('total_price', 12, 2);
                $table->timestamps();

                // Custom short constraint names
                $table->foreign('preventive_maintenance_id', 'pm_parts_pm_fk')
                    ->references('id')
                    ->on('preventive_maintenances')
                    ->onDelete('cascade');
                
                $table->foreign('spare_part_id', 'pm_parts_part_fk')
                    ->references('id')
                    ->on('spare_parts')
                    ->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('preventive_maintenance_spare_parts');

        Schema::table('preventive_maintenances', function (Blueprint $table) {
            if (Schema::hasColumn('preventive_maintenances', 'plan_id')) {
                $table->dropForeign(['plan_id']);
                $table->dropColumn('plan_id');
            }
        });

        Schema::table('preventive_maintenance_plans', function (Blueprint $table) {
            $table->dropColumn(['start_date', 'checklist']);
        });
    }
};
