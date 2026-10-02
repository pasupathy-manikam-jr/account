<?php

use App\Http\Controllers\Account\AccountTypeController;
use App\Http\Controllers\Account\BankAccountController;
use App\Http\Controllers\Account\ChartOfAccountController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->prefix('account')->name('account.')->group(function () {
    Route::middleware('permission:manage-account-types')
        ->controller(AccountTypeController::class)
        ->prefix('account-types')
        ->name('account-types.')
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::post('/', 'store')->middleware('permission:create-account-types')->name('store');
            Route::put('{accountType}', 'update')->middleware('permission:edit-account-types')->name('update');
            Route::delete('{accountType}', 'destroy')->middleware('permission:delete-account-types')->name('destroy');
        });

    Route::middleware('permission:manage-chart-of-accounts')
        ->controller(ChartOfAccountController::class)
        ->prefix('chart-of-accounts')
        ->name('chart-of-accounts.')
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::post('/', 'store')->middleware('permission:create-chart-of-accounts')->name('store');
            Route::get('{chartOfAccount}', 'show')->middleware('permission:view-chart-of-accounts')->name('show');
            Route::put('{chartOfAccount}', 'update')->middleware('permission:edit-chart-of-accounts')->name('update');
            Route::delete('{chartOfAccount}', 'destroy')->middleware('permission:delete-chart-of-accounts')->name('destroy');
        });

    Route::middleware('permission:manage-bank-accounts')
        ->controller(BankAccountController::class)
        ->prefix('bank-accounts')
        ->name('bank-accounts.')
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::post('/', 'store')->middleware('permission:create-bank-accounts')->name('store');
            Route::put('{bankAccount}', 'update')->middleware('permission:edit-bank-accounts')->name('update');
            Route::delete('{bankAccount}', 'destroy')->middleware('permission:delete-bank-accounts')->name('destroy');
        });
});
