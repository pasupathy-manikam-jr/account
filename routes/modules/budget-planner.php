<?php

use App\Http\Controllers\BudgetPlanner\BudgetAllocationController;
use App\Http\Controllers\BudgetPlanner\BudgetController;
use App\Http\Controllers\BudgetPlanner\BudgetMonitoringController;
use App\Http\Controllers\BudgetPlanner\BudgetPeriodController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->prefix('budget-planner')->name('budget-planner.')->group(function () {
    // Periods and budgets share the approve → activate → close workflow; the route fixes the action.
    foreach (['budget-periods' => [BudgetPeriodController::class, 'budgetPeriod'], 'budgets' => [BudgetController::class, 'budget']] as $name => [$controller, $param]) {
        Route::middleware("permission:manage-{$name}")->controller($controller)->prefix($name)->name("{$name}.")
            ->group(function () use ($name, $param) {
                Route::get('/', 'index')->name('index');
                Route::post('/', 'store')->middleware("permission:create-{$name}")->name('store');
                Route::put("{{$param}}", 'update')->middleware("permission:edit-{$name}")->name('update');
                Route::delete("{{$param}}", 'destroy')->middleware("permission:delete-{$name}")->name('destroy');

                foreach (['approve' => 'approve', 'activate' => 'active', 'close' => 'close'] as $action => $permission) {
                    Route::put("{{$param}}/{$action}", 'transition')->defaults('action', $action)
                        ->middleware("permission:{$permission}-{$name}")->name($action);
                }
            });
    }

    Route::middleware('permission:manage-budget-allocations')->controller(BudgetAllocationController::class)
        ->prefix('budget-allocations')->name('budget-allocations.')->group(function () {
            Route::get('/', 'index')->name('index');
            Route::post('/', 'store')->middleware('permission:create-budget-allocations')->name('store');
            Route::put('{budgetAllocation}', 'update')->middleware('permission:edit-budget-allocations')->name('update');
            Route::delete('{budgetAllocation}', 'destroy')->middleware('permission:delete-budget-allocations')->name('destroy');
        });

    Route::get('budget-monitoring', [BudgetMonitoringController::class, 'index'])
        ->middleware('permission:manage-budget-monitoring')->name('budget-monitoring.index');
});
