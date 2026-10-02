<?php

use App\Http\Controllers\Sales\RetainerController;
use App\Http\Controllers\Sales\RetainerPaymentController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-retainer'])
    ->controller(RetainerController::class)
    ->prefix('retainers')
    ->name('retainers.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('create', 'create')->middleware('permission:create-retainer')->name('create');
        Route::post('/', 'store')->middleware('permission:create-retainer')->name('store');
        Route::get('{retainer}', 'show')->middleware('permission:view-retainer')->name('show');
        Route::get('{retainer}/edit', 'edit')->middleware('permission:edit-retainer')->name('edit');
        Route::put('{retainer}', 'update')->middleware('permission:edit-retainer')->name('update');
        Route::delete('{retainer}', 'destroy')->middleware('permission:delete-retainer')->name('destroy');
        Route::put('{retainer}/send', 'send')->middleware('permission:sent-retainer')->name('send');
        Route::put('{retainer}/accept', 'accept')->middleware('permission:accept-retainer')->name('accept');
        Route::put('{retainer}/reject', 'reject')->middleware('permission:reject-retainer')->name('reject');
        Route::post('{retainer}/convert', 'convert')->middleware('permission:convert-to-invoice-retainer')->name('convert');
        Route::post('{retainer}/duplicate', 'duplicate')->middleware('permission:duplicate-retainer')->name('duplicate');
        Route::get('{retainer}/pdf', 'pdf')->middleware('permission:print-retainer')->name('pdf');
    });

Route::middleware(['auth', 'verified', 'permission:manage-retainer-payments'])
    ->controller(RetainerPaymentController::class)
    ->prefix('retainer-payments')
    ->name('retainer-payments.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('create', 'create')->middleware('permission:create-retainer-payments')->name('create');
        Route::post('/', 'store')->middleware('permission:create-retainer-payments')->name('store');
        Route::get('{retainerPayment}', 'show')->middleware('permission:view-retainer-payments')->name('show');
        Route::delete('{retainerPayment}', 'destroy')->middleware('permission:delete-retainer-payments')->name('destroy');
        Route::put('{retainerPayment}/clear', 'clear')->middleware('permission:cleared-retainer-payments')->name('clear');
        Route::put('{retainerPayment}/cancel', 'cancel')->middleware('permission:cancelled-retainer-payments')->name('cancel');
    });
