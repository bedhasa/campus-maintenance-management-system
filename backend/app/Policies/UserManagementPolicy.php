<?php

namespace App\Policies;

use App\Models\User;
use App\Support\RoleGuard;

class UserManagementPolicy
{
    public function manage(User $user): bool
    {
        return RoleGuard::userHasAnyRole($user, ['admin', 'supervisor']);
    }
}

