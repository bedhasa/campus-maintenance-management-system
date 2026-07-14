<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'transaction_code',
        'type',
        'spare_part_request_id',
        'performed_by',
        'performed_at',
        'note',
    ];

    protected $casts = [
        'performed_at' => 'datetime',
    ];

    public function request()
    {
        return $this->belongsTo(SparePartRequest::class, 'spare_part_request_id');
    }

    public function performer()
    {
        return $this->belongsTo(User::class, 'performed_by');
    }

    public function items()
    {
        return $this->hasMany(InventoryTransactionItem::class, 'inventory_transaction_id');
    }
}

