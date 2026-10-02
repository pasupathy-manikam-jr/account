<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            // The client login this customer belongs to; one customer per client user.
            $table->foreignId('user_id')->unique()->constrained()->restrictOnDelete();
            // CUST-0001, set from the id right after insert.
            $table->string('customer_code', 30)->nullable()->unique();
            $table->string('company_name');
            $table->string('contact_person_name');
            $table->string('contact_person_email');
            $table->string('contact_person_mobile', 30)->nullable();
            $table->string('tax_number', 50)->nullable();
            $table->string('payment_terms', 50)->nullable();
            // {name, address_line_1, address_line_2, city, state, country, zip_code}
            $table->json('billing_address');
            $table->json('shipping_address')->nullable();
            $table->boolean('same_as_billing')->default(false);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
