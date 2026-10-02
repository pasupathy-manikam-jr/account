<?php

use App\Http\Controllers\Account\PaymentController;
use Illuminate\Support\Facades\Route;

// One controller serves both kinds; the route's `kind` default says which.
foreach (['customer' => 'customer-payments', 'vendor' => 'vendor-payments'] as $kind => $name) {
    Route::middleware(['auth', 'verified', "permission:manage-{$name}"])
        ->controller(PaymentController::class)
        ->prefix("account/{$name}")
        ->name("account.{$name}.")
        ->group(function () use ($kind, $name) {
            Route::get('/', 'index')->defaults('kind', $kind)->name('index');
            Route::get('create', 'create')->defaults('kind', $kind)->middleware("permission:create-{$name}")->name('create');
            Route::post('/', 'store')->defaults('kind', $kind)->middleware("permission:create-{$name}")->name('store');
            Route::get('{payment}', 'show')->defaults('kind', $kind)->middleware("permission:view-{$name}")->name('show');
            Route::delete('{payment}', 'destroy')->defaults('kind', $kind)->middleware("permission:delete-{$name}")->name('destroy');
            Route::put('{payment}/clear', 'clear')->defaults('kind', $kind)->middleware("permission:cleared-{$name}")->name('clear');
            Route::put('{payment}/cancel', 'cancel')->defaults('kind', $kind)->middleware("permission:delete-{$name}")->name('cancel');
        });
}
