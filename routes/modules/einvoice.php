<?php

use App\Http\Controllers\EInvoiceController;
use Illuminate\Support\Facades\Route;

// LHDN MyInvois. Each action checks the permission of the document it acts on.
Route::middleware(['auth', 'verified'])->controller(EInvoiceController::class)->prefix('einvoice')->name('einvoice.')->group(function () {
    Route::post('{type}/{id}/submit', 'submit')->whereIn('type', ['sales-invoices', 'credit-notes'])->whereNumber('id')->name('submit');
    Route::put('{einvoice}/cancel', 'cancel')->name('cancel');
    Route::put('{einvoice}/poll', 'poll')->name('poll');
    Route::post('validate-tin', 'validateTin')->middleware('permission:manage-customers')->name('validate-tin');
    Route::put('settings', 'saveSettings')->middleware('permission:manage-settings')->name('settings');
});
