<?php

namespace App\Services;

use App\Models\SystemActivityLog;
use Illuminate\Http\Request;

class ActivityLogger
{
    public static function log(
        ?int $userId,
        string $module,
        string $action,
        ?int $referenceId = null,
        ?string $description = null,
        ?Request $request = null
    ): void {
        SystemActivityLog::create([
            'user_id' => $userId,
            'module' => $module,
            'action' => $action,
            'reference_id' => $referenceId,
            'description' => $description,
            'ip_address' => $request?->ip(),
            'created_at' => now(),
        ]);
    }
}

