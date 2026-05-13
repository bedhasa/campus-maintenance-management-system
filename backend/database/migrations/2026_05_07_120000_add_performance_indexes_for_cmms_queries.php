<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('maintenance_requests')) {
            Schema::table('maintenance_requests', function (Blueprint $table) {
                $table->index(['created_at'], 'mr_created_at_idx');
                $table->index(['status', 'created_at'], 'mr_status_created_at_idx');
                $table->index(['due_date', 'status'], 'mr_due_date_status_idx');
                $table->index(['department_id', 'created_at'], 'mr_department_created_at_idx');
                $table->index(['building_id', 'created_at'], 'mr_building_created_at_idx');
                $table->index(['category_id', 'created_at'], 'mr_category_created_at_idx');
                $table->index(['asset_id', 'created_at'], 'mr_asset_created_at_idx');
            });
        }

        if (Schema::hasTable('work_orders')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->index(['request_id', 'work_status'], 'wo_request_status_idx');
                $table->index(['assigned_to', 'work_status'], 'wo_assignee_status_idx');
                $table->index(['completed_at'], 'wo_completed_at_idx');
                $table->index(['created_at'], 'wo_created_at_idx');
            });
        }

        if (Schema::hasTable('work_order_spare_parts')) {
            Schema::table('work_order_spare_parts', function (Blueprint $table) {
                $table->index(['created_at'], 'wosp_created_at_idx');
                $table->index(['work_order_id', 'spare_part_id'], 'wosp_order_part_idx');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('maintenance_requests')) {
            Schema::table('maintenance_requests', function (Blueprint $table) {
                $table->dropIndex('mr_created_at_idx');
                $table->dropIndex('mr_status_created_at_idx');
                $table->dropIndex('mr_due_date_status_idx');
                $table->dropIndex('mr_department_created_at_idx');
                $table->dropIndex('mr_building_created_at_idx');
                $table->dropIndex('mr_category_created_at_idx');
                $table->dropIndex('mr_asset_created_at_idx');
            });
        }

        if (Schema::hasTable('work_orders')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->dropIndex('wo_request_status_idx');
                $table->dropIndex('wo_assignee_status_idx');
                $table->dropIndex('wo_completed_at_idx');
                $table->dropIndex('wo_created_at_idx');
            });
        }

        if (Schema::hasTable('work_order_spare_parts')) {
            Schema::table('work_order_spare_parts', function (Blueprint $table) {
                $table->dropIndex('wosp_created_at_idx');
                $table->dropIndex('wosp_order_part_idx');
            });
        }
    }
};
