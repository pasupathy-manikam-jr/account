<?php

use App\Http\Controllers\Asset\AssetAssignmentController;
use App\Http\Controllers\Asset\AssetCategoryController;
use App\Http\Controllers\Asset\AssetController;
use App\Http\Controllers\Asset\AssetDepreciationController;
use App\Http\Controllers\Asset\AssetLocationController;
use App\Http\Controllers\Asset\AssetMaintenanceController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::middleware('permission:manage-assets')->controller(AssetController::class)->prefix('assets')->name('assets.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->middleware('permission:create-assets')->name('store');
        Route::get('{asset}', 'show')->middleware('permission:view-assets')->name('show');
        Route::put('{asset}', 'update')->middleware('permission:edit-assets')->name('update');
        Route::delete('{asset}', 'destroy')->middleware('permission:delete-assets')->name('destroy');
    });

    Route::prefix('asset')->name('asset.')->group(function () {
        // Plain resources: index / store / update / destroy, each behind its own permission.
        $crud = [
            'asset-locations' => [AssetLocationController::class, 'assetLocation', 'asset-locations'],
            'asset-assignments' => [AssetAssignmentController::class, 'assetAssignment', 'asset-assignments'],
            'asset-maintenance' => [AssetMaintenanceController::class, 'assetMaintenance', 'asset-maintenance'],
            'asset-depreciation' => [AssetDepreciationController::class, 'assetDepreciation', 'asset-depreciation'],
            'categories' => [AssetCategoryController::class, 'category', 'asset-categories'],
        ];

        foreach ($crud as $uri => [$controller, $param, $permission]) {
            Route::middleware("permission:manage-{$permission}")->controller($controller)->prefix($uri)->name("{$uri}.")
                ->group(function () use ($param, $permission) {
                    Route::get('/', 'index')->name('index');
                    Route::post('/', 'store')->middleware("permission:create-{$permission}")->name('store');
                    Route::put("{{$param}}", 'update')->middleware("permission:edit-{$permission}")->name('update');
                    Route::delete("{{$param}}", 'destroy')->middleware("permission:delete-{$permission}")->name('destroy');
                });
        }

        Route::put('asset-assignments/{assetAssignment}/return', [AssetAssignmentController::class, 'return'])
            ->middleware(['permission:manage-asset-assignments', 'permission:return-assets'])->name('asset-assignments.return');

        foreach (['start', 'complete', 'cancel'] as $action) {
            Route::put("asset-maintenance/{assetMaintenance}/{$action}", [AssetMaintenanceController::class, 'transition'])->defaults('action', $action)
                ->middleware(['permission:manage-asset-maintenance', 'permission:edit-asset-maintenance'])->name("asset-maintenance.{$action}");
        }

        Route::put('asset-depreciation/{assetDepreciation}/post', [AssetDepreciationController::class, 'post'])
            ->middleware(['permission:manage-asset-depreciation', 'permission:edit-asset-depreciation'])->name('asset-depreciation.post');
    });
});
