<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('mobile_no', 30)->nullable()->after('email');
            // Off = the account stays (with its history) but can't sign in.
            $table->boolean('is_login_enabled')->default(true)->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['mobile_no', 'is_login_enabled']);
        });
    }
};
