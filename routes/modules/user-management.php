<?php

use App\Http\Controllers\UserManagement\RoleController;
use App\Http\Controllers\UserManagement\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::middleware('permission:manage-roles')->controller(RoleController::class)->prefix('roles')->name('roles.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('create', 'create')->middleware('permission:create-roles')->name('create');
        Route::post('/', 'store')->middleware('permission:create-roles')->name('store');
        Route::get('{role}/edit', 'edit')->middleware('permission:edit-roles')->name('edit');
        Route::put('{role}', 'update')->middleware('permission:edit-roles')->name('update');
        Route::delete('{role}', 'destroy')->middleware('permission:delete-roles')->name('destroy');
    });

    Route::middleware('permission:manage-users')->controller(UserController::class)->prefix('users')->name('users.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->middleware('permission:create-users')->name('store');
        Route::put('{user}', 'update')->middleware('permission:edit-users')->name('update');
        Route::delete('{user}', 'destroy')->middleware('permission:delete-users')->name('destroy');
        Route::put('{user}/password', 'password')->middleware('permission:change-password-users')->name('password');
        Route::put('{user}/toggle-login', 'toggle')->middleware('permission:toggle-status-users')->name('toggle');
    });
});
