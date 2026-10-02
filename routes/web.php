<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LocaleController;
use Illuminate\Support\Facades\Route;

// Not Route::redirect(): it answers with a root-relative Location, which escapes a subfolder install.
Route::get('/', fn () => to_route('login'))->name('home');

Route::post('locale', [LocaleController::class, 'update'])->name('locale.update');
Route::get('translations/{locale}', [LocaleController::class, 'translations'])->name('translations.show');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->middleware('permission:manage-dashboard')->name('dashboard');
    Route::get('dashboard/account', [DashboardController::class, 'account'])->middleware('permission:manage-account-dashboard')->name('account.dashboard');
});

require __DIR__.'/accounting.php';
require __DIR__.'/settings.php';
