<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PartRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'work_order_id',
        'technician_id',
        'part_id',
        'quantity',
        'note',
        'urgency',
        'status',
        'request_date',
        'recorded_by',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'request_date' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function workOrder()
    {
        return $this->belongsTo(WorkOrder::class, 'work_order_id');
    }

    public function technician()
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function part()
    {
        return $this->belongsTo(SparePart::class, 'part_id');
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function issue()
    {
        return $this->hasOne(PartIssue::class, 'part_request_id');
    }
}
