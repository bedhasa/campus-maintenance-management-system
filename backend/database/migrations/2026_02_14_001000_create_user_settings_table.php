<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('user_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('language', 8)->default('en');
            $table->boolean('dark_mode')->default(false);
            $table->string('font_size', 16)->default('medium');
            $table->boolean('notify_status')->default(true);
            $table->boolean('notify_chat')->default(true);
            $table->boolean('notify_feedback')->default(true);
            $table->foreignId('default_building_id')->nullable()->constrained('buildings')->nullOnDelete();
            $table->foreignId('default_room_id')->nullable()->constrained('rooms')->nullOnDelete();
            $table->string('timezone', 64)->default('Africa/Addis_Ababa');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_settings');
    }
};

