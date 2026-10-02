<?php

use App\Http\Controllers\Contracts\ContractActivityController;
use App\Http\Controllers\Contracts\ContractController;
use App\Http\Controllers\Contracts\ContractTypeController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-contract-types'])
    ->controller(ContractTypeController::class)
    ->prefix('contract-types')
    ->name('contract-types.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->middleware('permission:create-contract-types')->name('store');
        Route::put('{contractType}', 'update')->middleware('permission:edit-contract-types')->name('update');
        Route::delete('{contractType}', 'destroy')->middleware('permission:delete-contract-types')->name('destroy');
    });

Route::middleware(['auth', 'verified', 'permission:manage-contracts'])
    ->prefix('contract')
    ->name('contracts.')
    ->group(function () {
        Route::controller(ContractController::class)->group(function () {
            Route::get('/', 'index')->name('index');
            Route::post('/', 'store')->middleware('permission:create-contracts')->name('store');
            Route::get('{contract}', 'show')->middleware('permission:view-contracts')->name('show');
            Route::get('{contract}/preview', 'preview')->middleware('permission:preview-contracts')->name('preview');
            Route::put('{contract}', 'update')->middleware('permission:edit-contracts')->name('update');
            Route::delete('{contract}', 'destroy')->middleware('permission:delete-contracts')->name('destroy');
            Route::post('{contract}/duplicate', 'duplicate')->middleware('permission:duplicate-contracts')->name('duplicate');
            Route::put('{contract}/status', 'status')->middleware('permission:edit-contracts')->name('status');
            Route::post('{contract}/sign', 'sign')->middleware('permission:signatures-contracts')->name('sign');
        });

        Route::controller(ContractActivityController::class)->group(function () {
            Route::post('{contract}/attachments', 'storeAttachment')->middleware('permission:create-contract-attachments')->name('attachments.store');
            Route::get('{contract}/attachments/{attachment}', 'downloadAttachment')->middleware('permission:view-contracts')->name('attachments.download');
            Route::delete('{contract}/attachments/{attachment}', 'destroyAttachment')->middleware('permission:delete-contract-attachments')->name('attachments.destroy');
            // {type} is comment or note; the matching -comments / -notes permission is checked in the controller.
            Route::post('{contract}/notes/{type}', 'storeNote')->whereIn('type', ['comment', 'note'])->name('notes.store');
            Route::put('{contract}/notes/{note}', 'updateNote')->name('notes.update');
            Route::delete('{contract}/notes/{note}', 'destroyNote')->name('notes.destroy');
            Route::post('{contract}/renewals', 'storeRenewal')->middleware('permission:create-contract-renewals')->name('renewals.store');
            Route::put('{contract}/renewals/{renewal}', 'updateRenewal')->middleware('permission:edit-contract-renewals')->name('renewals.update');
            Route::delete('{contract}/renewals/{renewal}', 'destroyRenewal')->middleware('permission:delete-contract-renewals')->name('renewals.destroy');
        });
    });
