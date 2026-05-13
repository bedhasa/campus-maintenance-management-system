<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class PreventiveMaintenance extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'scheduled_date' => 'date',
    ];

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_technician_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'asset_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function checklists(): HasMany
    {
        return $this->hasMany(PreventiveMaintenanceChecklist::class, 'preventive_maintenance_id');
    }

    public function report(): HasOne
    {
        return $this->hasOne(PreventiveMaintenanceReport::class, 'preventive_maintenance_id');
    }
}
