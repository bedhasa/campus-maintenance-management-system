<?php

namespace App\Console\Commands;

use App\Models\MaintenanceRequest;
use App\Models\SparePart;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\EmailNotifier;
use Illuminate\Console\Command;

class SendOperationalEmailAlerts extends Command
{
    protected $signature = 'alerts:send-operational-emails';
    protected $description = 'Send operational CMMS email alerts by role.';

    public function handle(): int
    {
        $now = now();
        $windowStart = $now->copy()->subHour();

        $supervisors = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'supervisor'))
            ->get(['id', 'email', 'fname', 'lname']);

        $inventoryOfficers = User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', 'inventory_officer'))
            ->get(['id', 'email', 'fname', 'lname']);

        $newSubmittedCount = MaintenanceRequest::query()
            ->where('status', 'submitted')
            ->where('created_at', '>=', $windowStart)
            ->count();

        $delayedWorkOrderCount = WorkOrder::query()
            ->whereIn('work_status', ['assigned', 'in_progress', 'paused'])
            ->whereHas('request', fn ($q) => $q
                ->whereNotNull('due_date')
                ->where('due_date', '<', $now)
                ->whereNotIn('status', ['completed', 'closed', 'rejected', 'cancelled']))
            ->count();

        $completedWorkOrderCount = WorkOrder::query()
            ->where('work_status', 'completed')
            ->where('updated_at', '>=', $windowStart)
            ->count();

        if ($newSubmittedCount > 0 || $delayedWorkOrderCount > 0 || $completedWorkOrderCount > 0) {
            $message = "Supervisor alerts summary:\n"
                . "- New submitted requests (last hour): {$newSubmittedCount}\n"
                . "- Delayed work orders: {$delayedWorkOrderCount}\n"
                . "- Newly completed work orders (last hour): {$completedWorkOrderCount}";

            foreach ($supervisors as $supervisor) {
                EmailNotifier::sendToUser($supervisor, 'CMMS Supervisor Alerts', $message);
            }
        }

        $lowStockCount = SparePart::query()
            ->whereRaw('quantity_available < CASE WHEN COALESCE(minimum_stock, 0) > 5 THEN minimum_stock ELSE 5 END')
            ->count();

        if ($lowStockCount > 0) {
            $message = "Inventory alert:\n- Low stock items detected: {$lowStockCount}\nPlease review the low-stock list in the Inventory module.";
            foreach ($inventoryOfficers as $officer) {
                EmailNotifier::sendToUser($officer, 'CMMS Low Stock Alert', $message);
            }
        }

        $this->info('Operational email alerts processed.');
        return self::SUCCESS;
    }
}

