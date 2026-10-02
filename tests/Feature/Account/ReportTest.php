<?php

namespace Tests\Feature\Account;

use App\Models\JournalEntryItem;
use App\Models\User;
use App\Support\LedgerAccounts;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    /** Debit minus credit on one system account, in cents. */
    private function ledger(string $code): int
    {
        return (int) JournalEntryItem::query()->where('account_id', LedgerAccounts::id($code))
            ->get()->sum(fn (JournalEntryItem $i) => Money::toCents($i->debit_amount) - Money::toCents($i->credit_amount));
    }

    public function test_reports_reconcile_to_the_ledger(): void
    {
        $this->seed();
        $admin = User::query()->where('email', 'admin@example.com')->firstOrFail();
        $this->actingAs($admin);
        $future = ['as_of' => today()->addYears(2)->toDateString(), 'date_from' => '2000-01-01', 'date_to' => today()->addYears(2)->toDateString()];

        $customers = $this->get(route('account.reports.index', ['report' => 'customer-balance', ...$future]))->assertOk()
            ->assertInertia(fn ($page) => $page->component('account/reports/index'))->inertiaProps('data');
        $this->assertSame($this->ledger(LedgerAccounts::ACCOUNTS_RECEIVABLE), Money::toCents($customers['totals']['balance']));

        $vendors = $this->get(route('account.reports.index', ['report' => 'vendor-balance', ...$future]))->inertiaProps('data');
        $this->assertSame(-$this->ledger(LedgerAccounts::ACCOUNTS_PAYABLE), Money::toCents($vendors['totals']['balance']));

        $tax = $this->get(route('account.reports.index', ['report' => 'tax-summary', ...$future]))->inertiaProps('data');
        $this->assertSame(-$this->ledger(LedgerAccounts::SST_PAYABLE), Money::toCents($tax['total_collected']));
        $this->assertSame($this->ledger(LedgerAccounts::TAX_RECEIVABLE), Money::toCents($tax['total_paid']));

        // Aging covers unpaid invoices only, so it is the balance plus credit notes not yet applied.
        $aging = $this->get(route('account.reports.index', ['report' => 'invoice-aging', ...$future]))->inertiaProps('data');
        $this->assertGreaterThanOrEqual(Money::toCents($customers['totals']['balance']), Money::toCents($aging['totals']['total']));
        $this->assertSame(Money::toCents($aging['totals']['total']), collect($aging['rows'])->sum(fn ($r) => Money::toCents($r['total'])));

        // Each party's statement closes on its balance-report figure.
        foreach ($customers['rows'] as $row) {
            $statement = $this->get(route('account.reports.statement', ['party' => $row['party_id'], 'date_from' => '2000-01-01', 'date_to' => $future['as_of']]))
                ->assertOk()->inertiaProps();
            $this->assertSame($row['balance'], $statement['closing'], $row['name']);
        }

        $vendor = $vendors['rows'][0];
        $this->assertSame($vendor['balance'], $this->get(route('account.reports.statement', ['party' => $vendor['party_id'], 'date_from' => '2000-01-01', 'date_to' => $future['as_of']]))->inertiaProps('closing'));

        $this->get(route('account.reports.pdf', ['report' => 'bill-aging']))->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->get(route('account.reports.statement.pdf', $vendor['party_id']))->assertOk()->assertHeader('content-type', 'application/pdf');

        // Staff (an internal user) has no statement of its own; bad input is a validation error.
        $this->get(route('account.reports.statement', $admin))->assertNotFound();
        $this->get(route('account.reports.index', ['report' => 'nope']))->assertSessionHasErrors('report');
    }

    public function test_only_users_with_the_reports_permission_can_open_them(): void
    {
        $this->actingAs($this->userWithRole('client'))->get(route('account.reports.index'))->assertForbidden();
        $this->actingAs($this->userWithRole())->get(route('account.reports.index'))->assertOk();
    }
}
