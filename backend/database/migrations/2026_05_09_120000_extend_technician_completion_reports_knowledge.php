<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('technician_completion_reports')) {
            return;
        }

        Schema::table('technician_completion_reports', function (Blueprint $table) {
            if (!Schema::hasColumn('technician_completion_reports', 'issue_reported')) {
                $table->text('issue_reported')->nullable()->after('technician_id');
            }
            if (!Schema::hasColumn('technician_completion_reports', 'probable_cause')) {
                $table->string('probable_cause', 100)->nullable()->after('problem_found');
            }
            if (!Schema::hasColumn('technician_completion_reports', 'probable_cause_custom')) {
                $table->string('probable_cause_custom', 500)->nullable()->after('probable_cause');
            }
            if (!Schema::hasColumn('technician_completion_reports', 'diagnostic_steps')) {
                $table->json('diagnostic_steps')->nullable()->after('probable_cause_custom');
            }
            if (!Schema::hasColumn('technician_completion_reports', 'downtime_hours')) {
                $table->decimal('downtime_hours', 10, 2)->nullable()->after('action_taken');
            }
            if (!Schema::hasColumn('technician_completion_reports', 'resolution_summary')) {
                $table->text('resolution_summary')->nullable()->after('downtime_hours');
            }
            if (!Schema::hasColumn('technician_completion_reports', 'attachment_paths')) {
                $table->json('attachment_paths')->nullable()->after('image_path');
            }
        });

        Schema::table('technician_completion_reports', function (Blueprint $table) {
            if (Schema::hasColumn('technician_completion_reports', 'probable_cause')) {
                $table->index('probable_cause');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('technician_completion_reports')) {
            return;
        }

        Schema::table('technician_completion_reports', function (Blueprint $table) {
            foreach (['probable_cause', 'probable_cause_custom', 'diagnostic_steps', 'downtime_hours', 'resolution_summary', 'attachment_paths', 'issue_reported'] as $col) {
                if (Schema::hasColumn('technician_completion_reports', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
