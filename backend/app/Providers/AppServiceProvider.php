<?php

namespace App\Providers;

use App\Models\MaintenanceRequest;
use App\Models\WorkOrder;
use App\Policies\MaintenanceRequestPolicy;
use App\Policies\UserManagementPolicy;
use App\Policies\WorkOrderPolicy;
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

        ResetPassword::createUrlUsing(function (object $notifiable, string $token) {
            $encodedToken = rawurlencode($token);
            $encodedEmail = rawurlencode($notifiable->getEmailForPasswordReset());
            return config('app.frontend_url')."/reset-password?token={$encodedToken}&email={$encodedEmail}";
        });
    }
}
