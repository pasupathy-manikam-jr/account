<?php

namespace Tests\Feature\BudgetPlanner;

use App\Models\Budget;
use App\Models\BudgetAllocation;
use App\Models\BudgetPeriod;
use App\Models\User;
use App\Support\Ledger;
use App\Support\LedgerAccounts;
use Database\Seeders\LedgerSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BudgetPlannerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(LedgerSeeder::class);
        $this->admin = $this->userWithRole();
        $this->actingAs($this->admin);
    }

    private function account(string $code): int
    {
        return LedgerAccounts::id($code);
    }

    /** Spend on an expense account, paid from the cash GL account. */
    private function spend(string $date, string $code, string $amount): void
    {
        Ledger::post($date, 'Spend', [
            ['account_id' => $this->account($code), 'debit' => $amount],
            ['account_id' => $this->account('1000'), 'credit' => $amount],
        ]);
    }

    public function test_periods_and_budgets_move_through_the_workflow_with_their_guards(): void
    {
        $this->post(route('budget-planner.budget-periods.store'), ['period_name' => 'FY2026', 'financial_year' => 2026, 'start_date' => '2026-01-01', 'end_date' => '2025-12-31'])
            ->assertSessionHasErrors('end_date');
        $this->post(route('budget-planner.budget-periods.store'), ['period_name' => 'FY2026', 'financial_year' => 2026, 'start_date' => '2026-01-01', 'end_date' => '2026-12-31'])
            ->assertSessionHasNoErrors();
        $period = BudgetPeriod::query()->sole();

        $this->post(route('budget-planner.budgets.store'), ['budget_name' => 'HQ Opex', 'budget_period_id' => $period->id, 'budget_type' => 'operational'])->assertSessionHasNoErrors();
        $budget = Budget::query()->sole();

        // No allocations yet, so it can't be approved.
        $this->put(route('budget-planner.budgets.approve', $budget))->assertSessionHasErrors('status');

        $this->post(route('budget-planner.budget-allocations.store'), ['budget_id' => $budget->id, 'account_id' => $this->account('4100'), 'allocated_amount' => '100'])
            ->assertSessionHasErrors('account_id'); // revenue, not an expense account
        $this->post(route('budget-planner.budget-allocations.store'), ['budget_id' => $budget->id, 'account_id' => $this->account('5320'), 'allocated_amount' => '12000'])->assertSessionHasNoErrors();
        $this->post(route('budget-planner.budget-allocations.store'), ['budget_id' => $budget->id, 'account_id' => $this->account('5320'), 'allocated_amount' => '1'])
            ->assertSessionHasErrors('account_id'); // one allocation per account

        $this->put(route('budget-planner.budgets.approve', $budget))->assertSessionHasNoErrors();
        $this->assertSame('approved', $budget->refresh()->status);
        $this->assertSame($this->admin->id, $budget->approved_by);

        // Approved plans are locked.
        $this->put(route('budget-planner.budgets.update', $budget), ['budget_name' => 'Changed', 'budget_period_id' => $period->id, 'budget_type' => 'capital']);
        $this->assertSame('HQ Opex', $budget->refresh()->budget_name);
        $this->delete(route('budget-planner.budget-allocations.destroy', BudgetAllocation::query()->sole()));
        $this->assertSame(1, BudgetAllocation::query()->count());

        // The period must be live first; steps can't be skipped.
        $this->put(route('budget-planner.budgets.activate', $budget))->assertSessionHasErrors('status');
        $this->put(route('budget-planner.budget-periods.activate', $period))->assertSessionHasErrors('status');
        $this->put(route('budget-planner.budget-periods.approve', $period));
        $this->put(route('budget-planner.budget-periods.activate', $period));
        $this->put(route('budget-planner.budgets.activate', $budget))->assertSessionHasNoErrors();
        $this->put(route('budget-planner.budgets.close', $budget));
        $this->assertSame('closed', $budget->refresh()->status);

        $this->delete(route('budget-planner.budget-periods.destroy', $period));
        $this->assertModelExists($period);
    }

    public function test_spending_is_read_from_the_ledger_within_the_period(): void
    {
        $this->travelTo('2026-04-15');
        $period = BudgetPeriod::query()->create(['period_name' => 'H1 2026', 'financial_year' => 2026, 'start_date' => '2026-01-01', 'end_date' => '2026-06-30']);
        $period->forceFill(['status' => 'active'])->save();
        $budget = Budget::query()->create(['budget_name' => 'Marketing', 'budget_period_id' => $period->id, 'budget_type' => 'operational']);
        $budget->forceFill(['status' => 'active'])->save();
        $budget->allocations()->create(['account_id' => $this->account('5320'), 'allocated_amount' => '1810.00']);

        $this->spend('2026-01-20', '5320', '300.00');
        $this->spend('2026-03-05', '5320', '500.00');
        $this->spend('2025-12-31', '5320', '999.00'); // before the period
        $this->spend('2026-02-01', '5330', '777.00'); // another account

        $this->get(route('budget-planner.budget-allocations.index'))->assertOk()
            ->assertInertia(fn ($page) => $page->where('allocations.data.0.spent_amount', '800.00')->where('stats.spent', '800.00'));

        // Jan → Apr (today); 181 days in the period, so the plan is RM10/day.
        $rows = collect($this->get(route('budget-planner.budget-monitoring.index'))->inertiaProps('rows'))->keyBy('date');
        $this->assertSame(['2026-04-15', '2026-03-31', '2026-02-28', '2026-01-31'], $rows->keys()->all());
        $this->assertSame(['310.00', '300.00', '10.00'], [$rows['2026-01-31']['planned'], $rows['2026-01-31']['spent'], $rows['2026-01-31']['variance']]);
        $this->assertSame(['900.00', '800.00', '100.00'], [$rows['2026-03-31']['planned'], $rows['2026-03-31']['spent'], $rows['2026-03-31']['variance']]);
        $this->assertSame('1050.00', $rows['2026-04-15']['planned']);
    }

    public function test_only_the_company_can_use_the_budget_planner(): void
    {
        $this->actingAs($this->userWithRole('staff'));

        foreach (['budget-periods', 'budgets', 'budget-allocations', 'budget-monitoring'] as $page) {
            $this->get(route("budget-planner.{$page}.index"))->assertForbidden();
        }

        $this->actingAs($this->admin)->get(route('budget-planner.budget-periods.index'))->assertOk();
    }
}
