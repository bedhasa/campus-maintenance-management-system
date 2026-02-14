<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PreventiveMaintenanceAssignment extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'plan_id',
        'user_id',
        'assigned_by',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function plan()
    {
        return $this->belongsTo(PreventiveMaintenancePlan::class, 'plan_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}

