<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PreventiveMaintenancePlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'asset_id',
        'category_id',
        'frequency_type',
        'frequency_interval',
        'start_date',
        'next_due_date',
        'priority',
        'estimated_hours',
        'assigned_technician_id',
        'created_by',
        'status',
        'checklist',
    ];

    protected $casts = [
        'next_due_date' => 'date',
        'start_date' => 'date',
        'checklist' => 'array',
    ];

    public function asset()
    {
        return $this->belongsTo(Asset::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_technician_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function logs()
    {
        return $this->hasMany(PreventiveMaintenanceLog::class, 'plan_id');
    }

    public function assignments()
    {
        return $this->hasMany(PreventiveMaintenanceAssignment::class, 'plan_id');
    }

    public function calculateNextDueDate(): Carbon
    {
        $base = ($this->next_due_date instanceof Carbon ? $this->next_due_date : Carbon::parse($this->next_due_date))->copy();
        $interval = max(1, (int) $this->frequency_interval);

        return match ($this->frequency_type) {
            'daily' => $base->addDays($interval),
            'weekly' => $base->addWeeks($interval),
            'monthly' => $base->addMonthsNoOverflow($interval),
            'quarterly' => $base->addMonthsNoOverflow(3 * $interval),
            'yearly' => $base->addYearsNoOverflow($interval),
            default => $base->addMonth(),
        };
    }
}

