<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * LHDN e-invoice codes on existing records: tax type per tax, classification per item, buyer ID per customer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('taxes', function (Blueprint $table) {
            $table->string('type_code', 2)->nullable()->after('rate');
        });

        Schema::table('items', function (Blueprint $table) {
            $table->string('classification_code', 3)->default('022')->after('unit_id');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->string('id_type', 10)->nullable()->after('tax_number');
            $table->string('id_number', 30)->nullable()->after('id_type');
        });
    }

    public function down(): void
    {
        Schema::table('customers', fn (Blueprint $table) => $table->dropColumn(['id_type', 'id_number']));
        Schema::table('items', fn (Blueprint $table) => $table->dropColumn('classification_code'));
        Schema::table('taxes', fn (Blueprint $table) => $table->dropColumn('type_code'));
    }
};
