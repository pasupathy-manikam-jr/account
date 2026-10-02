<?php

use App\Http\Controllers\MediaController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'permission:manage-media'])->controller(MediaController::class)->group(function () {
    Route::get('media-library', 'index')->name('media-library');

    Route::prefix('media')->name('media.')->group(function () {
        Route::post('/', 'store')->middleware('permission:create-media')->name('store');
        Route::put('{media}', 'update')->middleware('permission:create-media')->name('update');
        Route::get('{media}/download', 'download')->middleware('permission:download-media')->name('download');
        Route::delete('{media}', 'destroy')->middleware('permission:delete-media')->name('destroy');

        Route::post('folders', 'storeFolder')->middleware('permission:create-media-directories')->name('folders.store');
        Route::put('folders/{folder}', 'updateFolder')->middleware('permission:edit-media-directories')->name('folders.update');
        Route::delete('folders/{folder}', 'destroyFolder')->middleware('permission:delete-media-directories')->name('folders.destroy');
    });
});
