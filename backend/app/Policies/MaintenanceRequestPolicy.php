<?php

namespace App\Policies;

use App\Models\MaintenanceRequest;
use App\Models\User;
use App\Support\RoleGuard;

class MaintenanceRequestPolicy
{
    public function view(User $user, MaintenanceRequest $request): bool
    {
        if (RoleGuard::userHasAnyRole($user, ['admin', 'supervisor'])) {
            return true;
        }

        if (RoleGuard::userHasAnyRole($user, ['technician'])) {
            return $request->workOrders()->where('assigned_to', $user->id)->exists();
        }

        return (int) $request->requester_id === (int) $user->id;
    }

    public function manage(User $user): bool
    {
        return RoleGuard::userHasAnyRole($user, ['admin', 'supervisor']);
    }
}

