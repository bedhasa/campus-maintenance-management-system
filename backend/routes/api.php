<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\Requester\MaintenanceRequestController as RequesterMaintenanceRequestController;
use App\Http\Controllers\Api\Requester\MetadataController as RequesterMetadataController;
use App\Http\Controllers\Api\Requester\NotificationController as RequesterNotificationController;
use App\Http\Controllers\Api\Requester\ProfileController as RequesterProfileController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
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

        Route::get('/requests/{id}/status-logs', [RequesterMaintenanceRequestController::class, 'statusLogs']);

        Route::get('/requests/{id}/messages', [RequesterMaintenanceRequestController::class, 'messages']);
        Route::post('/requests/{id}/messages', [RequesterMaintenanceRequestController::class, 'addMessage']);
        Route::patch('/requests/{id}/messages/{messageId}', [RequesterMaintenanceRequestController::class, 'updateMessage']);
        Route::delete('/requests/{id}/messages/{messageId}', [RequesterMaintenanceRequestController::class, 'deleteMessage']);

        Route::get('/requests/{id}/images', [RequesterMaintenanceRequestController::class, 'images']);
        Route::post('/requests/{id}/images', [RequesterMaintenanceRequestController::class, 'addImage']);

        Route::get('/notifications', [RequesterNotificationController::class, 'index']);
        Route::patch('/notifications/{id}/read', [RequesterNotificationController::class, 'markRead']);
        Route::post('/notifications/read-all', [RequesterNotificationController::class, 'markAllRead']);

        Route::get('/profile', [RequesterProfileController::class, 'show']);
        Route::put('/profile', [RequesterProfileController::class, 'update']);
        Route::put('/settings/password', [RequesterProfileController::class, 'updatePassword']);

        Route::prefix('/meta')->group(function () {
            Route::get('/buildings', [RequesterMetadataController::class, 'buildings']);
            Route::get('/rooms', [RequesterMetadataController::class, 'rooms']);
            Route::get('/categories', [RequesterMetadataController::class, 'categories']);
            Route::get('/assets', [RequesterMetadataController::class, 'assets']);
        });
    });
});
