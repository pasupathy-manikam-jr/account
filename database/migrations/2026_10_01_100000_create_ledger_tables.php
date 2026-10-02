<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 20)->unique();
            // assets, liabilities, equity, revenue or expenses (AccountType::CATEGORIES).
            $table->string('category', 20)->index();
            $table->string('normal_balance', 6);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system_type')->default(false);
            $table->timestamps();
        });

        Schema::create('chart_of_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('account_code', 20)->unique();
            $table->string('account_name');
            $table->foreignId('account_type_id')->constrained()->restrictOnDelete();
            $table->foreignId('parent_account_id')->nullable()->constrained('chart_of_accounts')->restrictOnDelete();
            $table->unsignedTinyInteger('level')->default(1);
            $table->string('normal_balance', 6);
            $table->decimal('opening_balance', 15, 2)->default(0);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system_account')->default(false);
            $table->timestamps();
        });

        Schema::create('journal_entries', function (Blueprint $table) {
            $table->id();
            // JE-2026-0001, set from the id right after insert.
            $table->string('journal_number', 30)->nullable()->unique();
            $table->date('journal_date')->index();
            $table->string('description');
            // The document that posted it (invoice, payment, ...); null for manual entries.
            $table->nullableMorphs('reference');
            $table->timestamps();
        });

        Schema::create('journal_entry_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('journal_entry_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained('chart_of_accounts')->restrictOnDelete();
            $table->string('description')->nullable();
            $table->decimal('debit_amount', 15, 2)->default(0);
            $table->decimal('credit_amount', 15, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('account_number', 50)->unique();
            $table->string('account_name');
            $table->string('bank_name');
            $table->string('branch_name')->nullable();
            // checking, savings, credit or loan (BankAccount::TYPES).
            $table->string('account_type', 20)->index();
            $table->decimal('opening_balance', 15, 2)->default(0);
            $table->string('iban', 50)->nullable();
            $table->string('swift_code', 20)->nullable();
            $table->string('routing_number', 30)->nullable();
            $table->boolean('is_active')->default(true);
            // Each bank account posts to its own ledger account, which carries its balance.
            $table->foreignId('gl_account_id')->unique()->constrained('chart_of_accounts')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_accounts');
        Schema::dropIfExists('journal_entry_items');
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('chart_of_accounts');
        Schema::dropIfExists('account_types');
    }
};
