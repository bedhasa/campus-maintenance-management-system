<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PreventiveMaintenanceSparePart extends Model
{
    use HasFactory;

    protected $fillable = [
        'preventive_maintenance_id',
        'spare_part_id',
        'quantity_used',
        'unit_price',
        'total_price',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
    ];

    public function preventiveMaintenance(): BelongsTo
    {
        return $this->belongsTo(PreventiveMaintenance::class, 'preventive_maintenance_id');
    }

    public function sparePart(): BelongsTo
    {
        return $this->belongsTo(SparePart::class, 'spare_part_id');
    }
}
