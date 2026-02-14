<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;

class RoleGuard
{
    public static function userHasAnyRole(User $user, array $roles): bool
    {
        foreach ($roles as $role) {
            if ($user->tokenCan('role:' . $role)) {
                return true;
            }
        }

        return false;
    }

    public static function authorize(Request $request, array $roles): User
    {
        $user = $request->user();
        abort_unless($user, 401, 'Authentication required.');
        abort_unless(self::userHasAnyRole($user, $roles), 403, 'Required role is missing.');
        return $user;
    }
}

