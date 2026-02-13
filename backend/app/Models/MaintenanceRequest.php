<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MaintenanceRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'requester_id',
        'title',
        'description',
        'category_id',
        'building_id',
        'room_id',
        'custom_location',
        'asset_id',
        'priority',
        'status',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
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
}

