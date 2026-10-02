<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contract_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('contracts', function (Blueprint $table) {
            $table->id();
            // CON0001, set from the id right after insert.
            $table->string('contract_number', 20)->nullable()->unique();
            $table->string('subject');
            $table->decimal('value', 15, 2)->default(0);
            $table->date('start_date');
            $table->date('end_date');
            $table->text('description')->nullable();
            // pending, accepted, declined or closed (Contract::STATUSES).
            $table->string('status', 20)->default('pending')->index();
            $table->foreignId('type_id')->constrained('contract_types')->restrictOnDelete();
            // The client, vendor or staff member the contract is with.
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('contract_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contract_id')->constrained()->cascadeOnDelete();
            $table->string('file_name');
            $table->string('file_path');
            $table->unsignedBigInteger('file_size')->default(0);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Comments (shared with the other party) and notes (internal) differ only by type.
        Schema::create('contract_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contract_id')->constrained()->cascadeOnDelete();
            $table->string('type', 10)->index();
            $table->text('body');
            $table->boolean('is_edited')->default(false);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('contract_renewals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contract_id')->constrained()->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('value', 15, 2)->default(0);
            $table->text('notes')->nullable();
            // draft, pending, approved, active, expired or cancelled (ContractRenewal::STATUSES).
            $table->string('status', 20)->default('draft');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('contract_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contract_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('signer_name');
            // The typed name drawn as an SVG data URL, as the demo stores it.
            $table->longText('signature_data');
            $table->timestamp('signed_at');
            $table->timestamps();
            $table->unique(['contract_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_signatures');
        Schema::dropIfExists('contract_renewals');
        Schema::dropIfExists('contract_notes');
        Schema::dropIfExists('contract_attachments');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('contract_types');
    }
};
