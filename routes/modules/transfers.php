<?php

use App\Http\Controllers\Purchase\StockTransferController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-transfers'])
    ->controller(StockTransferController::class)
    ->prefix('transfers')
    ->name('transfers.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->middleware('permission:create-transfers')->name('store');
        Route::delete('{transfer}', 'destroy')->middleware('permission:delete-transfers')->name('destroy');
    });
