<?php

use App\Http\Controllers\Account\VendorController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-vendors'])
    ->controller(VendorController::class)
    ->prefix('account/vendors')
    ->name('account.vendors.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('create', 'create')->middleware('permission:create-vendors')->name('create');
        Route::post('/', 'store')->middleware('permission:create-vendors')->name('store');
        Route::get('{vendor}/edit', 'edit')->middleware('permission:edit-vendors')->name('edit');
        Route::put('{vendor}', 'update')->middleware('permission:edit-vendors')->name('update');
        Route::delete('{vendor}', 'destroy')->middleware('permission:delete-vendors')->name('destroy');
    });
