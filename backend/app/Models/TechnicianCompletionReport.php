<?php

namespace App\Models;

use App\Casts\LenientJsonArray;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TechnicianCompletionReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'work_order_id',
        'technician_id',
        'issue_reported',
        'completion_note',
        'problem_found',
        'probable_cause',
        'probable_cause_custom',
        'diagnostic_steps',
        'action_taken',
        'delay_reason',
        'downtime_hours',
        'resolution_summary',
        'image_path',
        'attachment_paths',
        'submitted_at',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'downtime_hours' => 'decimal:2',
        'diagnostic_steps' => LenientJsonArray::class,
        'attachment_paths' => LenientJsonArray::class,
    ];

    public function workOrder()
    {
        return $this->belongsTo(WorkOrder::class, 'work_order_id');
    }

    public function technician()
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function spareParts()
    {
        return $this->hasMany(TechnicianCompletionReportSparePart::class, 'completion_report_id');
    }
}
