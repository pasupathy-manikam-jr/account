<?php

use App\Http\Controllers\ProductService\ItemCategoryController;
use App\Http\Controllers\ProductService\ItemController;
use App\Http\Controllers\ProductService\TaxController;
use App\Http\Controllers\ProductService\UnitController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->prefix('product-service')->name('product-service.')->group(function () {
    Route::middleware('permission:manage-product-service-item')
        ->controller(ItemController::class)
        ->prefix('items')
        ->name('items.')
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::get('create', 'create')->middleware('permission:create-product-service-item')->name('create');
            Route::post('/', 'store')->middleware('permission:create-product-service-item')->name('store');
            Route::get('{item}', 'show')->middleware('permission:view-product-service-item')->name('show');
            Route::get('{item}/edit', 'edit')->middleware('permission:edit-product-service-item')->name('edit');
            Route::put('{item}', 'update')->middleware('permission:edit-product-service-item')->name('update');
            Route::delete('{item}', 'destroy')->middleware('permission:delete-product-service-item')->name('destroy');
            Route::post('{item}/stock', 'addStock')->middleware('permission:create-stock')->name('stock');
        });

    foreach ([
        'item-categories' => [ItemCategoryController::class, 'itemCategory', 'product-service-categories'],
        'taxes' => [TaxController::class, 'tax', 'product-service-taxes'],
        'units' => [UnitController::class, 'unit', 'product-service-units'],
    ] as $uri => [$controller, $parameter, $permission]) {
        Route::middleware("permission:manage-{$permission}")
            ->controller($controller)
            ->prefix($uri)
            ->name("{$uri}.")
            ->group(function () use ($parameter, $permission) {
                Route::get('/', 'index')->name('index');
                Route::post('/', 'store')->middleware("permission:create-{$permission}")->name('store');
                Route::put("{{$parameter}}", 'update')->middleware("permission:edit-{$permission}")->name('update');
                Route::delete("{{$parameter}}", 'destroy')->middleware("permission:delete-{$permission}")->name('destroy');
            });
    }
});
