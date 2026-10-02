<?php

use App\Http\Controllers\WarehouseController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-warehouses'])
    ->controller(WarehouseController::class)
    ->prefix('warehouses')
    ->name('warehouses.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->middleware('permission:create-warehouses')->name('store');
        Route::put('{warehouse}', 'update')->middleware('permission:edit-warehouses')->name('update');
        Route::delete('{warehouse}', 'destroy')->middleware('permission:delete-warehouses')->name('destroy');
    });
