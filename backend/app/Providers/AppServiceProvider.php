<?php

namespace App\Providers;

use App\Models\MaintenanceRequest;
use App\Models\UserNotification;
use App\Models\WorkOrder;
use App\Observers\UserNotificationObserver;
use App\Policies\MaintenanceRequestPolicy;
use App\Policies\UserManagementPolicy;
use App\Policies\WorkOrderPolicy;
use App\Support\FrontendUrl;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(MaintenanceRequest::class, MaintenanceRequestPolicy::class);
        Gate::policy(WorkOrder::class, WorkOrderPolicy::class);
        Gate::define('manage-users', [UserManagementPolicy::class, 'manage']);
        UserNotification::observe(UserNotificationObserver::class);

        ResetPassword::createUrlUsing(function (object $notifiable, string $token) {
            return FrontendUrl::resetPassword($token, $notifiable->getEmailForPasswordReset());
        });
    }
}
