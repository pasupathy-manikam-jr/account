<?php

namespace Tests\Feature\DoubleEntry;

use App\Models\ChartOfAccount;
use App\Models\User;
use App\Models\YearEndClosing;
use App\Support\FinancialStatements;
use App\Support\LedgerAccounts;
use App\Support\Money;
use Database\Seeders\LedgerSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StatementTest extends TestCase
{
    use RefreshDatabase;

    public function test_statements_balance_on_the_seeded_books_and_year_end_close_moves_profit_to_equity(): void
    {
        $this->seed();
        $this->travelTo('2027-01-15');
        $admin = User::query()->where('email', 'admin@example.com')->firstOrFail();
        $this->actingAs($admin);

        $tb = $this->get(route('double-entry.trial-balance.index', ['date_to' => '2026-12-31']))->assertOk()->inertiaProps('report');
        $this->assertSame($tb['debit'], $tb['credit']);
        $this->assertSame(0, FinancialStatements::openingDifference());
        $this->assertNotContains('Opening Balance Equity', array_column($tb['rows'], 'name'));

        $pl = $this->get(route('double-entry.profit-loss.index', ['date_from' => '2026-01-01', 'date_to' => '2026-12-31']))->inertiaProps('report');
        $this->assertSame(Money::toCents($pl['total_revenue']) - Money::toCents($pl['total_expenses']), Money::toCents($pl['net']));
        $this->assertGreaterThan(0, Money::toCents($pl['net']));

        $bs = $this->get(route('double-entry.balance-sheets.index', ['date_to' => '2026-12-31']))->inertiaProps('report');
        $this->assertSame(Money::toCents($bs['total_assets']), Money::toCents($bs['total_liabilities']) + Money::toCents($bs['total_equity']));
        // Accumulated depreciation (a credit-normal contra asset) reduces assets rather than adding to them.
        $accumulated = collect($bs['assets'])->flatMap(fn ($g) => $g['rows'])->firstWhere('code', '1610');
        $this->assertLessThan(0, Money::toCents($accumulated['amount']));

        // Close 2026: revenue and expenses go to zero, Retained Earnings takes the profit.
        $this->post(route('double-entry.balance-sheets.year-end-close'), ['closing_date' => '2026-12-31'])->assertSessionHasNoErrors();
        $closing = YearEndClosing::query()->sole();
        // The first close sweeps every unclosed year (the 2024–25 depreciation too), not just 2026.
        $sinceInception = $this->get(route('double-entry.profit-loss.index', ['date_from' => '2000-01-01', 'date_to' => '2026-12-31']))->inertiaProps('report.net');
        $this->assertSame($sinceInception, $closing->net_profit);

        $after = FinancialStatements::balances(null, '2026-12-31');
        $this->assertSame(0, $after->whereIn('category', ['revenue', 'expenses'])->sum(fn ($r) => abs($r['closing'])));
        $this->assertSame(Money::toCents($sinceInception), $after->firstWhere('code', LedgerAccounts::RETAINED_EARNINGS)['closing']);

        // The year's P&L ignores the closing entry; the balance sheet still balances, now without current earnings.
        $this->assertSame($pl['net'], $this->get(route('double-entry.profit-loss.index', ['date_from' => '2026-01-01', 'date_to' => '2026-12-31']))->inertiaProps('report.net'));
        $bsAfter = $this->get(route('double-entry.balance-sheets.index', ['date_to' => '2026-12-31', 'compare_to' => '2026-06-30']))->inertiaProps();
        $this->assertSame($bs['total_equity'], $bsAfter['report']['total_equity']);
        $this->assertNotContains('Current Year Earnings', collect($bsAfter['report']['equity'])->flatMap(fn ($g) => array_column($g['rows'], 'name'))->all());
        $this->assertNotNull($bsAfter['comparison']);
        $tbAfter = $this->get(route('double-entry.trial-balance.index', ['date_to' => '2026-12-31']))->inertiaProps('report');
        $this->assertSame($tbAfter['debit'], $tbAfter['credit']);

        // Can't close the same period twice, or a date still to come.
        $this->post(route('double-entry.balance-sheets.year-end-close'), ['closing_date' => '2026-12-31'])->assertSessionHasErrors('closing_date');
        $this->post(route('double-entry.balance-sheets.year-end-close'), ['closing_date' => '2027-12-31'])->assertSessionHasErrors('closing_date');
        $this->assertSame(1, YearEndClosing::query()->count());

        // Ledger summary filters by account, and every PDF renders.
        $ar = $this->get(route('double-entry.ledger-summary.index', ['account_id' => LedgerAccounts::id(LedgerAccounts::ACCOUNTS_RECEIVABLE), 'date_from' => '2026-01-01', 'date_to' => '2026-12-31']))
            ->assertOk()->inertiaProps('lines.data');
        $this->assertNotEmpty($ar);
        $this->assertSame([LedgerAccounts::ACCOUNTS_RECEIVABLE], array_values(array_unique(array_column($ar, 'account_code'))));

        foreach (['ledger-summary', 'trial-balance', 'profit-loss', 'balance-sheets'] as $statement) {
            $this->get(route("double-entry.{$statement}.print"))->assertOk()->assertHeader('content-type', 'application/pdf');
        }
    }

    public function test_unbalanced_opening_balances_show_as_opening_balance_equity(): void
    {
        $this->seed(LedgerSeeder::class);
        ChartOfAccount::query()->where('account_code', '1000')->update(['opening_balance' => '250.00']);

        $tb = FinancialStatements::trialBalance(today()->toDateString());
        $this->assertSame($tb['debit'], $tb['credit']);
        // RM250 more debit than credit in the openings: equity takes it as a credit.
        $obe = collect($tb['rows'])->firstWhere('name', 'Opening Balance Equity');
        $this->assertSame([0, 25000], [$obe['debit'], $obe['credit']]);

        $bs = FinancialStatements::balanceSheet(today()->toDateString());
        $this->assertSame($bs['total_assets'], $bs['total_liabilities'] + $bs['total_equity']);
    }

    public function test_only_users_with_each_permission_see_the_statements(): void
    {
        $this->actingAs($this->userWithRole('staff'));

        foreach (['ledger-summary', 'trial-balance', 'profit-loss', 'balance-sheets'] as $statement) {
            $this->get(route("double-entry.{$statement}.index"))->assertForbidden();
        }

        $this->post(route('double-entry.balance-sheets.year-end-close'), ['closing_date' => '2026-01-31'])->assertForbidden();
    }
}
