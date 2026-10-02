<?php

use App\Http\Controllers\Account\BankTransactionController;
use App\Http\Controllers\Account\BankTransferController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->prefix('account')->name('account.')->group(function () {
    Route::middleware('permission:manage-bank-transfers')
        ->controller(BankTransferController::class)
        ->prefix('bank-transfers')
        ->name('bank-transfers.')
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::post('/', 'store')->middleware('permission:create-bank-transfers')->name('store');
            Route::put('{bankTransfer}', 'update')->middleware('permission:edit-bank-transfers')->name('update');
            Route::delete('{bankTransfer}', 'destroy')->middleware('permission:delete-bank-transfers')->name('destroy');
            Route::put('{bankTransfer}/process', 'process')->middleware('permission:process-bank-transfers')->name('process');
        });

    Route::middleware('permission:manage-bank-transactions')
        ->controller(BankTransactionController::class)
        ->prefix('bank-transactions')
        ->name('bank-transactions.')
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::put('{item}/reconcile', 'reconcile')->middleware('permission:reconcile-bank-transactions')->name('reconcile');
        });
});
