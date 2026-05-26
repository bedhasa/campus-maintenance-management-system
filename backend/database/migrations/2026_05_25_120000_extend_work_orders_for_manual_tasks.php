<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('work_orders', 'title')) {
                $table->string('title', 150)->nullable()->after('assigned_to');
            }
            if (!Schema::hasColumn('work_orders', 'description')) {
                $table->text('description')->nullable()->after('title');
            }
            if (!Schema::hasColumn('work_orders', 'category_id')) {
                $table->foreignId('category_id')->nullable()->after('description')->constrained('categories')->nullOnDelete();
            }
            if (!Schema::hasColumn('work_orders', 'building_id')) {
                $table->foreignId('building_id')->nullable()->after('category_id')->constrained('buildings')->nullOnDelete();
            }
            if (!Schema::hasColumn('work_orders', 'room_id')) {
                $table->foreignId('room_id')->nullable()->after('building_id')->constrained('rooms')->nullOnDelete();
            }
            if (!Schema::hasColumn('work_orders', 'custom_location')) {
                $table->string('custom_location', 255)->nullable()->after('room_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            if (Schema::hasColumn('work_orders', 'custom_location')) {
                $table->dropColumn('custom_location');
            }
            if (Schema::hasColumn('work_orders', 'room_id')) {
                $table->dropForeign(['room_id']);
                $table->dropColumn('room_id');
            }
            if (Schema::hasColumn('work_orders', 'building_id')) {
                $table->dropForeign(['building_id']);
                $table->dropColumn('building_id');
            }
            if (Schema::hasColumn('work_orders', 'category_id')) {
                $table->dropForeign(['category_id']);
                $table->dropColumn('category_id');
            }
            if (Schema::hasColumn('work_orders', 'description')) {
                $table->dropColumn('description');
            }
            if (Schema::hasColumn('work_orders', 'title')) {
                $table->dropColumn('title');
            }
        });
    }
};
