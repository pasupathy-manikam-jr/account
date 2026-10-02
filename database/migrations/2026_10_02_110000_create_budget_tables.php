<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Periods and budgets share one workflow: draft → approved → active → closed.
        Schema::create('budget_periods', function (Blueprint $table) {
            $table->id();
            $table->string('period_name');
            $table->unsignedSmallInteger('financial_year');
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status', 20)->default('draft')->index();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('budgets', function (Blueprint $table) {
            $table->id();
            $table->string('budget_name');
            $table->foreignId('budget_period_id')->constrained()->restrictOnDelete();
            // operational, capital or cash_flow.
            $table->string('budget_type', 20)->index();
            $table->string('status', 20)->default('draft')->index();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // The plan per expense account. What was actually spent is read from the ledger, never stored.
        Schema::create('budget_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('budget_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained('chart_of_accounts')->restrictOnDelete();
            $table->decimal('allocated_amount', 15, 2);
            $table->timestamps();
            $table->unique(['budget_id', 'account_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_allocations');
        Schema::dropIfExists('budgets');
        Schema::dropIfExists('budget_periods');
    }
};
