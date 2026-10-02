<?php

use App\Http\Controllers\Account\ReportController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-account-reports'])
    ->controller(ReportController::class)
    ->prefix('account/reports')
    ->name('account.reports.')
    ->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('pdf', 'pdf')->name('pdf');
        // Customer / vendor detail; the party's type picks which, and its own view/print permission is checked inside.
        Route::get('statement/{party}', 'statement')->name('statement');
        Route::get('statement/{party}/pdf', 'statementPdf')->name('statement.pdf');
    });
