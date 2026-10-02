<?php

use App\Http\Controllers\Account\DebitNoteController;
use App\Http\Controllers\Purchase\PurchaseReturnController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-purchase-return-invoices'])
    ->controller(PurchaseReturnController::class)
    ->prefix('purchase-returns')
    ->name('purchase-returns.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('create', 'create')->middleware('permission:create-purchase-return-invoices')->name('create');
        Route::post('/', 'store')->middleware('permission:create-purchase-return-invoices')->name('store');
        Route::get('{purchaseReturn}', 'show')->middleware('permission:view-purchase-return-invoices')->name('show');
        Route::delete('{purchaseReturn}', 'destroy')->middleware('permission:delete-purchase-return-invoices')->name('destroy');
        Route::put('{purchaseReturn}/approve', 'approve')->middleware('permission:approve-purchase-returns-invoices')->name('approve');
        Route::put('{purchaseReturn}/complete', 'complete')->middleware('permission:complete-purchase-returns-invoices')->name('complete');
    });

Route::middleware(['auth', 'verified', 'permission:manage-debit-notes'])
    ->controller(DebitNoteController::class)
    ->prefix('account/debit-notes')
    ->name('account.debit-notes.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('{debitNote}', 'show')->middleware('permission:view-debit-notes')->name('show');
        Route::put('{debitNote}/approve', 'approve')->middleware('permission:approve-debit-notes')->name('approve');
        Route::delete('{debitNote}', 'destroy')->middleware('permission:delete-debit-notes')->name('destroy');
    });
