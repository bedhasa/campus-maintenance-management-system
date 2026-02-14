<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'language',
        'dark_mode',
        'font_size',
        'notify_status',
        'notify_chat',
        'notify_feedback',
        'default_building_id',
        'default_room_id',
        'timezone',
    ];

    protected $casts = [
        'dark_mode' => 'boolean',
        'notify_status' => 'boolean',
        'notify_chat' => 'boolean',
        'notify_feedback' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function defaultBuilding()
    {
        return $this->belongsTo(Building::class, 'default_building_id');
    }

    public function defaultRoom()
    {
        return $this->belongsTo(Room::class, 'default_room_id');
    }
}

