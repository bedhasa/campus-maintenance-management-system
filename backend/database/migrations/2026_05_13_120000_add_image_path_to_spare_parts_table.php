<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('spare_parts') && !Schema::hasColumn('spare_parts', 'image_path')) {
            Schema::table('spare_parts', function (Blueprint $table) {
                $table->string('image_path')->nullable()->after('minimum_stock');
            });
        }
    }

    public function down(): void
    {
        // Intentionally non-destructive.
    }
};
