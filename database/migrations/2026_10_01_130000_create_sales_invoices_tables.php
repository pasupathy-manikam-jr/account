<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_invoices', function (Blueprint $table) {
            $table->id();
            // SI-2026-10-001, set from the id right after insert.
            $table->string('invoice_number', 30)->nullable()->unique();
            $table->date('invoice_date');
            $table->date('due_date');
            $table->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            // product invoices ship from a warehouse; service invoices have none.
            $table->string('type', 10)->default('product');
            $table->foreignId('warehouse_id')->nullable()->constrained()->restrictOnDelete();
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            // The balance is total − paid, never stored.
            $table->decimal('paid_amount', 15, 2)->default(0);
            // draft, posted, partial or paid (SalesInvoice::STATUSES).
            $table->string('status', 20)->default('draft')->index();
            $table->string('payment_terms')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('sales_invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('sales_invoices')->cascadeOnDelete();
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

        Schema::table('sales_proposals', function (Blueprint $table) {
            // Set when an accepted proposal is converted; one proposal makes one invoice.
            $table->foreignId('invoice_id')->nullable()->after('status')->constrained('sales_invoices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sales_proposals', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invoice_id');
        });
        Schema::dropIfExists('sales_invoice_items');
        Schema::dropIfExists('sales_invoices');
    }
};
