<?php

use App\Http\Controllers\Sales\SalesInvoiceController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-sales-invoices'])
    ->controller(SalesInvoiceController::class)
    ->prefix('sales-invoices')
    ->name('sales-invoices.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('create', 'create')->middleware('permission:create-sales-invoices')->name('create');
        Route::post('/', 'store')->middleware('permission:create-sales-invoices')->name('store');
        Route::get('{salesInvoice}', 'show')->middleware('permission:view-sales-invoices')->name('show');
        Route::get('{salesInvoice}/edit', 'edit')->middleware('permission:edit-sales-invoices')->name('edit');
        Route::put('{salesInvoice}', 'update')->middleware('permission:edit-sales-invoices')->name('update');
        Route::delete('{salesInvoice}', 'destroy')->middleware('permission:delete-sales-invoices')->name('destroy');
        Route::put('{salesInvoice}/post', 'post')->middleware('permission:post-sales-invoices')->name('post');
        Route::get('{salesInvoice}/pdf', 'pdf')->middleware('permission:print-sales-invoices')->name('pdf');
    });
