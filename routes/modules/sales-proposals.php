<?php

use App\Http\Controllers\Sales\SalesProposalController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-sales-proposals'])
    ->controller(SalesProposalController::class)
    ->prefix('sales-proposals')
    ->name('sales-proposals.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('create', 'create')->middleware('permission:create-sales-proposals')->name('create');
        Route::post('/', 'store')->middleware('permission:create-sales-proposals')->name('store');
        Route::get('{salesProposal}', 'show')->middleware('permission:view-sales-proposals')->name('show');
        Route::get('{salesProposal}/edit', 'edit')->middleware('permission:edit-sales-proposals')->name('edit');
        Route::put('{salesProposal}', 'update')->middleware('permission:edit-sales-proposals')->name('update');
        Route::delete('{salesProposal}', 'destroy')->middleware('permission:delete-sales-proposals')->name('destroy');
        Route::put('{salesProposal}/send', 'send')->middleware('permission:sent-sales-proposals')->name('send');
        Route::put('{salesProposal}/accept', 'accept')->middleware('permission:accept-sales-proposals')->name('accept');
        Route::put('{salesProposal}/reject', 'reject')->middleware('permission:reject-sales-proposals')->name('reject');
        Route::post('{salesProposal}/convert', 'convert')->middleware('permission:convert-sales-proposals')->name('convert');
        Route::get('{salesProposal}/pdf', 'pdf')->middleware('permission:print-sales-proposals')->name('pdf');
    });
