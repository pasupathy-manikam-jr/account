<?php

use App\Http\Controllers\Account\CustomerController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-customers'])
    ->controller(CustomerController::class)
    ->prefix('account/customers')
    ->name('account.customers.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('create', 'create')->middleware('permission:create-customers')->name('create');
        Route::post('/', 'store')->middleware('permission:create-customers')->name('store');
        Route::get('{customer}/edit', 'edit')->middleware('permission:edit-customers')->name('edit');
        Route::put('{customer}', 'update')->middleware('permission:edit-customers')->name('update');
        Route::delete('{customer}', 'destroy')->middleware('permission:delete-customers')->name('destroy');
    });
