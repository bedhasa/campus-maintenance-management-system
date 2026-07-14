<?php

namespace App\Http\Controllers\Api;

use App\Models\InventoryTransaction;
use App\Models\InventoryTransactionItem;
use App\Models\SparePart;
use App\Models\SparePartRequest;
use App\Models\SparePartRequestItem;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\WorkOrder;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SparePartRequestController extends ModuleController
{
    public function technicianMeta(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician']);

        $workOrders = WorkOrder::query()
            ->where('assigned_to', $user->id)
            ->with('request:id,title,priority,status')
            ->orderByDesc('created_at')
            ->limit(250)
            ->get(['id', 'request_id', 'work_status', 'priority', 'created_at']);

        $parts = SparePart::query()
            ->orderBy('name')
            ->get(['id', 'name', 'part_code', 'quantity_available', 'minimum_stock', 'unit_price', 'unit', 'category']);

        return response()->json([
            'success' => true,
            'work_orders' => $workOrders,
            'spare_parts' => $parts,
        ]);
    }

    public function technicianIndex(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician']);

        $validated = $request->validate([
            'status' => ['nullable', 'in:pending,approved,rejected,expired,collected'],
            'urgency' => ['nullable', 'in:low,medium,high,critical'],
            'search' => ['nullable', 'string', 'max:150'],
        ]);

        $query = SparePartRequest::query()
            ->where('technician_id', $user->id)
            ->with(['items.part', 'workOrder'])
            ->latest('created_at');

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }
        if (!empty($validated['urgency'])) {
            $query->where('urgency', $validated['urgency']);
        }
        if (!empty($validated['search'])) {
            $term = trim($validated['search']);
            $query->where(function ($q) use ($term) {
                $q->where('request_number', 'like', "%{$term}%")
                    ->orWhere('title', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%");
            });
        }

        return response()->json([
            'success' => true,
            'requests' => $query->paginate(20),
        ]);
    }

    public function technicianStore(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician']);

        $validated = $request->validate([
            'work_order_id' => ['nullable', 'integer', 'exists:work_orders,id'],
            'title' => ['required', 'string', 'max:180'],
            'description' => ['nullable', 'string', 'max:5000'],
            'urgency' => ['required', 'in:low,medium,high,critical'],
            'needed_date' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1', 'max:30'],
            'items.*.spare_part_id' => ['required', 'integer', 'exists:spare_parts,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
        ]);

        // Prevent duplicates: same tech + same WO + same title within 5 minutes.
        $duplicate = SparePartRequest::query()
            ->where('technician_id', $user->id)
            ->when(!empty($validated['work_order_id']), fn ($q) => $q->where('work_order_id', (int) $validated['work_order_id']))
            ->where('title', $validated['title'])
            ->where('created_at', '>=', now()->subMinutes(5))
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'title' => ['A similar spare part request was recently submitted. Please wait a moment or change the title.'],
            ]);
        }

        $items = collect($validated['items'])
            ->map(fn ($row) => [
                'spare_part_id' => (int) $row['spare_part_id'],
                'requested_quantity' => (int) $row['quantity'],
            ]);

        if ($items->count() !== $items->unique('spare_part_id')->count()) {
            throw ValidationException::withMessages([
                'items' => ['Each spare part can only appear once per request.'],
            ]);
        }

        $spr = DB::transaction(function () use ($user, $validated, $items, $request) {
            $spr = new SparePartRequest();
            $spr->fill([
                'request_number' => $this->nextRequestNumber(),
                'technician_id' => $user->id,
                'work_order_id' => $validated['work_order_id'] ?? null,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'urgency' => $validated['urgency'],
                'needed_date' => $validated['needed_date'] ?? null,
                'status' => 'pending',
            ]);
            $spr->save();

            $partsById = SparePart::query()
                ->whereIn('id', $items->pluck('spare_part_id')->all())
                ->get(['id', 'name', 'part_code', 'unit_price', 'unit', 'category'])
                ->keyBy('id');

            foreach ($items as $row) {
                $part = $partsById->get($row['spare_part_id']);
                SparePartRequestItem::create([
                    'spare_part_request_id' => $spr->id,
                    'spare_part_id' => $row['spare_part_id'],
                    'requested_quantity' => $row['requested_quantity'],
                    'approved_quantity' => null,
                    'part_code_snapshot' => $part?->part_code,
                    'part_name_snapshot' => $part?->name,
                    'unit_snapshot' => $part?->unit,
                    'category_snapshot' => $part?->category,
                    'unit_price_snapshot' => (float) ($part?->unit_price ?? 0),
                ]);
            }

            ActivityLogger::log($user->id, 'inventory', 'spare_part_request_create', 'pending', $spr->id, "Created spare part request {$spr->request_number}.", null, $request);

            // Notify inventory officers (role-wide).
            $this->notifyRole('inventory_officer', 'spare_part_request', $spr->id, "New spare part request {$spr->request_number} is pending review.");

            return $spr->fresh(['items.part', 'workOrder']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Spare part request submitted successfully.',
            'request' => $spr,
        ], 201);
    }

    public function technicianShow(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['technician']);

        $spr = SparePartRequest::query()
            ->where('technician_id', $user->id)
            ->with(['items.part', 'workOrder', 'approver:id,fname,lname', 'collector:id,fname,lname'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'request' => $spr,
        ]);
    }

    public function inventoryDashboard(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['inventory_officer']);

        $base = SparePartRequest::query();

        return response()->json([
            'success' => true,
            'summary' => [
                'pending' => (clone $base)->where('status', 'pending')->count(),
                'approved' => (clone $base)->where('status', 'approved')->count(),
                'rejected' => (clone $base)->where('status', 'rejected')->count(),
                'expired' => (clone $base)->where('status', 'expired')->count(),
                'collected' => (clone $base)->where('status', 'collected')->count(),
                'critical' => (clone $base)->where('urgency', 'critical')->whereIn('status', ['pending', 'approved'])->count(),
            ],
        ]);
    }

    public function inventoryIndex(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['inventory_officer']);

        $validated = $request->validate([
            'status' => ['nullable', 'in:pending,approved,rejected,expired,collected'],
            'urgency' => ['nullable', 'in:low,medium,high,critical'],
            'technician_id' => ['nullable', 'integer', 'exists:users,id'],
            'work_order_id' => ['nullable', 'integer', 'exists:work_orders,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'search' => ['nullable', 'string', 'max:150'],
        ]);

        $query = SparePartRequest::query()
            ->with(['technician:id,fname,lname,phone', 'workOrder', 'items'])
            ->latest('created_at');

        foreach (['status', 'urgency', 'technician_id', 'work_order_id'] as $field) {
            if (!empty($validated[$field])) {
                $query->where($field, $validated[$field]);
            }
        }

        if (!empty($validated['from'])) {
            $query->whereDate('created_at', '>=', $validated['from']);
        }
        if (!empty($validated['to'])) {
            $query->whereDate('created_at', '<=', $validated['to']);
        }
        if (!empty($validated['search'])) {
            $term = trim($validated['search']);
            $query->where(function ($q) use ($term) {
                $q->where('request_number', 'like', "%{$term}%")
                    ->orWhere('title', 'like', "%{$term}%")
                    ->orWhereHas('technician', fn ($t) => $t
                        ->where('fname', 'like', "%{$term}%")
                        ->orWhere('lname', 'like', "%{$term}%")
                        ->orWhere('phone', 'like', "%{$term}%"));
            });
        }

        return response()->json([
            'success' => true,
            'requests' => $query->paginate(20),
        ]);
    }

    public function inventoryShow(Request $request, int $id): JsonResponse
    {
        $this->authorizeRoles($request, ['inventory_officer']);

        $spr = SparePartRequest::query()
            ->with([
                'technician:id,fname,lname,phone,email',
                'workOrder.request:id,title,priority,status,created_at',
                'items.part',
                'approver:id,fname,lname',
                'collector:id,fname,lname',
                'inventoryTransactions.items',
            ])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'request' => $spr,
        ]);
    }

    public function inventoryApprove(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['inventory_officer']);

        $validated = $request->validate([
            'pickup_deadline' => ['required', 'date'],
            'approval_note' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'exists:spare_part_request_items,id'],
            'items.*.approved_quantity' => ['required', 'integer', 'min:0', 'max:1000000'],
        ]);

        $spr = DB::transaction(function () use ($user, $validated, $id, $request) {
            /** @var SparePartRequest $spr */
            $spr = SparePartRequest::query()
                ->with(['items'])
                ->lockForUpdate()
                ->findOrFail($id);

            if ($spr->status !== 'pending') {
                throw ValidationException::withMessages(['status' => ['Only pending requests can be approved.']]);
            }

            $deadline = Carbon::parse($validated['pickup_deadline']);
            if ($deadline->isPast()) {
                throw ValidationException::withMessages(['pickup_deadline' => ['Pickup deadline must be in the future.']]);
            }

            $itemsById = $spr->items->keyBy('id');
            foreach ($validated['items'] as $row) {
                if (!$itemsById->has((int) $row['id'])) {
                    throw ValidationException::withMessages(['items' => ['Some items do not belong to this request.']]);
                }
            }

            $approvedMap = collect($validated['items'])->mapWithKeys(fn ($r) => [(int) $r['id'] => (int) $r['approved_quantity']]);
            if ($approvedMap->values()->sum() <= 0) {
                throw ValidationException::withMessages(['items' => ['At least one item must have an approved quantity greater than 0.']]);
            }

            // Stock checks + deduction (lock each part row).
            $partIds = $spr->items->pluck('spare_part_id')->all();
            $parts = SparePart::query()
                ->whereIn('id', $partIds)
                ->lockForUpdate()
                ->get(['id', 'name', 'part_code', 'quantity_available', 'unit_price', 'unit', 'category'])
                ->keyBy('id');

            foreach ($spr->items as $item) {
                $approveQty = (int) ($approvedMap[$item->id] ?? 0);
                if ($approveQty < 0) {
                    throw ValidationException::withMessages(['items' => ['Approved quantity cannot be negative.']]);
                }
                $part = $parts->get($item->spare_part_id);
                if (!$part) {
                    throw ValidationException::withMessages(['items' => ['Some spare parts are missing.']]);
                }
                if ($approveQty > (int) $part->quantity_available) {
                    throw ValidationException::withMessages([
                        'items' => ["Insufficient stock for {$part->name} ({$part->part_code}). Available: {$part->quantity_available}."],
                    ]);
                }
            }

            // Deduct.
            foreach ($spr->items as $item) {
                $approveQty = (int) ($approvedMap[$item->id] ?? 0);
                $part = $parts->get($item->spare_part_id);
                if ($approveQty <= 0) {
                    $item->approved_quantity = 0;
                    $item->save();
                    continue;
                }

                $part->decrement('quantity_available', $approveQty);

                $item->approved_quantity = $approveQty;
                $item->part_code_snapshot = $item->part_code_snapshot ?? $part?->part_code;
                $item->part_name_snapshot = $item->part_name_snapshot ?? $part?->name;
                $item->unit_snapshot = $item->unit_snapshot ?? $part?->unit;
                $item->category_snapshot = $item->category_snapshot ?? $part?->category;
                $item->unit_price_snapshot = (float) ($item->unit_price_snapshot ?? $part?->unit_price ?? 0);
                $item->save();
            }

            $spr->status = 'approved';
            $spr->approved_by = $user->id;
            $spr->approved_at = now();
            $spr->approval_note = $validated['approval_note'] ?? null;
            $spr->pickup_deadline = $deadline;
            $spr->stock_deducted_at = now();
            $spr->save();

            $tx = InventoryTransaction::create([
                'transaction_code' => $this->nextTransactionCode('TXA'),
                'type' => 'spr_approve_deduct',
                'spare_part_request_id' => $spr->id,
                'performed_by' => $user->id,
                'performed_at' => now(),
                'note' => $spr->approval_note,
            ]);
            foreach ($spr->items as $item) {
                $qty = (int) ($item->approved_quantity ?? 0);
                if ($qty <= 0) continue;
                $unit = (float) ($item->unit_price_snapshot ?? 0);
                InventoryTransactionItem::create([
                    'inventory_transaction_id' => $tx->id,
                    'spare_part_id' => $item->spare_part_id,
                    'quantity' => -1 * $qty,
                    'unit_price_snapshot' => $unit,
                    'total_price_snapshot' => $unit * $qty,
                    'part_code_snapshot' => $item->part_code_snapshot,
                    'part_name_snapshot' => $item->part_name_snapshot,
                    'unit_snapshot' => $item->unit_snapshot,
                    'category_snapshot' => $item->category_snapshot,
                ]);
            }

            ActivityLogger::log($user->id, 'inventory', 'spare_part_request_approve', 'approved', $spr->id, "Approved spare part request {$spr->request_number}.", null, $request);
            $this->notifyUser($spr->technician_id, 'technician', 'spare_part_request', $spr->id, "Your spare part request {$spr->request_number} was approved. Pickup before {$deadline->toDateTimeString()}.");

            return $spr->fresh(['items.part', 'technician', 'workOrder', 'approver']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Request approved and stock deducted.',
            'request' => $spr,
        ]);
    }

    public function inventoryReject(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['inventory_officer']);

        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:2000'],
        ]);

        $spr = DB::transaction(function () use ($user, $validated, $id, $request) {
            $spr = SparePartRequest::query()->lockForUpdate()->findOrFail($id);
            if ($spr->status !== 'pending') {
                throw ValidationException::withMessages(['status' => ['Only pending requests can be rejected.']]);
            }

            $spr->status = 'rejected';
            $spr->rejected_by = $user->id;
            $spr->rejected_at = now();
            $spr->rejection_reason = $validated['rejection_reason'];
            $spr->save();

            ActivityLogger::log($user->id, 'inventory', 'spare_part_request_reject', 'rejected', $spr->id, "Rejected spare part request {$spr->request_number}.", null, $request);
            $this->notifyUser($spr->technician_id, 'technician', 'spare_part_request', $spr->id, "Your spare part request {$spr->request_number} was rejected: {$spr->rejection_reason}");

            return $spr->fresh(['items.part', 'technician', 'workOrder', 'rejecter']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Request rejected.',
            'request' => $spr,
        ]);
    }

    public function inventoryCollect(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['inventory_officer']);

        $spr = DB::transaction(function () use ($user, $id, $request) {
            $spr = SparePartRequest::query()->with('items')->lockForUpdate()->findOrFail($id);

            if ($spr->status !== 'approved') {
                throw ValidationException::withMessages(['status' => ['Only approved requests can be marked as collected.']]);
            }
            if ($spr->pickup_deadline && Carbon::parse($spr->pickup_deadline)->isPast()) {
                throw ValidationException::withMessages(['status' => ['This request is past its pickup deadline. Mark it as expired instead.']]);
            }

            $spr->status = 'collected';
            $spr->collected_by = $user->id;
            $spr->collected_at = now();
            $spr->save();

            $tx = InventoryTransaction::create([
                'transaction_code' => $this->nextTransactionCode('TXC'),
                'type' => 'spr_collect_confirm',
                'spare_part_request_id' => $spr->id,
                'performed_by' => $user->id,
                'performed_at' => now(),
                'note' => 'Pickup confirmed.',
            ]);
            foreach ($spr->items as $item) {
                $qty = (int) ($item->approved_quantity ?? 0);
                if ($qty <= 0) continue;
                $unit = (float) ($item->unit_price_snapshot ?? 0);
                InventoryTransactionItem::create([
                    'inventory_transaction_id' => $tx->id,
                    'spare_part_id' => $item->spare_part_id,
                    'quantity' => 0,
                    'unit_price_snapshot' => $unit,
                    'total_price_snapshot' => $unit * $qty,
                    'part_code_snapshot' => $item->part_code_snapshot,
                    'part_name_snapshot' => $item->part_name_snapshot,
                    'unit_snapshot' => $item->unit_snapshot,
                    'category_snapshot' => $item->category_snapshot,
                ]);
            }

            ActivityLogger::log($user->id, 'inventory', 'spare_part_request_collect', 'collected', $spr->id, "Collected spare part request {$spr->request_number}.", null, $request);
            $this->notifyUser($spr->technician_id, 'technician', 'spare_part_request', $spr->id, "Your spare part request {$spr->request_number} was marked as collected.");

            return $spr->fresh(['items.part', 'technician', 'workOrder', 'collector']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Request marked as collected.',
            'request' => $spr,
        ]);
    }

    public function inventoryExpire(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['inventory_officer']);

        $spr = DB::transaction(function () use ($user, $id, $request) {
            $spr = SparePartRequest::query()->with('items')->lockForUpdate()->findOrFail($id);
            if (!in_array($spr->status, ['pending', 'approved'], true)) {
                throw ValidationException::withMessages(['status' => ['Only pending/approved requests can be expired.']]);
            }

            // If already deducted and not rolled back, restore.
            $didRollback = false;
            if ($spr->status === 'approved' && $spr->stock_deducted_at && !$spr->stock_rolled_back_at) {
                $partIds = $spr->items->pluck('spare_part_id')->all();
                $parts = SparePart::query()->whereIn('id', $partIds)->lockForUpdate()->get(['id', 'quantity_available'])->keyBy('id');

                $tx = InventoryTransaction::create([
                    'transaction_code' => $this->nextTransactionCode('TXR'),
                    'type' => 'spr_expire_rollback',
                    'spare_part_request_id' => $spr->id,
                    'performed_by' => $user->id,
                    'performed_at' => now(),
                    'note' => 'Rollback due to expiry.',
                ]);

                foreach ($spr->items as $item) {
                    $qty = (int) ($item->approved_quantity ?? 0);
                    if ($qty <= 0) continue;
                    $part = $parts->get($item->spare_part_id);
                    if ($part) {
                        $part->increment('quantity_available', $qty);
                    }
                    $unit = (float) ($item->unit_price_snapshot ?? 0);
                    InventoryTransactionItem::create([
                        'inventory_transaction_id' => $tx->id,
                        'spare_part_id' => $item->spare_part_id,
                        'quantity' => $qty,
                        'unit_price_snapshot' => $unit,
                        'total_price_snapshot' => $unit * $qty,
                        'part_code_snapshot' => $item->part_code_snapshot,
                        'part_name_snapshot' => $item->part_name_snapshot,
                        'unit_snapshot' => $item->unit_snapshot,
                        'category_snapshot' => $item->category_snapshot,
                    ]);
                }

                $spr->stock_rolled_back_at = now();
                $didRollback = true;
            }

            $spr->status = 'expired';
            $spr->expired_at = now();
            $spr->save();

            ActivityLogger::log($user->id, 'inventory', 'spare_part_request_expire', 'expired', $spr->id, "Expired spare part request {$spr->request_number}." . ($didRollback ? ' Stock rolled back.' : ''), null, $request);
            $this->notifyUser($spr->technician_id, 'technician', 'spare_part_request', $spr->id, "Your spare part request {$spr->request_number} expired and can no longer be collected.");

            return $spr->fresh(['items.part', 'technician', 'workOrder']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Request expired.',
            'request' => $spr,
        ]);
    }

    public function processExpirations(): int
    {
        $now = now();
        $due = SparePartRequest::query()
            ->where('status', 'approved')
            ->whereNotNull('pickup_deadline')
            ->where('pickup_deadline', '<', $now)
            ->limit(250)
            ->get(['id']);

        $count = 0;
        foreach ($due as $row) {
            // Use an internal system user id null. We still rollback and notify.
            $this->expireAsSystem((int) $row->id);
            $count++;
        }

        return $count;
    }

    private function expireAsSystem(int $id): void
    {
        DB::transaction(function () use ($id) {
            $spr = SparePartRequest::query()->with('items')->lockForUpdate()->find($id);
            if (!$spr) return;
            if ($spr->status !== 'approved') return;
            if (!$spr->pickup_deadline || Carbon::parse($spr->pickup_deadline)->isFuture()) return;

            if ($spr->stock_deducted_at && !$spr->stock_rolled_back_at) {
                $partIds = $spr->items->pluck('spare_part_id')->all();
                $parts = SparePart::query()->whereIn('id', $partIds)->lockForUpdate()->get(['id', 'quantity_available'])->keyBy('id');

                $tx = InventoryTransaction::create([
                    'transaction_code' => $this->nextTransactionCode('TXR'),
                    'type' => 'spr_expire_rollback',
                    'spare_part_request_id' => $spr->id,
                    'performed_by' => null,
                    'performed_at' => now(),
                    'note' => 'Auto-rollback due to expiry.',
                ]);

                foreach ($spr->items as $item) {
                    $qty = (int) ($item->approved_quantity ?? 0);
                    if ($qty <= 0) continue;
                    $part = $parts->get($item->spare_part_id);
                    if ($part) {
                        $part->increment('quantity_available', $qty);
                    }
                    $unit = (float) ($item->unit_price_snapshot ?? 0);
                    InventoryTransactionItem::create([
                        'inventory_transaction_id' => $tx->id,
                        'spare_part_id' => $item->spare_part_id,
                        'quantity' => $qty,
                        'unit_price_snapshot' => $unit,
                        'total_price_snapshot' => $unit * $qty,
                        'part_code_snapshot' => $item->part_code_snapshot,
                        'part_name_snapshot' => $item->part_name_snapshot,
                        'unit_snapshot' => $item->unit_snapshot,
                        'category_snapshot' => $item->category_snapshot,
                    ]);
                }

                $spr->stock_rolled_back_at = now();
            }

            $spr->status = 'expired';
            $spr->expired_at = now();
            $spr->save();

            ActivityLogger::log(null, 'inventory', 'spare_part_request_auto_expire', 'expired', $spr->id, "Auto-expired spare part request {$spr->request_number}.", ['auto' => true], null);
            $this->notifyUser($spr->technician_id, 'technician', 'spare_part_request', $spr->id, "Your spare part request {$spr->request_number} expired and was auto-rolled back.");
        });
    }

    private function notifyRole(string $recipientRole, string $module, int $relatedId, string $message): void
    {
        $users = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', $recipientRole))
            ->get(['id']);

        foreach ($users as $recipient) {
            $this->notifyUser((int) $recipient->id, $recipientRole, $module, $relatedId, $message);
        }
    }

    private function notifyUser(int $userId, string $role, string $module, int $relatedId, string $message): void
    {
        $payload = [
            'type' => 'info',
            'related_id' => $relatedId,
            'message' => $message,
            'is_read' => false,
        ];
        if (Schema::hasColumn('notifications', 'user_id')) {
            $payload['user_id'] = $userId;
        }
        if (Schema::hasColumn('notifications', 'recipient_role')) {
            $payload['recipient_role'] = $role;
        }
        if (Schema::hasColumn('notifications', 'module')) {
            $payload['module'] = $module;
        }
        UserNotification::create($payload);
    }

    private function nextRequestNumber(): string
    {
        $date = now()->format('Ymd');
        $rand = random_int(10000, 99999);
        return "SPR-{$date}-{$rand}";
    }

    private function nextTransactionCode(string $prefix): string
    {
        $date = now()->format('Ymd');
        $rand = random_int(10000, 99999);
        return "{$prefix}-{$date}-{$rand}";
    }
}

