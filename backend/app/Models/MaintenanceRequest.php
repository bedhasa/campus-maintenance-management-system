<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MaintenanceRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'requester_id',
        'department_id',
        'title',
        'description',
        'category_id',
        'custom_category',
        'building_id',
        'room_id',
        'custom_location',
        'asset_id',
        'priority',
        'status',
        'due_date',
        'sla_hours',
        'is_overdue',
    ];

    protected $casts = [
        'due_date' => 'datetime',
        'is_overdue' => 'boolean',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function building()
    {
        return $this->belongsTo(Building::class);
    }

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function asset()
    {
        return $this->belongsTo(Asset::class);
    }

    public function statusLogs()
    {
        return $this->hasMany(RequestStatusLog::class, 'request_id');
    }

    public function messages()
    {
        return $this->hasMany(RequestMessage::class, 'request_id');
    }

    public function images()
    {
        return $this->hasMany(RequestImage::class, 'request_id');
    }

    public function workOrders()
    {
        return $this->hasMany(WorkOrder::class, 'request_id');
    }

    public function rating()
    {
        return $this->hasOne(TechnicianRating::class, 'request_id');
    }
}
