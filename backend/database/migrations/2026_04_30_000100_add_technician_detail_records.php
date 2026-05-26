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

                $table->unsignedBigInteger('work_order_id');
                $table->unsignedBigInteger('technician_id');

                $table->text('note');
                $table->timestamps();

                $table->foreign('work_order_id', 'tpn_work_fk')
                    ->references('id')
                    ->on('work_orders')
                    ->onDelete('cascade');

                $table->foreign('technician_id', 'tpn_tech_fk')
                    ->references('id')
                    ->on('users')
                    ->onDelete('cascade');

                // FIXED INDEX NAMES
                $table->index(['work_order_id', 'created_at'], 'tpn_work_created_idx');
                $table->index(['technician_id', 'created_at'], 'tpn_tech_created_idx');
            });
        }

        if (!Schema::hasTable('technician_completion_reports')) {
            Schema::create('technician_completion_reports', function (Blueprint $table) {
                $table->id();

                $table->unsignedBigInteger('work_order_id');
                $table->unsignedBigInteger('technician_id');

                $table->text('completion_note')->nullable();
                $table->text('problem_found')->nullable();
                $table->text('action_taken')->nullable();
                $table->text('delay_reason')->nullable();
                $table->string('image_path')->nullable();
                $table->timestamp('submitted_at')->nullable();

                $table->timestamps();

                $table->foreign('work_order_id', 'tcr_work_fk')
                    ->references('id')
                    ->on('work_orders')
                    ->onDelete('cascade');

                $table->foreign('technician_id', 'tcr_tech_fk')
                    ->references('id')
                    ->on('users')
                    ->onDelete('cascade');

                $table->unique('work_order_id', 'tcr_work_unique');
                $table->index(['technician_id', 'submitted_at'], 'tcr_tech_sub_idx');
            });
        }

        if (!Schema::hasTable('technician_completion_report_spare_parts')) {
            Schema::create('technician_completion_report_spare_parts', function (Blueprint $table) {
                $table->id();

                $table->unsignedBigInteger('completion_report_id');
                $table->unsignedBigInteger('work_order_id');
                $table->unsignedBigInteger('technician_id');
                $table->unsignedBigInteger('spare_part_id');

                $table->unsignedInteger('quantity_used');
                $table->decimal('unit_price', 12, 2)->default(0);
                $table->decimal('total_price', 12, 2)->default(0);

                $table->timestamps();

                $table->foreign('completion_report_id', 'tcrsp_report_fk')
                    ->references('id')
                    ->on('technician_completion_reports')
                    ->onDelete('cascade');

                $table->foreign('work_order_id', 'tcrsp_work_fk')
                    ->references('id')
                    ->on('work_orders')
                    ->onDelete('cascade');

                $table->foreign('technician_id', 'tcrsp_tech_fk')
                    ->references('id')
                    ->on('users')
                    ->onDelete('cascade');

                $table->foreign('spare_part_id', 'tcrsp_spare_fk')
                    ->references('id')
                    ->on('spare_parts')
                    ->onDelete('cascade');

                // FIXED INDEX NAMES (THIS WAS CAUSING YOUR ERROR)
                $table->index(
                    ['completion_report_id', 'spare_part_id'],
                    'tcrsp_report_spare_idx'
                );

                $table->index(
                    ['work_order_id', 'technician_id'],
                    'tcrsp_work_tech_idx'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('technician_completion_report_spare_parts');
        Schema::dropIfExists('technician_completion_reports');
        Schema::dropIfExists('technician_progress_notes');
    }
};