<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Revenue and expense categories (System Setup), each mapped to the ledger account it posts to.
        Schema::create('transaction_categories', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 10)->index(); // revenue or expense
            $table->string('category_name');
            $table->string('category_code', 30);
            $table->foreignId('gl_account_id')->constrained('chart_of_accounts')->restrictOnDelete();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['kind', 'category_code']);
        });

        // Money received (revenue) or spent (expense) straight through a bank account, outside invoices.
        Schema::create('cash_entries', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 10)->index(); // revenue or expense
            // REV-2026-10-001 / EXP-2026-10-001, set from the id right after insert.
            $table->string('entry_number', 30)->nullable()->unique();
            $table->date('entry_date');
            $table->foreignId('category_id')->constrained('transaction_categories')->restrictOnDelete();
            $table->foreignId('bank_account_id')->constrained()->restrictOnDelete();
            // The revenue or expense ledger account; defaults to the category's.
            $table->foreignId('chart_of_account_id')->constrained('chart_of_accounts')->restrictOnDelete();
            $table->decimal('amount', 15, 2);
            $table->text('description')->nullable();
            $table->string('reference_number')->nullable();
            // draft, approved or posted (CashEntry::STATUSES); posting writes the journal entry.
            $table->string('status', 20)->default('draft')->index();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_entries');
        Schema::dropIfExists('transaction_categories');
    }
};
