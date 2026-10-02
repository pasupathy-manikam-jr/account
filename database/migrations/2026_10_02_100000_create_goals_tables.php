<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('goal_categories', function (Blueprint $table) {
            $table->id();
            $table->string('category_name');
            $table->string('category_code', 30)->unique();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // A financial target. Its current amount is the sum of its contributions, never stored.
        Schema::create('goals', function (Blueprint $table) {
            $table->id();
            $table->string('goal_name');
            $table->text('description')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('goal_categories')->nullOnDelete();
            $table->string('goal_type', 30); // Goal::TYPES
            $table->string('priority', 20)->default('medium'); // Goal::PRIORITIES
            $table->decimal('target_amount', 15, 2);
            $table->date('start_date');
            $table->date('target_date');
            $table->foreignId('chart_of_account_id')->nullable()->constrained('chart_of_accounts')->nullOnDelete();
            // draft, active, completed or cancelled (Goal::STATUSES).
            $table->string('status', 20)->default('draft')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('goal_contributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('goal_id')->constrained()->cascadeOnDelete();
            $table->date('contribution_date');
            $table->decimal('amount', 15, 2);
            $table->string('contribution_type', 20)->default('manual'); // manual or automatic
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // A cumulative checkpoint on its goal; achieved_date is set from the contributions (Goal::refreshMilestones()).
        Schema::create('goal_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('goal_id')->constrained()->cascadeOnDelete();
            $table->string('milestone_name');
            $table->text('description')->nullable();
            $table->decimal('target_amount', 15, 2);
            $table->date('target_date');
            $table->date('achieved_date')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('goal_milestones');
        Schema::dropIfExists('goal_contributions');
        Schema::dropIfExists('goals');
        Schema::dropIfExists('goal_categories');
    }
};
