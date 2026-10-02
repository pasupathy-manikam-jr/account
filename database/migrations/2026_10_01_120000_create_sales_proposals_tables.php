<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_proposals', function (Blueprint $table) {
            $table->id();
            // SP-2026-10-001, set from the id right after insert.
            $table->string('proposal_number', 30)->nullable()->unique();
            $table->date('proposal_date');
            $table->date('due_date');
            // The client's login, as in the demo; their customer record hangs off the same user.
            $table->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            // draft, sent, accepted or rejected (SalesProposal::STATUSES).
            $table->string('status', 20)->default('draft')->index();
            $table->string('payment_terms')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('sales_proposal_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('proposal_id')->constrained('sales_proposals')->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 12, 2);
            $table->decimal('unit_price', 15, 2);
            $table->decimal('discount_percentage', 5, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            // The item's combined tax rate when the proposal was saved, with each tax's name and rate.
            $table->decimal('tax_percentage', 5, 2)->default(0);
            $table->json('taxes')->nullable();
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_proposal_items');
        Schema::dropIfExists('sales_proposals');
    }
};
