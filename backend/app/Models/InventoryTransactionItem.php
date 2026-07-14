<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryTransactionItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'inventory_transaction_id',
        'spare_part_id',
        'quantity',
        'unit_price_snapshot',
        'total_price_snapshot',
        'part_code_snapshot',
        'part_name_snapshot',
        'unit_snapshot',
        'category_snapshot',
    ];

    protected $casts = [
        'unit_price_snapshot' => 'decimal:2',
        'total_price_snapshot' => 'decimal:2',
    ];

    public function transaction()
    {
        return $this->belongsTo(InventoryTransaction::class, 'inventory_transaction_id');
    }

    public function part()
    {
        return $this->belongsTo(SparePart::class, 'spare_part_id');
    }
}

