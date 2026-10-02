<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        // Buildings contain floors, floors contain rooms, and so on.
        Schema::create('asset_locations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 30)->unique();
            // building, floor, room, warehouse or site.
            $table->string('type', 20)->index();
            $table->foreignId('parent_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // The register. A row can be a lot (5 laptops); its cost is quantity × unit price.
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('serial_code', 50)->unique();
            $table->foreignId('category_id')->constrained('asset_categories')->restrictOnDelete();
            $table->foreignId('location_id')->nullable()->constrained('asset_locations')->nullOnDelete();
            $table->text('description')->nullable();
            $table->date('purchase_date');
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_price', 15, 2);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('asset_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assigned_to')->constrained('users')->restrictOnDelete();
            $table->date('assigned_date');
            $table->date('expected_return_date')->nullable();
            // excellent, good, fair or poor: when handed over, and again when returned.
            $table->string('condition', 20);
            $table->date('returned_date')->nullable()->index();
            $table->string('return_condition', 20)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('asset_maintenances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            // preventive, corrective or emergency.
            $table->string('maintenance_type', 20);
            $table->string('priority', 20)->default('medium');
            $table->date('scheduled_date');
            $table->date('completed_date')->nullable();
            // scheduled → in_progress → completed, or cancelled.
            $table->string('status', 20)->default('scheduled')->index();
            $table->decimal('cost', 15, 2)->default(0);
            $table->string('technician')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // One schedule per asset. Amounts to date are calculated; only what has been posted is stored.
        Schema::create('asset_depreciations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->unique()->constrained()->cascadeOnDelete();
            // straight_line, declining_balance or sum_of_years.
            $table->string('method', 20)->index();
            $table->unsignedTinyInteger('useful_life_years');
            $table->decimal('salvage_value', 15, 2)->default(0);
            $table->date('start_date');
            $table->decimal('posted_amount', 15, 2)->default(0);
            $table->date('posted_through')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_depreciations');
        Schema::dropIfExists('asset_maintenances');
        Schema::dropIfExists('asset_assignments');
        Schema::dropIfExists('assets');
        Schema::dropIfExists('asset_locations');
        Schema::dropIfExists('asset_categories');
    }
};
