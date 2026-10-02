<?php

use App\Http\Controllers\Purchase\PurchaseInvoiceController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-purchase-invoices'])
    ->controller(PurchaseInvoiceController::class)
    ->prefix('purchase-invoices')
    ->name('purchase-invoices.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('create', 'create')->middleware('permission:create-purchase-invoices')->name('create');
        Route::post('/', 'store')->middleware('permission:create-purchase-invoices')->name('store');
        Route::get('{purchaseInvoice}', 'show')->middleware('permission:view-purchase-invoices')->name('show');
        Route::get('{purchaseInvoice}/edit', 'edit')->middleware('permission:edit-purchase-invoices')->name('edit');
        Route::put('{purchaseInvoice}', 'update')->middleware('permission:edit-purchase-invoices')->name('update');
        Route::delete('{purchaseInvoice}', 'destroy')->middleware('permission:delete-purchase-invoices')->name('destroy');
        Route::put('{purchaseInvoice}/post', 'post')->middleware('permission:post-purchase-invoices')->name('post');
        Route::get('{purchaseInvoice}/pdf', 'pdf')->middleware('permission:print-purchase-invoices')->name('pdf');
    });
