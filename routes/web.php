<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LocaleController;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;

// Not Route::redirect(): it answers with a root-relative Location, which escapes a subfolder install.
Route::get('/', fn () => to_route('login'))->name('home');

Route::post('locale', [LocaleController::class, 'update'])->name('locale.update');
Route::get('translations/{locale}', [LocaleController::class, 'translations'])->name('translations.show');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->middleware('permission:manage-dashboard')->name('dashboard');
    Route::get('dashboard/account', [DashboardController::class, 'account'])->middleware('permission:manage-account-dashboard')->name('account.dashboard');

    // The manual is the README, so the repo and the app never drift apart.
    Route::get('user-manual', fn () => Inertia::render('user-manual', [
        'html' => Str::markdown(File::get(base_path('README.md')), ['html_input' => 'escape']),
    ]))->name('user-manual');
});

require __DIR__.'/accounting.php';
require __DIR__.'/settings.php';
