<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SparePartRequestItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'spare_part_request_id',
        'spare_part_id',
        'requested_quantity',
        'approved_quantity',
        'part_code_snapshot',
        'part_name_snapshot',
        'unit_snapshot',
        'category_snapshot',
        'unit_price_snapshot',
    ];

    protected $casts = [
        'unit_price_snapshot' => 'decimal:2',
    ];

    public function request()
    {
        return $this->belongsTo(SparePartRequest::class, 'spare_part_request_id');
    }

    public function part()
    {
        return $this->belongsTo(SparePart::class, 'spare_part_id');
    }
}

