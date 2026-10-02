<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Customer payments (money in, settling sales invoices) and vendor payments (money out, settling bills).
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 10)->index(); // customer or vendor
            // CP-2026-10-001 / VP-2026-10-001, set from the id right after insert.
            $table->string('payment_number', 30)->nullable()->unique();
            $table->date('payment_date');
            // The client or vendor login the payment is from / to.
            $table->foreignId('party_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('bank_account_id')->constrained()->restrictOnDelete();
            // Cash that moves; credit/debit notes applied on top settle the rest of the allocations.
            $table->decimal('payment_amount', 15, 2);
            $table->string('reference_number')->nullable();
            // pending, cleared or cancelled; clearing moves the money and settles the documents.
            $table->string('status', 20)->default('pending')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->morphs('invoice'); // sales_invoices or purchase_invoices
            $table->decimal('allocated_amount', 15, 2);
            $table->timestamps();
        });

        Schema::create('payment_note_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->morphs('note'); // credit_notes or debit_notes
            $table->decimal('applied_amount', 15, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_note_applications');
        Schema::dropIfExists('payment_allocations');
        Schema::dropIfExists('payments');
    }
};
