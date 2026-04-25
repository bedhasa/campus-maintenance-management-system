<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory;

    protected $fillable = [
        'fname',
        'lname',
        'username',
        'email',
        'password',
        'university_id_number',
        'dept_id',
        'phone',
        'otp',
        'otp_expires_at',
        'is_verified',
        'profile_picture',
        'avg_rating',
        'total_ratings',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'otp',
    ];

    protected $casts = [
        'is_verified' => 'boolean',
        'otp_expires_at' => 'datetime',
    ];

    // Relationship: User belongs to Department
    public function department()
    {
        return $this->belongsTo(Department::class, 'dept_id');
    }

    // Relationship: User belongs to many Roles
    public function roles()
    {
        return $this->belongsToMany(Role::class, 'role_user', 'user_id', 'role_id');
    }

    // Helper: Check if user has role
    public function hasRole($roleName)
    {
        return $this->roles()->where('name', $roleName)->exists();
    }

    public function maintenanceRequests()
    {
        return $this->hasMany(MaintenanceRequest::class, 'requester_id');
    }

    public function requestMessages()
    {
        return $this->hasMany(RequestMessage::class, 'sender_id');
    }

    public function requestStatusLogs()
    {
        return $this->hasMany(RequestStatusLog::class, 'changed_by');
    }

    public function notifications()
    {
        return $this->hasMany(UserNotification::class, 'user_id');
    }

    public function setting()
    {
        return $this->hasOne(UserSetting::class, 'user_id');
    }

    public function createdWorkOrders()
    {
        return $this->hasMany(WorkOrder::class, 'created_by');
    }

    public function assignedWorkOrders()
    {
        return $this->hasMany(WorkOrder::class, 'assigned_to');
    }

    public function technicianSpecialties()
    {
        return $this->hasMany(TechnicianSpecialty::class, 'user_id');
    }

    public function specialties()
    {
        return $this->belongsToMany(Specialty::class, 'technician_specialties', 'user_id', 'specialty_id');
    }

    public function receivedRatings()
    {
        return $this->hasMany(TechnicianRating::class, 'technician_id');
    }

    public function submittedRatings()
    {
        return $this->hasMany(TechnicianRating::class, 'requester_id');
    }

    public function activityLogs()
    {
        return $this->hasMany(SystemActivityLog::class, 'user_id');
    }

    public function partRequestsRecorded()
    {
        return $this->hasMany(PartRequest::class, 'recorded_by');
    }

    public function partRequestsReviewed()
    {
        return $this->hasMany(PartRequest::class, 'reviewed_by');
    }

    public function partIssuesIssued()
    {
        return $this->hasMany(PartIssue::class, 'issued_by');
    }
}
