<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Email and in-app notification texts. Templates are fixed by the system (seeded); only their wording is edited.
        Schema::create('message_templates', function (Blueprint $table) {
            $table->id();
            // email or notification.
            $table->string('channel', 20);
            $table->string('slug', 60);
            $table->string('name');
            $table->string('module', 30)->default('general');
            $table->string('from_name')->nullable();
            // The {placeholders} this template can use.
            $table->json('variables');
            $table->timestamps();
            $table->unique(['channel', 'slug']);
        });

        Schema::create('message_template_contents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_template_id')->constrained()->cascadeOnDelete();
            $table->string('locale', 5);
            $table->string('subject')->nullable();
            $table->text('body');
            $table->timestamps();
            $table->unique(['message_template_id', 'locale']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_template_contents');
        Schema::dropIfExists('message_templates');
    }
};
