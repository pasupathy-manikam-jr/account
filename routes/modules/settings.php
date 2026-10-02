<?php

use App\Http\Controllers\SettingsController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-settings'])->controller(SettingsController::class)->group(function () {
    Route::get('company-settings', 'index')->name('company-settings');
    // company / system / currency / email, each behind its own edit-{section}-settings permission.
    Route::put('company-settings/{section}', 'update')->whereIn('section', ['company', 'system', 'currency', 'email'])->name('company-settings.update');
    Route::post('company-settings/test-email', 'testEmail')->middleware('permission:test-email')->name('company-settings.test-email');
});
