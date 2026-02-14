<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WorkOrder;
use App\Support\RoleGuard;

class WorkOrderPolicy
{
    public function view(User $user, WorkOrder $workOrder): bool
    {
        if (RoleGuard::userHasAnyRole($user, ['admin', 'supervisor'])) {
            return true;
        }

        return (int) $workOrder->assigned_to === (int) $user->id;
    }

    public function assign(User $user): bool
    {
        return RoleGuard::userHasAnyRole($user, ['admin', 'supervisor']);
    }

    public function updateProgress(User $user, WorkOrder $workOrder): bool
    {
        return (int) $workOrder->assigned_to === (int) $user->id;
    }
}

