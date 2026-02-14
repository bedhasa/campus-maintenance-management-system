<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PreventiveMaintenanceLog extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'plan_id',
        'work_order_id',
        'performed_at',
        'notes',
        'created_at',
    ];

    protected $casts = [
        'performed_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function plan()
    {
        return $this->belongsTo(PreventiveMaintenancePlan::class, 'plan_id');
    }

    public function workOrder()
    {
        return $this->belongsTo(WorkOrder::class, 'work_order_id');
    }
}

