<?php

namespace Tests\Feature\DoubleEntry;

use App\Models\BankAccount;
use App\Models\User;
use App\Support\FinancialStatements;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    private const RANGE = ['date_from' => '2026-01-01', 'date_to' => '2026-10-01'];

    public function test_reports_reconcile_to_the_ledger(): void
    {
        $this->seed();
        $this->travelTo('2026-10-01');
        $this->actingAs(User::query()->where('email', 'admin@example.com')->firstOrFail());
        $balances = FinancialStatements::balances(self::RANGE['date_from'], self::RANGE['date_to'])->keyBy('id');

        // General ledger: each account's last running balance and its closing match balances().
        $ledger = $this->get(route('double-entry.reports.index', ['report' => 'general-ledger', ...self::RANGE]))->assertOk()
            ->assertInertia(fn ($page) => $page->component('double-entry/reports'))->inertiaProps('data');
        $this->assertNotEmpty($ledger);

        foreach ($ledger as $account) {
            $this->assertSame(Money::format($balances[$account['id']]['closing']), $account['closing'], $account['code']);
            $this->assertSame($account['closing'], $account['lines'] === [] ? $account['opening'] : end($account['lines'])['balance'], $account['code']);
        }

        // Account statement defaults to a cash account and its running balance ends at the closing balance.
        $statement = $this->get(route('double-entry.reports.index', ['report' => 'account-statement', ...self::RANGE]))->inertiaProps('data');
        $this->assertContains($statement['id'], BankAccount::query()->whereIn('account_type', BankAccount::CASH_TYPES)->pluck('gl_account_id')->all());
        $this->assertNotEmpty($statement['lines']);
        $this->assertSame($statement['closing'], end($statement['lines'])['balance']);

        // Journal entries balance one by one.
        $entries = $this->get(route('double-entry.reports.index', ['report' => 'journal-entries', 'per_page' => 100, ...self::RANGE]))->inertiaProps('data.data');
        $this->assertNotEmpty($entries);

        foreach ($entries as $entry) {
            $lines = collect($entry['lines']);
            $this->assertSame($lines->sum(fn ($l) => Money::toCents($l['debit'])), $lines->sum(fn ($l) => Money::toCents($l['credit'])), $entry['number']);
        }

        // Cash flow: opening + net change = closing, and the sections add up to the net change.
        $flow = $this->get(route('double-entry.reports.index', ['report' => 'cash-flow', ...self::RANGE]))->inertiaProps('data');
        $this->assertSame(Money::toCents($flow['opening']) + Money::toCents($flow['net']), Money::toCents($flow['closing']));
        $this->assertSame(Money::toCents($flow['net']), collect($flow['sections'])->sum(fn ($s) => Money::toCents($s['net'])));
        $this->assertNotEquals(0, Money::toCents($flow['net']));

        // Expense report total matches the P&L's expenses for the same range.
        $expenses = $this->get(route('double-entry.reports.index', ['report' => 'expense-report', ...self::RANGE]))->inertiaProps('data');
        $this->assertSame(FinancialStatements::profitAndLoss(self::RANGE['date_from'], self::RANGE['date_to'])['total_expenses'], Money::toCents($expenses['total']));
        $this->assertCount(10, $expenses['months']);

        foreach (['general-ledger', 'account-statement', 'journal-entries', 'cash-flow', 'expense-report'] as $report) {
            $this->get(route('double-entry.reports.print', ['report' => $report, ...self::RANGE]))->assertOk()->assertHeader('content-type', 'application/pdf');
        }
    }

    public function test_expense_report_covers_at_most_a_year(): void
    {
        $this->actingAs($this->userWithRole());

        $this->get(route('double-entry.reports.index', ['report' => 'expense-report', 'date_from' => '2025-01-01', 'date_to' => '2026-01-01']))
            ->assertSessionHasErrors('date_to');
        $this->get(route('double-entry.reports.index', ['report' => 'expense-report', 'date_from' => '2025-01-01', 'date_to' => '2025-12-31']))
            ->assertOk();
    }

    public function test_staff_cannot_open_the_reports(): void
    {
        $this->actingAs($this->userWithRole('staff'))->get(route('double-entry.reports.index'))->assertForbidden();
        $this->get(route('double-entry.reports.print'))->assertForbidden();
    }
}
