<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('part_issues')) {
            return;
        }

        Schema::table('part_issues', function (Blueprint $table) {
            if (!Schema::hasColumn('part_issues', 'issue_code')) {
                $table->string('issue_code', 40)->nullable()->unique()->after('id');
            }
            if (!Schema::hasColumn('part_issues', 'part_name_snapshot')) {
                $table->string('part_name_snapshot', 150)->nullable()->after('part_id');
            }
            if (!Schema::hasColumn('part_issues', 'unit_cost')) {
                $table->decimal('unit_cost', 12, 2)->default(0)->after('quantity_issued');
            }
            if (!Schema::hasColumn('part_issues', 'total_cost')) {
                $table->decimal('total_cost', 12, 2)->default(0)->after('unit_cost');
            }
            if (!Schema::hasColumn('part_issues', 'inventory_officer_name_snapshot')) {
                $table->string('inventory_officer_name_snapshot', 150)->nullable()->after('issued_by');
            }
            if (!Schema::hasColumn('part_issues', 'technician_name_snapshot')) {
                $table->string('technician_name_snapshot', 150)->nullable()->after('inventory_officer_name_snapshot');
            }
            if (!Schema::hasColumn('part_issues', 'supervisor_id')) {
                $table->foreignId('supervisor_id')->nullable()->after('technician_name_snapshot')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('part_issues', 'supervisor_name_snapshot')) {
                $table->string('supervisor_name_snapshot', 150)->nullable()->after('supervisor_id');
            }
        });
    }

    public function down(): void
    {
        // Non-destructive by design.
    }
};

