<?php

use App\Http\Controllers\MessageTemplateController;
use Illuminate\Support\Facades\Route;

// One controller serves both channels; the route's `channel` default says which.
foreach (['email' => 'email-templates', 'notification' => 'notification-templates'] as $channel => $name) {
    Route::middleware(['auth', 'verified', "permission:manage-{$name}"])->controller(MessageTemplateController::class)
        ->prefix($name)->name("{$name}.")->group(function () use ($channel, $name) {
            Route::get('/', 'index')->defaults('channel', $channel)->name('index');
            Route::get('{template}/edit', 'edit')->defaults('channel', $channel)->middleware("permission:edit-{$name}")->name('edit');
            Route::put('{template}', 'update')->defaults('channel', $channel)->middleware("permission:edit-{$name}")->name('update');
        });
}
