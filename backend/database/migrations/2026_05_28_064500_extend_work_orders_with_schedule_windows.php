<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('work_orders')) {
            return;
        }

        Schema::table('work_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('work_orders', 'scheduled_start_date')) {
                $table->date('scheduled_start_date')->nullable()->after('scheduled_date');
            }
            if (!Schema::hasColumn('work_orders', 'scheduled_end_date')) {
                $table->date('scheduled_end_date')->nullable()->after('scheduled_start_date');
            }
            if (!Schema::hasColumn('work_orders', 'scheduled_start_time')) {
                $table->time('scheduled_start_time')->nullable()->after('scheduled_time');
            }
            if (!Schema::hasColumn('work_orders', 'scheduled_end_time')) {
                $table->time('scheduled_end_time')->nullable()->after('scheduled_start_time');
            }
            if (!Schema::hasColumn('work_orders', 'schedule_note')) {
                $table->text('schedule_note')->nullable()->after('scheduled_end_time');
            }
            if (!Schema::hasColumn('work_orders', 'notification_status')) {
                $table->string('notification_status', 40)->default('pending')->after('schedule_note');
            }
        });
    }

    public function down(): void
    {
        // intentionally non-destructive
    }
};

