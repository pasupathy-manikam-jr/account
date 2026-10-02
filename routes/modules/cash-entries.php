<?php

use App\Http\Controllers\Account\CashEntryController;
use App\Http\Controllers\Account\TransactionCategoryController;
use Illuminate\Support\Facades\Route;

// One controller each serves both kinds; the route's `kind` default says which.
foreach (['revenue' => ['revenues', 'revenue-categories'], 'expense' => ['expenses', 'expense-categories']] as $kind => [$entries, $categories]) {
    Route::middleware(['auth', 'verified', "permission:manage-{$entries}"])
        ->controller(CashEntryController::class)
        ->prefix("account/{$entries}")
        ->name("account.{$entries}.")
        ->group(function () use ($kind, $entries) {
            Route::get('/', 'index')->defaults('kind', $kind)->name('index');
            Route::post('/', 'store')->defaults('kind', $kind)->middleware("permission:create-{$entries}")->name('store');
            Route::put('{entry}', 'update')->defaults('kind', $kind)->middleware("permission:edit-{$entries}")->name('update');
            Route::delete('{entry}', 'destroy')->defaults('kind', $kind)->middleware("permission:delete-{$entries}")->name('destroy');
            Route::put('{entry}/approve', 'approve')->defaults('kind', $kind)->middleware("permission:approve-{$entries}")->name('approve');
            Route::put('{entry}/post', 'post')->defaults('kind', $kind)->middleware("permission:post-{$entries}")->name('post');
        });

    Route::middleware(['auth', 'verified', "permission:manage-{$categories}"])
        ->controller(TransactionCategoryController::class)
        ->prefix("account/{$categories}")
        ->name("account.{$categories}.")
        ->group(function () use ($kind, $categories) {
            Route::get('/', 'index')->defaults('kind', $kind)->name('index');
            Route::post('/', 'store')->defaults('kind', $kind)->middleware("permission:create-{$categories}")->name('store');
            Route::put('{category}', 'update')->defaults('kind', $kind)->middleware("permission:edit-{$categories}")->name('update');
            Route::delete('{category}', 'destroy')->defaults('kind', $kind)->middleware("permission:delete-{$categories}")->name('destroy');
        });
}
