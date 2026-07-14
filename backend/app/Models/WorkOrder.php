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
        'title',
        'description',
        'category_id',
        'building_id',
        'room_id',
        'custom_location',
        'priority',
        'scheduled_date',
        'scheduled_time',
        'scheduled_start_date',
        'scheduled_end_date',
        'scheduled_start_time',
        'scheduled_end_time',
        'schedule_note',
        'notification_status',
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
        'scheduled_start_date' => 'date',
        'scheduled_end_date' => 'date',
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

    public function category()
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function building()
    {
        return $this->belongsTo(Building::class, 'building_id');
    }

    public function room()
    {
        return $this->belongsTo(Room::class, 'room_id');
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

    public function technicianProgressNotes()
    {
        return $this->hasMany(TechnicianProgressNote::class, 'work_order_id');
    }

    public function technicianCompletionReport()
    {
        return $this->hasOne(TechnicianCompletionReport::class, 'work_order_id');
    }
}
