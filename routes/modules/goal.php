<?php

use App\Http\Controllers\Goal\GoalCategoryController;
use App\Http\Controllers\Goal\GoalContributionController;
use App\Http\Controllers\Goal\GoalController;
use App\Http\Controllers\Goal\GoalMilestoneController;
use App\Http\Controllers\Goal\GoalTrackingController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->prefix('goal')->name('goal.')->group(function () {
    Route::middleware('permission:manage-goals')->controller(GoalController::class)->prefix('goals')->name('goals.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->middleware('permission:create-goals')->name('store');
        Route::get('{goal}', 'show')->middleware('permission:view-goals')->name('show');
        Route::put('{goal}', 'update')->middleware('permission:edit-goals')->name('update');
        Route::delete('{goal}', 'destroy')->middleware('permission:delete-goals')->name('destroy');
        Route::put('{goal}/activate', 'activate')->middleware('permission:active-goals')->name('activate');
        Route::put('{goal}/complete', 'complete')->middleware('permission:edit-goals')->name('complete');
        Route::put('{goal}/cancel', 'cancel')->middleware('permission:edit-goals')->name('cancel');
    });

    foreach (['milestones' => [GoalMilestoneController::class, 'goal-milestones', 'milestone'], 'contributions' => [GoalContributionController::class, 'goal-contributions', 'contribution']] as $uri => [$controller, $perm, $param]) {
        Route::middleware("permission:manage-{$perm}")->controller($controller)->prefix($uri)->name("{$uri}.")->group(function () use ($perm, $param) {
            Route::get('/', 'index')->name('index');
            Route::post('/', 'store')->middleware("permission:create-{$perm}")->name('store');
            Route::put("{{$param}}", 'update')->middleware("permission:edit-{$perm}")->name('update');
            Route::delete("{{$param}}", 'destroy')->middleware("permission:delete-{$perm}")->name('destroy');
        });
    }

    Route::get('tracking', [GoalTrackingController::class, 'index'])->middleware('permission:manage-goal-tracking')->name('tracking.index');

    Route::middleware('permission:manage-categories')->controller(GoalCategoryController::class)->prefix('categories')->name('categories.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->middleware('permission:create-categories')->name('store');
        Route::put('{category}', 'update')->middleware('permission:edit-categories')->name('update');
        Route::delete('{category}', 'destroy')->middleware('permission:delete-categories')->name('destroy');
    });
});
