<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            ALTER TABLE maintenance_requests
            MODIFY COLUMN status ENUM(
                'submitted',
                'approved',
                'assigned',
                'in_progress',
                'completed',
                'rejected',
                'closed',
                'cancelled'
            ) NOT NULL DEFAULT 'submitted'
        ");
    }

    public function down(): void
    {
        DB::statement("
            UPDATE maintenance_requests
            SET status = 'rejected'
            WHERE status = 'cancelled'
        ");

        DB::statement("
            ALTER TABLE maintenance_requests
            MODIFY COLUMN status ENUM(
                'submitted',
                'approved',
                'assigned',
                'in_progress',
                'completed',
                'rejected',
                'closed'
            ) NOT NULL DEFAULT 'submitted'
        ");
    }
};
