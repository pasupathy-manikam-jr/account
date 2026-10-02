<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retainers', function (Blueprint $table) {
            $table->id();
            // RET-2026-10-001, set from the id right after insert.
            $table->string('retainer_number', 30)->nullable()->unique();
            $table->date('retainer_date');
            $table->date('due_date');
            $table->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            // Deposits received through cleared retainer payments; the balance is total − paid.
            $table->decimal('paid_amount', 15, 2)->default(0);
            // draft, sent, accepted, rejected, partial or paid (Retainer::STATUSES).
            $table->string('status', 20)->default('draft')->index();
            $table->foreignId('invoice_id')->nullable()->constrained('sales_invoices')->nullOnDelete();
            $table->string('payment_terms')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('retainer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('retainer_id')->constrained()->cascadeOnDelete();
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

        Schema::create('retainer_payments', function (Blueprint $table) {
            $table->id();
            // RP-2026-10-001, set from the id right after insert.
            $table->string('payment_number', 30)->nullable()->unique();
            $table->date('payment_date');
            $table->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('bank_account_id')->constrained()->restrictOnDelete();
            $table->decimal('payment_amount', 15, 2);
            $table->string('reference_number')->nullable();
            // pending, cleared or cancelled (RetainerPayment::STATUSES); clearing posts the deposit.
            $table->string('status', 20)->default('pending')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('retainer_payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained('retainer_payments')->cascadeOnDelete();
            $table->foreignId('retainer_id')->constrained()->restrictOnDelete();
            $table->decimal('allocated_amount', 15, 2);
            $table->timestamps();
        });

        Schema::table('sales_invoices', function (Blueprint $table) {
            // The retainer this invoice was converted from; its deposits settle the invoice when posted.
            $table->foreignId('retainer_id')->nullable()->after('warehouse_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sales_invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('retainer_id');
        });
        Schema::dropIfExists('retainer_payment_allocations');
        Schema::dropIfExists('retainer_payments');
        Schema::dropIfExists('retainer_items');
        Schema::dropIfExists('retainers');
    }
};
