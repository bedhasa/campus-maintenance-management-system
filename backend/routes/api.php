<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AssetManagementController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\MeNotificationController;
use App\Http\Controllers\Api\MeProfileController;
use App\Http\Controllers\Api\MeSettingsController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\OtpVerificationController;
use App\Http\Controllers\Api\PreventiveMaintenanceController;
use App\Http\Controllers\Api\Requester\MaintenanceRequestController as RequesterMaintenanceRequestController;
use App\Http\Controllers\Api\Requester\MetadataController as RequesterMetadataController;
use App\Http\Controllers\Api\Requester\NotificationController as RequesterNotificationController;
use App\Http\Controllers\Api\PMModuleController;
use App\Http\Controllers\Api\Requester\ProfileController as RequesterProfileController;
use App\Http\Controllers\Api\Requester\SettingsController as RequesterSettingsController;
use App\Http\Controllers\Api\RequesterFeedbackController;
use App\Http\Controllers\Api\SupervisorController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\TechnicianController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/verify-otp', [OtpVerificationController::class, 'verify']);
Route::post('/resend-otp', [OtpVerificationController::class, 'resend']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);
Route::get('/departments', [MetaController::class, 'departments']);
Route::get('/roles', [MetaController::class, 'roles']);

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/select-role', [AuthController::class, 'selectRole']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::prefix('/requester')->group(function () {
        Route::get('/dashboard', [RequesterMaintenanceRequestController::class, 'dashboard']);
        Route::get('/requests', [RequesterMaintenanceRequestController::class, 'index']);
        Route::post('/requests', [RequesterMaintenanceRequestController::class, 'store']);
        Route::get('/requests/{id}', [RequesterMaintenanceRequestController::class, 'show']);
        Route::put('/requests/{id}', [RequesterMaintenanceRequestController::class, 'update']);
        Route::patch('/requests/{id}/cancel', [RequesterMaintenanceRequestController::class, 'cancel']);

        Route::get('/requests/{id}/status-logs', [RequesterMaintenanceRequestController::class, 'statusLogs']);

        Route::get('/requests/{id}/messages', [RequesterMaintenanceRequestController::class, 'messages']);
        Route::post('/requests/{id}/messages', [RequesterMaintenanceRequestController::class, 'addMessage']);
        Route::patch('/requests/{id}/messages/{messageId}', [RequesterMaintenanceRequestController::class, 'updateMessage']);
        Route::delete('/requests/{id}/messages/{messageId}', [RequesterMaintenanceRequestController::class, 'deleteMessage']);

        Route::get('/requests/{id}/images', [RequesterMaintenanceRequestController::class, 'images']);
        Route::post('/requests/{id}/images', [RequesterMaintenanceRequestController::class, 'addImage']);
        Route::patch('/requests/{id}/verify-completion', [RequesterMaintenanceRequestController::class, 'verifyCompletion']);
        Route::patch('/requests/{id}/reopen', [RequesterMaintenanceRequestController::class, 'reopen']);
        Route::post('/requests/{id}/rating', [RequesterFeedbackController::class, 'rate']);

        Route::get('/notifications', [RequesterNotificationController::class, 'index']);
        Route::patch('/notifications/{id}/read', [RequesterNotificationController::class, 'markRead']);
        Route::post('/notifications/read-all', [RequesterNotificationController::class, 'markAllRead']);

        Route::get('/profile', [RequesterProfileController::class, 'show']);
        Route::put('/profile', [RequesterProfileController::class, 'update']);
        Route::get('/settings', [RequesterSettingsController::class, 'show']);
        Route::put('/settings', [RequesterSettingsController::class, 'update']);
        Route::put('/settings/password', [RequesterProfileController::class, 'updatePassword']);

        Route::prefix('/meta')->group(function () {
            Route::get('/buildings', [RequesterMetadataController::class, 'buildings']);
            Route::get('/rooms', [RequesterMetadataController::class, 'rooms']);
            Route::get('/categories', [RequesterMetadataController::class, 'categories']);
            Route::get('/assets', [RequesterMetadataController::class, 'assets']);
        });
    });

    Route::prefix('/me')->group(function () {
        Route::get('/profile', [MeProfileController::class, 'show']);
        Route::put('/profile', [MeProfileController::class, 'update']);
        Route::put('/password', [MeProfileController::class, 'updatePassword']);

        Route::get('/settings', [MeSettingsController::class, 'show']);
        Route::put('/settings', [MeSettingsController::class, 'update']);

        Route::get('/notifications', [MeNotificationController::class, 'index']);
        Route::patch('/notifications/{id}/read', [MeNotificationController::class, 'markRead']);
        Route::post('/notifications/read-all', [MeNotificationController::class, 'markAllRead']);
    });

    Route::prefix('/supervisor')->group(function () {
        Route::get('/dashboard', [SupervisorController::class, 'dashboard']);
        Route::get('/requests', [SupervisorController::class, 'requests']);
        Route::get('/requests/{id}', [SupervisorController::class, 'showRequest']);
        Route::post('/requests/{id}/messages', [SupervisorController::class, 'addRequestMessage']);
        Route::patch('/requests/{id}/messages/{messageId}', [SupervisorController::class, 'updateRequestMessage']);
        Route::delete('/requests/{id}/messages/{messageId}', [SupervisorController::class, 'deleteRequestMessage']);
        Route::patch('/requests/{id}/review', [SupervisorController::class, 'review']);
        Route::patch('/requests/{id}/review/undo', [SupervisorController::class, 'undoReview']);
        Route::patch('/requests/{id}/assign', [SupervisorController::class, 'assign']);
        Route::patch('/requests/{id}/close', [SupervisorController::class, 'close']);
        Route::patch('/requests/{id}/reopen', [SupervisorController::class, 'reopen']);
        Route::get('/work-orders', [SupervisorController::class, 'workOrders']);
        Route::get('/work-orders/{id}', [SupervisorController::class, 'showWorkOrder']);
        Route::patch('/work-orders/{id}/close', [SupervisorController::class, 'closeManualWorkOrder']);
        Route::patch('/work-orders/{id}/reassign', [SupervisorController::class, 'reassignWorkOrder']);
        Route::get('/technicians/by-category', [SupervisorController::class, 'techniciansForCategory']);
        Route::get('/technicians/{id}', [SupervisorController::class, 'technicianProfile']);
        Route::post('/work-orders/manual', [SupervisorController::class, 'createManualWorkOrder']);
        Route::get('/assets', [AssetManagementController::class, 'index']);
        Route::post('/assets', [AssetManagementController::class, 'store']);
        Route::put('/assets/{id}', [AssetManagementController::class, 'update']);
        Route::get('/facilities/buildings', [AssetManagementController::class, 'listBuildings']);
        Route::post('/facilities/buildings', [AssetManagementController::class, 'storeBuilding']);
        Route::put('/facilities/buildings/{id}', [AssetManagementController::class, 'updateBuilding']);
        Route::get('/facilities/departments', [AssetManagementController::class, 'listDepartments']);
        Route::post('/facilities/departments', [AssetManagementController::class, 'storeDepartment']);
        Route::put('/facilities/departments/{id}', [AssetManagementController::class, 'updateDepartment']);
        Route::get('/facilities/rooms', [AssetManagementController::class, 'listRooms']);
        Route::post('/facilities/rooms', [AssetManagementController::class, 'storeRoom']);
        Route::put('/facilities/rooms/{id}', [AssetManagementController::class, 'updateRoom']);
        Route::get('/analytics', [SupervisorController::class, 'analytics']);
        Route::get('/reports', [SupervisorController::class, 'reports']);

        Route::prefix('/custom-pm')->group(function () {
            Route::get('/', [PMModuleController::class, 'indexSupervisor']);
            Route::post('/', [PMModuleController::class, 'store']);
        });
    });

    // Supervisor analytics aliases for unified frontend endpoint contracts.
    Route::get('/analytics', [SupervisorController::class, 'analytics']);
    Route::get('/analytics/export', [SupervisorController::class, 'reports']);

    Route::prefix('/technician')->group(function () {
        Route::get('/dashboard', [TechnicianController::class, 'dashboard']);
        Route::get('/spare-parts', [TechnicianController::class, 'spareParts']);
        Route::get('/work-orders', [TechnicianController::class, 'index']);
        Route::get('/work-orders/{id}', [TechnicianController::class, 'show']);
        Route::patch('/work-orders/{id}/start', [TechnicianController::class, 'start']);
        Route::patch('/work-orders/{id}/decline', [TechnicianController::class, 'decline']);
        Route::patch('/work-orders/{id}/pause', [TechnicianController::class, 'pause']);
        Route::post('/work-orders/{id}/progress-note', [TechnicianController::class, 'addProgressNote']);
        Route::patch('/work-orders/{id}/delay', [TechnicianController::class, 'reportDelay']);
        Route::post('/work-orders/{id}/complete', [TechnicianController::class, 'complete']);
        Route::patch('/work-orders/{id}/complete', [TechnicianController::class, 'complete']);

        Route::prefix('/custom-pm')->group(function () {
            Route::get('/', [PMModuleController::class, 'indexTechnician']);
            Route::get('/{id}', [PMModuleController::class, 'showTechnician']);
            Route::patch('/{id}/accept', [PMModuleController::class, 'acceptTask']);
            Route::patch('/{id}/checklist/{checklistId}', [PMModuleController::class, 'updateChecklist']);
            Route::post('/{id}/complete', [PMModuleController::class, 'completeTask']);
        });
    });

    Route::prefix('/inventory')->group(function () {
        Route::get('/dashboard', [InventoryController::class, 'dashboard']);
        Route::get('/meta', [InventoryController::class, 'meta']);
        Route::get('/spare-parts', [InventoryController::class, 'spareParts']);
        Route::post('/spare-parts', [InventoryController::class, 'storeSparePart']);
        Route::put('/spare-parts/{id}', [InventoryController::class, 'updateSparePart']);
        Route::get('/low-stock', [InventoryController::class, 'lowStock']);
        Route::post('/part-requests', [InventoryController::class, 'recordRequest']);
        Route::get('/part-requests', [InventoryController::class, 'requests']);
        Route::patch('/part-requests/{id}/review', [InventoryController::class, 'reviewRequest']);
        Route::post('/part-requests/{id}/issue', [InventoryController::class, 'issue']);
        Route::get('/part-issues', [InventoryController::class, 'issues']);
        Route::get('/reports', [InventoryController::class, 'reports']);
    });

    Route::prefix('/pm')->group(function () {
        Route::get('/plans', [PreventiveMaintenanceController::class, 'index']);
        Route::get('/plans/{id}', [PreventiveMaintenanceController::class, 'show']);
        Route::post('/plans', [PreventiveMaintenanceController::class, 'store']);
        Route::put('/plans/{id}', [PreventiveMaintenanceController::class, 'update']);
        Route::delete('/plans/{id}', [PreventiveMaintenanceController::class, 'destroy']);
        Route::post('/trigger-due', [PreventiveMaintenanceController::class, 'triggerDue']);
        Route::get('/technicians', [PreventiveMaintenanceController::class, 'technicians']);
    });

    Route::prefix('/admin')->group(function () {
        Route::get('/dashboard', [AdminController::class, 'dashboard']);
        Route::get('/users', [AdminController::class, 'users']);
        Route::post('/users', [AdminController::class, 'createUser']);
        Route::put('/users/{id}', [AdminController::class, 'updateUser']);
        Route::post('/users/{id}/reset-password', [AdminController::class, 'resetPassword']);
        Route::get('/system-logs', [AdminController::class, 'systemLogs']);
    });
});
