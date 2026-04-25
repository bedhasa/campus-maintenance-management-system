<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'request_id',
        'created_by',
        'assigned_to',
        'priority',
        'scheduled_date',
        'scheduled_time',
        'estimated_hours',
        'work_status',
        'completion_note',
        'problem_found',
        'action_taken',
        'delay_reason',
        'started_at',
        'paused_at',
        'resumed_at',
        'status_updated_at',
        'completed_by_technician_at',
        'completed_at',
    ];

    protected $casts = [
        'scheduled_date' => 'date',
        'started_at' => 'datetime',
        'paused_at' => 'datetime',
        'resumed_at' => 'datetime',
        'status_updated_at' => 'datetime',
        'completed_by_technician_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function request()
    {
        return $this->belongsTo(MaintenanceRequest::class, 'request_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function spareParts()
    {
        return $this->hasMany(WorkOrderSparePart::class, 'work_order_id');
    }

    public function preventiveMaintenanceLogs()
    {
        return $this->hasMany(PreventiveMaintenanceLog::class, 'work_order_id');
    }

    public function statusLogs()
    {
        return $this->hasMany(WorkOrderStatusLog::class, 'work_order_id');
    }
}
