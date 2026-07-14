<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('spare_parts')) {
            return;
        }

        Schema::table('spare_parts', function (Blueprint $table) {
            if (!Schema::hasColumn('spare_parts', 'unit')) {
                $table->string('unit', 40)->nullable()->after('quantity_available');
            }
            if (!Schema::hasColumn('spare_parts', 'category')) {
                $table->string('category', 120)->nullable()->after('unit');
            }
        });
    }

    public function down(): void
    {
        // Non-destructive migration by design.
    }
};

