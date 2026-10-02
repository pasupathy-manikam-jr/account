<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_returns', function (Blueprint $table) {
            $table->id();
            // PR-2026-10-001, set from the id right after insert.
            $table->string('return_number', 30)->nullable()->unique();
            $table->date('return_date');
            $table->foreignId('vendor_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignId('original_invoice_id')->constrained('purchase_invoices')->restrictOnDelete();
            // defective, damaged, wrong_item, excess_quantity or other (PurchaseReturn::REASONS).
            $table->string('reason', 30);
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            // draft, approved or completed (PurchaseReturn::STATUSES).
            $table->string('status', 20)->default('draft')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('purchase_return_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('return_id')->constrained('purchase_returns')->cascadeOnDelete();
            $table->foreignId('original_invoice_item_id')->constrained('purchase_invoice_items')->restrictOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 12, 2);
            // Priced exactly as on the original invoice line.
            $table->decimal('unit_price', 15, 2);
            $table->decimal('discount_percentage', 5, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_percentage', 5, 2)->default(0);
            $table->json('taxes')->nullable();
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('debit_notes', function (Blueprint $table) {
            $table->id();
            // DN-2026-10-001, set from the id right after insert.
            $table->string('debit_note_number', 30)->nullable()->unique();
            $table->date('debit_note_date');
            $table->foreignId('vendor_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('invoice_id')->constrained('purchase_invoices')->restrictOnDelete();
            // One debit note per completed return.
            $table->foreignId('return_id')->nullable()->unique()->constrained('purchase_returns')->nullOnDelete();
            $table->string('reason');
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            // Applied to invoices through vendor payments; the balance is total − applied, never stored.
            $table->decimal('applied_amount', 15, 2)->default(0);
            // draft, approved, partial or applied (DebitNote::STATUSES).
            $table->string('status', 20)->default('draft')->index();
            $table->text('notes')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('debit_note_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('debit_note_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 12, 2);
            $table->decimal('unit_price', 15, 2);
            $table->decimal('discount_percentage', 5, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_percentage', 5, 2)->default(0);
            $table->json('taxes')->nullable();
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('debit_note_items');
        Schema::dropIfExists('debit_notes');
        Schema::dropIfExists('purchase_return_items');
        Schema::dropIfExists('purchase_returns');
    }
};
