<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SparePart extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'name',
        'part_code',
        'unit_price',
        'quantity_available',
        'minimum_stock',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
    ];

    public function usages()
    {
        return $this->hasMany(WorkOrderSparePart::class, 'spare_part_id');
    }
}

