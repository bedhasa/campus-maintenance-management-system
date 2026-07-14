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
                if (!Schema::hasColumn('maintenance_requests', 'custom_category')) {
                    $table->string('custom_category', 120)->nullable()->after('category_id');
                }
            });
        }

        if (Schema::hasTable('assets')) {
            Schema::table('assets', function (Blueprint $table) {
                if (!Schema::hasColumn('assets', 'custom_location')) {
                    $table->string('custom_location', 255)->nullable()->after('room_id');
                }
            });
        }
    }

    public function down(): void
    {
        // Keep data non-destructive by design.
    }
};

