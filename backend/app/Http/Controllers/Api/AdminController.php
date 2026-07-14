<?php

namespace App\Http\Controllers\Api;

use App\Models\Role;
use App\Models\Specialty;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminController extends ModuleController
{
    public function dashboard(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['admin', 'supervisor']);

        return response()->json([
            'success' => true,
            'counts' => [
                'users' => User::query()->count(),
                'active_users' => User::query()->where('is_active', true)->count(),
                'technicians' => User::query()->whereHas('roles', fn ($q) => $q->where('name', 'technician'))->count(),
                'supervisors' => User::query()->whereHas('roles', fn ($q) => $q->where('name', 'supervisor'))->count(),
            ],
        ]);
    }

    public function users(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['admin', 'supervisor']);
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', 'max:50'],
        ]);

        $query = User::query()->with(['roles:id,name', 'specialties:id,name']);
        if (!empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(function ($q) use ($search) {
                $q->where('fname', 'like', "%{$search}%")
                    ->orWhere('lname', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%");
            });
        }

        if (!empty($validated['role'])) {
            $role = strtolower(trim((string) $validated['role']));
            $query->whereHas('roles', fn ($q) => $q->whereRaw('LOWER(name) = ?', [$role]));
        }

        return response()->json([
            'success' => true,
            'users' => $query->latest()->paginate(20),
            'roles' => Role::query()->get(['id', 'name']),
            'specialties' => Specialty::query()->with('category:id,name')->get(['id', 'name', 'category_id']),
        ]);
    }

    public function createUser(Request $request): JsonResponse
    {
        $actor = $this->authorizeRoles($request, ['admin', 'supervisor']);
        $validated = $request->validate([
            'fname' => ['required', 'string', 'max:255'],
            'lname' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255', 'unique:users,username'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:50'],
            'university_id_number' => ['required', 'string', 'max:255'],
            'dept_id' => ['required', 'integer', 'exists:departments,id'],
            'role_ids' => ['required', 'array', 'min:1'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
            'specialty_ids' => ['sometimes', 'array'],
            'specialty_ids.*' => ['integer', 'exists:specialties,id'],
            'temporary_password' => ['nullable', 'string', 'min:6'],
        ]);

        $user = User::create([
            'fname' => $validated['fname'],
            'lname' => $validated['lname'],
            'username' => $validated['username'],
            'email' => $validated['email'],
            'phone' => $validated['phone'],
            'university_id_number' => $validated['university_id_number'],
            'dept_id' => $validated['dept_id'],
            'is_active' => true,
            'password' => Hash::make($validated['temporary_password'] ?? 'TempPass123!'),
        ]);

        $user->roles()->sync($validated['role_ids']);
        $user->specialties()->sync($validated['specialty_ids'] ?? []);

        ActivityLogger::log($actor->id, 'user_management', 'create_user', 'success', $user->id, "Created user {$user->email}.", null, $request);

        return response()->json([
            'success' => true,
            'user' => $user->load(['roles:id,name', 'specialties:id,name']),
        ], 201);
    }

    public function updateUser(Request $request, int $id): JsonResponse
    {
        $actor = $this->authorizeRoles($request, ['admin', 'supervisor']);
        $user = User::query()->findOrFail($id);

        $validated = $request->validate([
            'fname' => ['sometimes', 'string', 'max:255'],
            'lname' => ['sometimes', 'string', 'max:255'],
            'username' => ['sometimes', 'string', 'max:255', 'unique:users,username,' . $user->id],
            'email' => ['sometimes', 'email', 'max:255', 'unique:users,email,' . $user->id],
            'phone' => ['sometimes', 'string', 'max:50'],
            'dept_id' => ['sometimes', 'integer', 'exists:departments,id'],
            'is_active' => ['sometimes', 'boolean'],
            'role_ids' => ['sometimes', 'array', 'min:1'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
            'specialty_ids' => ['sometimes', 'array'],
            'specialty_ids.*' => ['integer', 'exists:specialties,id'],
        ]);

        $user->update(collect($validated)->except(['role_ids', 'specialty_ids'])->all());
        if (array_key_exists('role_ids', $validated)) {
            $user->roles()->sync($validated['role_ids']);
        }
        if (array_key_exists('specialty_ids', $validated)) {
            $user->specialties()->sync($validated['specialty_ids']);
        }

        ActivityLogger::log($actor->id, 'user_management', 'update_user', 'success', $user->id, "Updated user {$user->email}.", null, $request);

        return response()->json([
            'success' => true,
            'user' => $user->fresh(['roles:id,name', 'specialties:id,name']),
        ]);
    }

    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $actor = $this->authorizeRoles($request, ['admin', 'supervisor']);
        $validated = $request->validate([
            'new_password' => ['required', 'string', 'min:6'],
        ]);

        $user = User::query()->findOrFail($id);
        $user->update(['password' => Hash::make($validated['new_password'])]);

        ActivityLogger::log($actor->id, 'user_management', 'reset_password', 'success', $user->id, "Reset password for {$user->email}.", null, $request);

        return response()->json([
            'success' => true,
            'message' => 'Password reset successfully.',
        ]);
    }

    public function systemLogs(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['admin', 'supervisor']);
        $validated = $request->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'module' => ['nullable', 'string', 'max:100'],
            'action' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:20'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'export' => ['nullable', 'in:excel,csv'],
        ]);

        $query = \App\Models\SystemActivityLog::query()
            ->with(['user:id,fname,lname,email', 'user.roles:id,name'])
            ->latest();

        if (!empty($validated['user_id'])) {
            $query->where('user_id', $validated['user_id']);
        }
        if (!empty($validated['module'])) {
            $query->where('module', $validated['module']);
        }
        if (!empty($validated['action'])) {
            $query->where('action', $validated['action']);
        }
        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }
        if (!empty($validated['from'])) {
            $query->whereDate('created_at', '>=', $validated['from']);
        }
        if (!empty($validated['to'])) {
            $query->whereDate('created_at', '<=', $validated['to']);
        }

        if (in_array(($validated['export'] ?? null), ['excel', 'csv'], true)) {
            $exportType = $validated['export'];
            $rows = $query->limit(5000)->get();
            $delimiter = $exportType === 'csv' ? ',' : "\t";
            $headers = [
                'ID',
                'DateTime',
                'User',
                'Roles',
                'Module',
                'Action',
                'Status',
                'ReferenceID',
                'IP',
                'Description',
            ];
            $escapeCell = function (mixed $value) use ($delimiter, $exportType): string {
                $text = str_replace(["\r", "\n", "\t"], ' ', (string) $value);
                if ($exportType === 'csv') {
                    $text = str_replace('"', '""', $text);
                    return '"' . $text . '"';
                }
                return $text;
            };
            $lines = [implode($delimiter, array_map($escapeCell, $headers))];
            foreach ($rows as $log) {
                $userName = $log->user ? trim(($log->user->fname ?? '') . ' ' . ($log->user->lname ?? '')) : 'System';
                $roles = $log->user ? $log->user->roles->pluck('name')->implode(', ') : '';
                $lines[] = implode($delimiter, array_map($escapeCell, [
                    $log->id,
                    optional($log->created_at)->toDateTimeString(),
                    $userName,
                    $roles,
                    $log->module,
                    $log->action,
                    $log->status,
                    $log->reference_id,
                    $log->ip_address,
                    $log->description,
                ]));
            }

            $content = "\xEF\xBB\xBF" . implode("\n", $lines);
            $fileName = 'system-logs-' . now()->format('Y-m-d_H-i-s');

            if ($exportType === 'csv') {
                return response($content, 200, [
                    'Content-Type' => 'text/csv; charset=UTF-8',
                    'Content-Disposition' => "attachment; filename={$fileName}.csv",
                ]);
            }

            return response($content, 200, [
                'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
                'Content-Disposition' => "attachment; filename={$fileName}.xls",
            ]);
        }

        return response()->json([
            'success' => true,
            'logs' => $query->paginate(30),
        ]);
    }
}

