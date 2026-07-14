<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SparePartRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'request_number',
        'technician_id',
        'work_order_id',
        'title',
        'description',
        'urgency',
        'needed_date',
        'status',
        'approved_by',
        'approved_at',
        'approval_note',
        'rejected_by',
        'rejected_at',
        'rejection_reason',
        'pickup_deadline',
        'expired_at',
        'collected_by',
        'collected_at',
        'stock_deducted_at',
        'stock_rolled_back_at',
    ];

    protected $casts = [
        'needed_date' => 'date',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'pickup_deadline' => 'datetime',
        'expired_at' => 'datetime',
        'collected_at' => 'datetime',
        'stock_deducted_at' => 'datetime',
        'stock_rolled_back_at' => 'datetime',
    ];

    public function technician()
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function workOrder()
    {
        return $this->belongsTo(WorkOrder::class, 'work_order_id');
    }

    public function items()
    {
        return $this->hasMany(SparePartRequestItem::class, 'spare_part_request_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejecter()
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function collector()
    {
        return $this->belongsTo(User::class, 'collected_by');
    }

    public function inventoryTransactions()
    {
        return $this->hasMany(InventoryTransaction::class, 'spare_part_request_id');
    }
}

