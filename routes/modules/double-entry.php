<?php

use App\Http\Controllers\DoubleEntry\ReportController;
use App\Http\Controllers\DoubleEntry\StatementController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->prefix('double-entry')->name('double-entry.')->controller(StatementController::class)->group(function () {
    $statements = [
        'ledger-summary' => ['ledgerSummary', 'manage-ledger-summary'],
        'trial-balance' => ['trialBalance', 'manage-trial-balance'],
        'balance-sheets' => ['balanceSheet', 'manage-balance-sheets'],
        'profit-loss' => ['profitLoss', 'manage-profit-loss'],
    ];

    foreach ($statements as $uri => [$method, $permission]) {
        Route::get($uri, $method)->middleware("permission:{$permission}")->name("{$uri}.index");
        Route::get("{$uri}/print", 'pdf')->defaults('statement', $uri === 'balance-sheets' ? 'balance-sheet' : $uri)
            ->middleware(["permission:{$permission}", 'permission:print-'.($uri === 'balance-sheets' ? 'balance-sheets' : $uri)])->name("{$uri}.print");
    }

    Route::post('balance-sheets/year-end-close', 'yearEndClose')->middleware('permission:year-end-close')->name('balance-sheets.year-end-close');
});

Route::middleware(['auth', 'verified', 'permission:manage-double-entry-reports'])->prefix('double-entry/reports')->name('double-entry.reports.')
    ->controller(ReportController::class)->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('print', 'pdf')->name('print');
    });
