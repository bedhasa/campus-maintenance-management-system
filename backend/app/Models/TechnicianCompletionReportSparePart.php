<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TechnicianCompletionReportSparePart extends Model
{
    use HasFactory;

    protected $fillable = [
        'completion_report_id',
        'work_order_id',
        'technician_id',
        'spare_part_id',
        'quantity_used',
        'unit_price',
        'total_price',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
    ];

    public function completionReport()
    {
        return $this->belongsTo(TechnicianCompletionReport::class, 'completion_report_id');
    }

    public function sparePart()
    {
        return $this->belongsTo(SparePart::class, 'spare_part_id');
    }
}
