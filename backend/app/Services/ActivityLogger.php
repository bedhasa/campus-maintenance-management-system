<?php

namespace App\Services;

use App\Models\SystemActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class ActivityLogger
{
    public static function log(
        ?int $userId,
        string $module,
        string $action,
        $statusOrReferenceId = null,
        $referenceIdOrDescription = null,
        $descriptionOrMetaOrRequest = null,
        $metaOrRequest = null,
        $requestMaybe = null
    ): void {
        // Backwards-compatible parameter mapping:
        // Old signature: log($userId, $module, $action, $referenceId?, $description?, $request?)
        // New signature: log($userId, $module, $action, $status?, $referenceId?, $description?, $meta?, $request?)
        $status = null;
        $referenceId = null;
        $description = null;
        $meta = null;
        $request = null;

        if ($descriptionOrMetaOrRequest instanceof Request) {
            // Old signature detected.
            $referenceId = is_int($statusOrReferenceId) ? $statusOrReferenceId : (is_numeric($statusOrReferenceId) ? (int) $statusOrReferenceId : null);
            $description = is_string($referenceIdOrDescription) ? $referenceIdOrDescription : null;
            $request = $descriptionOrMetaOrRequest;
        } else {
            // New signature detected.
            $status = is_string($statusOrReferenceId) ? $statusOrReferenceId : null;
            $referenceId = is_int($referenceIdOrDescription) ? $referenceIdOrDescription : (is_numeric($referenceIdOrDescription) ? (int) $referenceIdOrDescription : null);
            $description = is_string($descriptionOrMetaOrRequest) ? $descriptionOrMetaOrRequest : null;
            $meta = is_array($metaOrRequest) ? $metaOrRequest : null;
            $request = $requestMaybe instanceof Request ? $requestMaybe : null;
        }

        $payload = [
            'user_id' => $userId,
            'module' => $module,
            'action' => $action,
            'reference_id' => $referenceId,
            'description' => $description,
            'ip_address' => $request?->ip(),
            'created_at' => now(),
        ];

        // Only write fields that exist in the DB (prevents 500s if migrations are not run yet).
        if (Schema::hasColumn('system_activity_logs', 'status')) {
            $payload['status'] = $status;
        }
        if (Schema::hasColumn('system_activity_logs', 'meta')) {
            $payload['meta'] = $meta;
        }

        SystemActivityLog::create($payload);
    }
}

