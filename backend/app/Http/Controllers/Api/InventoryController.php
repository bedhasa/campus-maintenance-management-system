<?php

namespace App\Http\Controllers\Api;

use App\Models\PartIssue;
use App\Models\PartRequest;
use App\Models\Category;
use App\Models\RequestStatusLog;
use App\Models\SparePart;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\WorkOrder;
use App\Services\ActivityLogger;
use App\Services\EmailNotifier;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InventoryController extends ModuleController
{
    private function hasSparePartImageColumn(): bool
    {
        return Schema::hasColumn('spare_parts', 'image_path');
    }

    private function sparePartColumns(bool $includePrice = false): array
    {
        $columns = ['id', 'name', 'part_code', 'quantity_available', 'minimum_stock'];

        if ($includePrice) {
            $columns[] = 'unit_price';
        }

        if ($this->hasSparePartImageColumn()) {
            $columns[] = 'image_path';
        }

        return $columns;
    }

    private function partRelationSelect(): string
    {
        return 'part:' . implode(',', $this->sparePartColumns());
    }

    private function publicStorageUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        $url = Storage::disk('public')->url($path);

        return str_starts_with($url, 'http') ? $url : url($url);
    }

    private function withPartImageUrls($parts)
    {
        $parts->each(function ($part) {
            $part->setAttribute('image_url', $this->publicStorageUrl($part->image_path));
        });

        return $parts;
    }

    public function meta(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['inventory_officer']);

        return response()->json([
            'success' => true,
            'work_orders' => WorkOrder::query()
                ->with('request:id,title,status,priority,created_at')
                ->orderByDesc('created_at')
                ->limit(200)
                ->get(['id', 'request_id', 'work_status', 'assigned_to', 'priority', 'created_at']),
            'technicians' => $this->techniciansQuery()->get(['id', 'fname', 'lname', 'phone']),
            'spare_parts' => $this->withPartImageUrls(
                $this->sparePartsQuery()->get($this->sparePartColumns(includePrice: true))
            ),
        ]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['inventory_officer']);

        return response()->json([
            'success' => true,
            'summary' => [
                'total_parts' => SparePart::query()->count(),
                'categories' => Category::query()->count(),
                'low_stock' => $this->lowStockQuery()->count(),
                'total_inventory_value' => (float) SparePart::query()->selectRaw('COALESCE(SUM(quantity_available * unit_price), 0) as total')->value('total'),
                'pending_requests' => PartRequest::query()->where('status', 'pending')->count(),
                'approved_requests' => PartRequest::query()->where('status', 'approved')->count(),
                'rejected_requests' => PartRequest::query()->where('status', 'rejected')->count(),
                'issued_today' => PartIssue::query()->whereDate('issue_date', now()->toDateString())->count(),
            ],
            'low_stock_parts' => $this->lowStockQuery()
                ->orderBy('name')
                ->limit(6)
                ->get($this->sparePartColumns()),
            'recent_requests' => $this->requestsQuery()
                ->latest('request_date')
                ->limit(5)
                ->get(),
            'recent_issues' => $this->issuesQuery()
                ->latest('issue_date')
                ->limit(6)
                ->get(),
        ]);
    }

    public function spareParts(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['inventory_officer']);

        return response()->json([
            'success' => true,
            'spare_parts' => $this->withPartImageUrls(
                $this->sparePartsQuery()
                    ->orderBy('name')
                    ->get($this->sparePartColumns(includePrice: true))
            ),
        ]);
    }

    public function storeSparePart(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['inventory_officer']);
        $validated = $this->validateSparePartPayload($request);

        if ($this->hasSparePartImageColumn() && $request->hasFile('image')) {
            $validated['image_path'] = $request->file('image')->store('spare-part-images', 'public');
        }

        $part = SparePart::create($validated);
        $part->setAttribute('image_url', $this->publicStorageUrl($part->image_path ?? null));

        ActivityLogger::log(
            $user->id,
            'inventory',
            'create_spare_part',
            $part->id,
            "Created spare part {$part->part_code}.",
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Spare part created successfully.',
            'spare_part' => $part,
        ], 201);
    }

    public function updateSparePart(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['inventory_officer']);
        $part = SparePart::query()->findOrFail($id);
        $validated = $this->validateSparePartPayload($request, $part);

        if ($this->hasSparePartImageColumn() && $request->hasFile('image')) {
            if (($part->image_path ?? null)) {
                Storage::disk('public')->delete($part->image_path);
            }
            $validated['image_path'] = $request->file('image')->store('spare-part-images', 'public');
        }

        $part->update($validated);
        $freshPart = $part->fresh();
        $freshPart?->setAttribute('image_url', $this->publicStorageUrl($freshPart->image_path ?? null));

        ActivityLogger::log(
            $user->id,
            'inventory',
            'update_spare_part',
            $part->id,
            "Updated spare part {$part->part_code}.",
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Spare part updated successfully.',
            'spare_part' => $freshPart,
        ]);
    }

    public function lowStock(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['inventory_officer']);

        return response()->json([
            'success' => true,
            'parts' => $this->withPartImageUrls(
                $this->lowStockQuery()
                    ->orderBy('name')
                    ->get($this->sparePartColumns(includePrice: true))
            ),
        ]);
    }

    public function recordRequest(Request $request): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['inventory_officer']);

        $validated = $request->validate([
            'work_order_id' => ['required', 'integer', 'exists:work_orders,id'],
            'technician_id' => ['required', 'integer', 'exists:users,id'],
            'part_id' => ['required', 'integer', 'exists:spare_parts,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:2000'],
            'urgency' => ['required', 'in:low,medium,high'],
        ]);

        $technician = $this->techniciansQuery()->whereKey($validated['technician_id'])->first();
        if (!$technician) {
            return response()->json([
                'success' => false,
                'message' => 'Selected technician is not valid for this module.',
            ], 422);
        }

        $workOrder = WorkOrder::query()->findOrFail($validated['work_order_id']);
        $part = SparePart::query()->findOrFail($validated['part_id']);

        if ((int) $workOrder->assigned_to !== (int) $technician->id) {
            return response()->json([
                'success' => false,
                'message' => 'Technician is not assigned to this work order.',
            ], 422);
        }

        if (!$this->isWorkOrderApproved($workOrder)) {
            return response()->json([
                'success' => false,
                'message' => 'Work order is not approved for inventory issuance.',
            ], 422);
        }

        $duplicateRequest = PartRequest::query()
            ->where('work_order_id', $workOrder->id)
            ->where('technician_id', $technician->id)
            ->where('part_id', $part->id)
            ->where('quantity', $validated['quantity'])
            ->whereIn('status', ['pending', 'approved'])
            ->first();

        if ($duplicateRequest) {
            return response()->json([
                'success' => true,
                'message' => 'A matching spare part request already exists.',
                'part_request' => $this->decorateRequestWithStock($this->freshRequest($duplicateRequest)),
            ]);
        }

        $partRequest = PartRequest::create([
            'work_order_id' => $workOrder->id,
            'technician_id' => $technician->id,
            'part_id' => $part->id,
            'quantity' => $validated['quantity'],
            'note' => $validated['note'] ?? null,
            'urgency' => $validated['urgency'],
            'status' => 'pending',
            'request_date' => now(),
            'recorded_by' => $user->id,
        ]);

        $this->notifyTechnician(
            $technician->id,
            'part_request_recorded',
            "A spare part request was recorded for Work Order #{$workOrder->id}.",
            'inventory',
            $partRequest->id
        );

        ActivityLogger::log($user->id, 'inventory', 'record_request', $partRequest->id, "Recorded spare part request #{$partRequest->id}.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Spare part request recorded.',
            'part_request' => $this->decorateRequestWithStock($this->freshRequest($partRequest)),
            'stock' => $this->stockSnapshot($part, (int) $validated['quantity']),
        ], 201);
    }

    public function requests(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['inventory_officer']);
        $validated = $request->validate([
            'status' => ['nullable', 'in:pending,approved,rejected'],
        ]);

        $query = $this->requestsQuery();
        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        return response()->json([
            'success' => true,
            'part_requests' => $query->latest('request_date')->paginate(20),
        ]);
    }

    public function reviewRequest(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['inventory_officer']);

        $validated = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
        ]);

        $partRequest = PartRequest::query()->findOrFail($id);

        if ($partRequest->status === $validated['status']) {
            return response()->json([
                'success' => true,
                'message' => 'Request already updated.',
                'part_request' => $this->freshRequest($partRequest),
            ]);
        }

        if ($partRequest->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending requests can be reviewed.',
            ], 422);
        }

        $partRequest->update([
            'status' => $validated['status'],
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);

        $this->notifyTechnician(
            $partRequest->technician_id,
            $validated['status'] === 'approved' ? 'part_request_approved' : 'part_request_rejected',
            "Your spare part request #{$partRequest->id} was {$validated['status']}.",
            'inventory',
            $partRequest->id
        );

        ActivityLogger::log($user->id, 'inventory', 'review_request', $partRequest->id, "Request #{$partRequest->id} marked {$validated['status']}.", $request);

        return response()->json([
            'success' => true,
            'message' => 'Request reviewed.',
            'part_request' => $this->freshRequest($partRequest),
        ]);
    }

    public function issue(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeRoles($request, ['inventory_officer']);
        $validated = $request->validate([
            'quantity_issued' => ['nullable', 'integer', 'min:1'],
        ]);

        $partRequest = PartRequest::query()->with(['part', 'technician', 'workOrder'])->findOrFail($id);

        if ($partRequest->status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'Only approved requests can be issued.',
            ], 422);
        }

        if ($partRequest->issue()->exists()) {
            return response()->json([
                'success' => true,
                'message' => 'Parts were already issued for this request.',
                'part_issue' => $partRequest->issue()->with(['part', 'technician', 'issuedBy'])->first(),
            ]);
        }

        try {
            $issue = DB::transaction(function () use ($partRequest, $user, $validated) {
                $part = SparePart::query()->whereKey($partRequest->part_id)->lockForUpdate()->firstOrFail();
                $workOrder = WorkOrder::query()->with('request:id,status,department_id')->find($partRequest->work_order_id);
                if (!$workOrder) {
                    throw ValidationException::withMessages([
                        'work_order_id' => ['Invalid work order reference.'],
                    ]);
                }

                if ((int) $workOrder->assigned_to !== (int) $partRequest->technician_id) {
                    throw ValidationException::withMessages([
                        'technician_id' => ['Technician is not assigned to this work order.'],
                    ]);
                }

                if (!$this->isWorkOrderApproved($workOrder)) {
                    throw ValidationException::withMessages([
                        'work_order_id' => ['Work order is not approved for inventory issuance.'],
                    ]);
                }

                $quantity = (int) ($validated['quantity_issued'] ?? $partRequest->quantity);

                if ((int) $part->quantity_available < $quantity) {
                    throw ValidationException::withMessages([
                        'quantity' => ["Insufficient stock for {$part->name}. Available: {$part->quantity_available}."],
                    ]);
                }

                $unitCost = (float) ($part->unit_price ?? 0);
                $totalCost = $unitCost * $quantity;
                $supervisor = $this->resolveSupervisorForWorkOrder($workOrder);
                $issueCode = $this->issueCode($workOrder, $partRequest->id);

                $issue = PartIssue::create([
                    'issue_code' => $issueCode,
                    'part_request_id' => $partRequest->id,
                    'work_order_id' => $partRequest->work_order_id,
                    'technician_id' => $partRequest->technician_id,
                    'part_id' => $partRequest->part_id,
                    'part_name_snapshot' => $part->name,
                    'quantity_issued' => $quantity,
                    'unit_cost' => $unitCost,
                    'total_cost' => $totalCost,
                    'issued_by' => $user->id,
                    'inventory_officer_name_snapshot' => $this->fullName($user),
                    'technician_name_snapshot' => $this->fullName($partRequest->technician),
                    'supervisor_id' => $supervisor?->id,
                    'supervisor_name_snapshot' => $supervisor ? $this->fullName($supervisor) : null,
                    'issue_date' => now(),
                ]);

                $part->decrement('quantity_available', $quantity);

                return $issue;
            });

            $partRequest->loadMissing(['part', 'technician', 'workOrder']);
            $this->notifyTechnician(
                $partRequest->technician_id,
                'part_issued',
                "{$issue->quantity_issued} {$partRequest->part?->name}(s) have been issued for Work Order {$this->workOrderCode($partRequest->work_order_id, $partRequest->workOrder?->created_at)}.",
                'inventory',
                $partRequest->id
            );
            $this->notifySupervisors(
                'part_issued',
                "Spare parts issued for Work Order {$this->workOrderCode($partRequest->work_order_id, $partRequest->workOrder?->created_at)}.",
                'inventory',
                $partRequest->work_order_id
            );

            ActivityLogger::log($user->id, 'inventory', 'issue_part', $issue->id, "Issued spare part for request #{$partRequest->id}.", $request);

            return response()->json([
                'success' => true,
                'message' => 'Spare parts issued.',
                'part_issue' => $this->freshIssue($issue),
            ], 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (QueryException) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to issue parts at the moment. Please try again.',
            ], 422);
        }
    }

    public function issues(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['inventory_officer']);

        return response()->json([
            'success' => true,
            'part_issues' => $this->issuesQuery()->latest('issue_date')->paginate(20),
        ]);
    }

    public function reports(Request $request): JsonResponse
    {
        $this->authorizeRoles($request, ['inventory_officer']);

        $validated = $request->validate([
            'range' => ['nullable', 'in:weekly,monthly,yearly,overall'],
        ]);

        $range = $validated['range'] ?? 'overall';
        [$issueFrom, $requestFrom] = $this->resolveReportRange($range);

        $issuesBase = PartIssue::query();
        if ($issueFrom) {
            $issuesBase->where('issue_date', '>=', $issueFrom);
        }

        $requestsBase = PartRequest::query();
        if ($requestFrom) {
            $requestsBase->where('request_date', '>=', $requestFrom);
        }

        $mostIssuedParts = (clone $issuesBase)
            ->select('part_id', DB::raw('SUM(quantity_issued) as total_quantity'), DB::raw('COUNT(*) as issue_count'), DB::raw('SUM(total_cost) as total_cost'))
            ->with($this->partRelationSelect())
            ->groupBy('part_id')
            ->orderByDesc('total_quantity')
            ->limit(10)
            ->get();

        $technicianUsage = (clone $issuesBase)
            ->select('technician_id', DB::raw('SUM(quantity_issued) as total_quantity'), DB::raw('SUM(total_cost) as total_cost'))
            ->with('technician:id,fname,lname')
            ->groupBy('technician_id')
            ->orderByDesc('total_quantity')
            ->limit(10)
            ->get();

        $mostRequestedTechnicians = (clone $requestsBase)
            ->select('technician_id', DB::raw('SUM(quantity) as total_quantity'), DB::raw('COUNT(*) as request_count'))
            ->with('technician:id,fname,lname')
            ->groupBy('technician_id')
            ->orderByDesc('total_quantity')
            ->limit(10)
            ->get();

        $workOrderUsage = (clone $issuesBase)
            ->select('work_order_id', DB::raw('SUM(quantity_issued) as total_quantity'), DB::raw('SUM(total_cost) as total_cost'))
            ->with(['workOrder:id,request_id,created_at', 'workOrder.request:id,title,department_id'])
            ->groupBy('work_order_id')
            ->orderByDesc('total_quantity')
            ->limit(20)
            ->get();

        $monthlyConsumption = (clone $issuesBase)
            ->selectRaw('YEAR(issue_date) as year, MONTH(issue_date) as month, SUM(quantity_issued) as total_quantity, SUM(total_cost) as total_cost')
            ->groupByRaw('YEAR(issue_date), MONTH(issue_date)')
            ->orderByRaw('YEAR(issue_date), MONTH(issue_date)')
            ->get();

        $maintenanceCostByDepartment = (clone $issuesBase)
            ->join('work_orders', 'part_issues.work_order_id', '=', 'work_orders.id')
            ->leftJoin('maintenance_requests', 'work_orders.request_id', '=', 'maintenance_requests.id')
            ->leftJoin('departments', 'maintenance_requests.department_id', '=', 'departments.id')
            ->select(
                'maintenance_requests.department_id',
                'departments.name as department_name',
                DB::raw('SUM(part_issues.total_cost) as total_cost'),
                DB::raw('SUM(part_issues.quantity_issued) as total_quantity'),
                DB::raw('COUNT(part_issues.id) as issue_count')
            )
            ->groupBy('maintenance_requests.department_id', 'departments.name')
            ->orderByDesc('total_cost')
            ->get();

        $lowStockReport = $this->withPartImageUrls(
            $this->lowStockQuery()
                ->orderBy('quantity_available')
                ->get($this->sparePartColumns(includePrice: true))
        );

        $topPart = $mostIssuedParts->first();
        $topTechnician = $mostRequestedTechnicians->first();

        return response()->json([
            'success' => true,
            'range' => $range,
            'summary' => [
                'total_requests' => (clone $requestsBase)->count(),
                'pending_requests' => (clone $requestsBase)->where('status', 'pending')->count(),
                'approved_requests' => (clone $requestsBase)->where('status', 'approved')->count(),
                'rejected_requests' => (clone $requestsBase)->where('status', 'rejected')->count(),
                'total_issues' => (clone $issuesBase)->count(),
                'total_issue_cost' => (float) (clone $issuesBase)->sum('total_cost'),
            ],
            'highlights' => [
                'most_used_part' => $topPart,
                'most_requested_technician' => $topTechnician,
                'low_stock_count' => $lowStockReport->count(),
            ],
            'most_requested_parts' => (clone $requestsBase)
                ->select('part_id', DB::raw('SUM(quantity) as total_quantity'), DB::raw('COUNT(*) as request_count'))
                ->with($this->partRelationSelect())
                ->groupBy('part_id')
                ->orderByDesc('total_quantity')
                ->limit(10)
                ->get(),
            'most_issued_parts' => $mostIssuedParts,
            'monthly_usage' => $monthlyConsumption,
            'technician_usage' => $technicianUsage,
            'most_requested_technicians' => $mostRequestedTechnicians,
            // Added structured report blocks for supervisor-level consumption analytics.
            'most_used_parts' => $mostIssuedParts,
            'parts_usage_by_technician' => $technicianUsage,
            'parts_usage_by_work_order' => $workOrderUsage,
            'monthly_inventory_consumption' => $monthlyConsumption,
            'low_stock_report' => $lowStockReport,
            'maintenance_cost_by_department' => $maintenanceCostByDepartment,
        ]);
    }

    private function requestsQuery()
    {
        return PartRequest::query()->with([
            'workOrder:id,request_id,priority,work_status,created_at',
            'technician:id,fname,lname,phone',
            $this->partRelationSelect(),
            'recorder:id,fname,lname',
            'reviewer:id,fname,lname',
            'issue.issuedBy:id,fname,lname',
            'issue.part:id,name,part_code',
        ]);
    }

    private function issuesQuery()
    {
        return PartIssue::query()->with([
            'request:id,status,urgency,request_date',
            'workOrder:id,request_id,priority,work_status,created_at',
            'workOrder.request:id,title,status,department_id,created_at',
            'technician:id,fname,lname,phone',
            $this->partRelationSelect(),
            'issuedBy:id,fname,lname',
            'supervisor:id,fname,lname',
        ]);
    }

    private function techniciansQuery()
    {
        return User::query()->whereHas('roles', fn ($q) => $q->where('name', 'technician'));
    }

    private function sparePartsQuery()
    {
        return SparePart::query();
    }

    private function lowStockQuery()
    {
        return SparePart::query()->whereRaw('quantity_available < CASE WHEN COALESCE(minimum_stock, 0) > 5 THEN minimum_stock ELSE 5 END');
    }

    private function freshRequest(PartRequest $request): PartRequest
    {
        return $request->fresh([
            'workOrder:id,request_id,priority,work_status,created_at',
            'technician:id,fname,lname,phone',
            'part:id,name,part_code,quantity_available,minimum_stock',
            'recorder:id,fname,lname',
            'reviewer:id,fname,lname',
            'issue.issuedBy:id,fname,lname',
            'issue.part:id,name,part_code',
        ]) ?? $request;
    }

    private function freshIssue(PartIssue $issue): PartIssue
    {
        return $issue->fresh([
            'request:id,status,urgency,request_date',
            'workOrder:id,request_id,priority,work_status,created_at',
            'workOrder.request:id,title,status,department_id,created_at',
            'technician:id,fname,lname,phone',
            'part:id,name,part_code,quantity_available,minimum_stock',
            'issuedBy:id,fname,lname',
            'supervisor:id,fname,lname',
        ]) ?? $issue;
    }

    private function decorateRequestWithStock(PartRequest $request): PartRequest
    {
        $request->setAttribute('stock_available', (int) $request->part?->quantity_available);
        $request->setAttribute('minimum_stock', (int) $request->part?->minimum_stock);
        $request->setAttribute('has_stock', (int) $request->part?->quantity_available >= (int) $request->quantity);

        return $request;
    }

    private function stockSnapshot(SparePart $part, int $requestedQuantity = 0): array
    {
        $available = (int) $part->quantity_available;
        $minimum = (int) ($part->minimum_stock ?? 0);
        $threshold = max($minimum, 5);

        return [
            'part_id' => $part->id,
            'available' => $available,
            'requested' => $requestedQuantity,
            'sufficient' => $available >= $requestedQuantity,
            'low_stock' => $available < $threshold,
            'minimum_stock' => $minimum,
            'threshold' => $threshold,
        ];
    }

    private function validateSparePartPayload(Request $request, ?SparePart $part = null): array
    {
        $partCodeRule = Rule::unique('spare_parts', 'part_code');
        if ($part !== null) {
            $partCodeRule->ignore($part->id);
        }

        return $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'part_code' => ['required', 'string', 'max:80', $partCodeRule],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'quantity_available' => ['required', 'integer', 'min:0'],
            'minimum_stock' => ['nullable', 'integer', 'min:0'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);
    }

    private function resolveReportRange(string $range): array
    {
        return match ($range) {
            'weekly' => [now()->startOfWeek(), now()->startOfWeek()],
            'monthly' => [now()->startOfMonth(), now()->startOfMonth()],
            'yearly' => [now()->startOfYear(), now()->startOfYear()],
            default => [null, null],
        };
    }

    private function notifyTechnician(int $technicianId, string $type, string $message, string $module, int $relatedId): void
    {
        UserNotification::create([
            'user_id' => $technicianId,
            'recipient_role' => 'technician',
            'type' => $type,
            'module' => $module,
            'related_id' => $relatedId,
            'message' => $message,
            'is_read' => false,
        ]);

        $technician = User::query()->find($technicianId);
        EmailNotifier::sendToUser($technician, 'CMMS Notification', $message);
    }

    private function notifySupervisors(string $type, string $message, string $module, int $relatedId): void
    {
        $supervisors = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'supervisor'))
            ->get(['id']);

        foreach ($supervisors as $supervisor) {
            UserNotification::create([
                'user_id' => $supervisor->id,
                'recipient_role' => 'supervisor',
                'type' => $type,
                'module' => $module,
                'related_id' => $relatedId,
                'message' => $message,
                'is_read' => false,
            ]);
            EmailNotifier::sendToUser($supervisor, 'CMMS Notification', $message);
        }
    }

    private function resolveSupervisorForWorkOrder(WorkOrder $workOrder): ?User
    {
        if (!$workOrder->request_id) {
            return null;
        }

        $latestSupervisorLog = RequestStatusLog::query()
            ->where('request_id', $workOrder->request_id)
            ->whereIn('new_status', ['approved', 'assigned'])
            ->whereHas('changedBy.roles', fn ($q) => $q->where('name', 'supervisor'))
            ->latest('id')
            ->first();

        if ($latestSupervisorLog?->changedBy) {
            return $latestSupervisorLog->changedBy;
        }

        return User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'supervisor'))
            ->orderBy('id')
            ->first();
    }

    private function isWorkOrderApproved(WorkOrder $workOrder): bool
    {
        $requestStatus = $workOrder->request?->status;
        return in_array($requestStatus, ['approved', 'assigned', 'in_progress', 'completed', 'closed'], true);
    }

    private function fullName(?User $user): string
    {
        if (!$user) {
            return 'Unknown';
        }

        $name = trim("{$user->fname} {$user->lname}");
        return $name !== '' ? $name : 'Unknown';
    }

    private function issueCode(WorkOrder $workOrder, int $partRequestId): string
    {
        $woCode = $this->workOrderCode($workOrder->id, $workOrder->created_at);
        return sprintf('ISS-%s-%04d', $woCode, $partRequestId);
    }

    private function workOrderCode(?int $workOrderId, $createdAt): string
    {
        if (!$workOrderId) {
            return 'WO-UNKNOWN';
        }

        $year = now()->format('Y');
        if ($createdAt) {
            try {
                $year = \Illuminate\Support\Carbon::parse($createdAt)->format('Y');
            } catch (\Throwable) {
                $year = now()->format('Y');
            }
        }

        return sprintf('WO-%s-%03d', $year, $workOrderId);
    }
}
