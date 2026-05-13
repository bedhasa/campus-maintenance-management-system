<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('system_activity_logs')) {
            return;
        }

        Schema::table('system_activity_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('system_activity_logs', 'status')) {
                $table->string('status', 20)->nullable()->after('action'); // success|failed|warning|error
                $table->index(['status']);
            }
            if (!Schema::hasColumn('system_activity_logs', 'meta')) {
                $table->json('meta')->nullable()->after('ip_address');
            }
        });
    }

    public function down(): void
    {
        // non-destructive
    }
};

