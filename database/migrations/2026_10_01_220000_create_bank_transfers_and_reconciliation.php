<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_transfers', function (Blueprint $table) {
            $table->id();
            // BT-2026-10-001, set from the id right after insert.
            $table->string('transfer_number', 30)->nullable()->unique();
            $table->date('transfer_date');
            $table->foreignId('from_account_id')->constrained('bank_accounts')->restrictOnDelete();
            $table->foreignId('to_account_id')->constrained('bank_accounts')->restrictOnDelete();
            $table->decimal('transfer_amount', 15, 2);
            // Fees the sending bank charges on top of the amount.
            $table->decimal('transfer_charges', 15, 2)->default(0);
            $table->string('reference_number')->nullable();
            $table->text('description')->nullable();
            // pending or completed; processing posts the journal entry.
            $table->string('status', 20)->default('pending')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Bank Transactions are the journal lines on bank ledger accounts; reconciling marks the line itself.
        Schema::table('journal_entry_items', function (Blueprint $table) {
            $table->timestamp('reconciled_at')->nullable()->after('credit_amount');
            $table->foreignId('reconciled_by')->nullable()->after('reconciled_at')->constrained('users')->nullOnDelete();
            $table->index(['account_id', 'journal_entry_id']);
        });
    }

    public function down(): void
    {
        Schema::table('journal_entry_items', function (Blueprint $table) {
            $table->dropIndex(['account_id', 'journal_entry_id']);
            $table->dropConstrainedForeignId('reconciled_by');
            $table->dropColumn('reconciled_at');
        });
        Schema::dropIfExists('bank_transfers');
    }
};
