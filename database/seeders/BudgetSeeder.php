<?php

namespace Database\Seeders;

use App\Models\Budget;
use App\Models\BudgetPeriod;
use App\Models\ChartOfAccount;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class BudgetSeeder extends Seeder
{
    /**
     * Budget periods, budgets and allocations from database/demo/budgets.json. Spending is not seeded:
     * it is whatever the ledger already shows on the allocated expense accounts.
     */
    public function run(): void
    {
        /** @var array{periods: list<array<string, mixed>>, budgets: list<array<string, mixed>>} $demo */
        $demo = File::json(database_path('demo/budgets.json'), JSON_THROW_ON_ERROR);
        $admin = User::query()->where('email', 'company@example.com')->value('id');
        $accounts = ChartOfAccount::query()->pluck('id', 'account_code');

        foreach ($demo['periods'] as $row) {
            $period = BudgetPeriod::query()->firstOrNew(['period_name' => $row['period_name']]);
            $period->fill($row)->forceFill([
                'status' => $row['status'],
                'approved_by' => $row['status'] === 'draft' ? null : $admin,
                'created_by' => $admin,
            ])->save();
        }

        $periods = BudgetPeriod::query()->pluck('id', 'period_name');

        foreach ($demo['budgets'] as $row) {
            $budget = Budget::query()->firstOrNew(['budget_name' => $row['budget_name']]);
            $budget->fill(['budget_period_id' => $periods[$row['period']], 'budget_type' => $row['budget_type']])->forceFill([
                'status' => $row['status'],
                'approved_by' => $row['status'] === 'draft' ? null : $admin,
                'created_by' => $admin,
            ])->save();

            foreach ($row['allocations'] as $code => $amount) {
                $budget->allocations()->updateOrCreate(['account_id' => $accounts[(string) $code]], ['allocated_amount' => $amount]);
            }
        }
    }
}
