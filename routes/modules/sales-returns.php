<?php

use App\Http\Controllers\Account\CreditNoteController;
use App\Http\Controllers\Sales\SalesReturnController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-sales-return-invoices'])
    ->controller(SalesReturnController::class)
    ->prefix('sales-returns')
    ->name('sales-returns.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('create', 'create')->middleware('permission:create-sales-return-invoices')->name('create');
        Route::post('/', 'store')->middleware('permission:create-sales-return-invoices')->name('store');
        Route::get('{salesReturn}', 'show')->middleware('permission:view-sales-return-invoices')->name('show');
        Route::delete('{salesReturn}', 'destroy')->middleware('permission:delete-sales-return-invoices')->name('destroy');
        Route::put('{salesReturn}/approve', 'approve')->middleware('permission:approve-sales-returns-invoices')->name('approve');
        Route::put('{salesReturn}/complete', 'complete')->middleware('permission:complete-sales-returns-invoices')->name('complete');
    });

Route::middleware(['auth', 'verified', 'permission:manage-credit-notes'])
    ->controller(CreditNoteController::class)
    ->prefix('account/credit-notes')
    ->name('account.credit-notes.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('{creditNote}', 'show')->middleware('permission:view-credit-notes')->name('show');
        Route::put('{creditNote}/approve', 'approve')->middleware('permission:approve-credit-notes')->name('approve');
        Route::delete('{creditNote}', 'destroy')->middleware('permission:delete-credit-notes')->name('destroy');
    });
