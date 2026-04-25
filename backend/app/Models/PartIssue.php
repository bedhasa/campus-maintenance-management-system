<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PartIssue extends Model
{
    use HasFactory;

    protected $fillable = [
        'issue_code',
        'part_request_id',
        'work_order_id',
        'technician_id',
        'part_id',
        'part_name_snapshot',
        'quantity_issued',
        'unit_cost',
        'total_cost',
        'issued_by',
        'inventory_officer_name_snapshot',
        'technician_name_snapshot',
        'supervisor_id',
        'supervisor_name_snapshot',
        'issue_date',
    ];

    protected $casts = [
        'issue_date' => 'datetime',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
    ];

    public function request()
    {
        return $this->belongsTo(PartRequest::class, 'part_request_id');
    }

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

    public function issuedBy()
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    public function supervisor()
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }
}
