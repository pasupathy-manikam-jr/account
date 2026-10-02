<?php

namespace Tests\Feature\Account;

use App\Models\BankAccount;
use App\Models\BankTransfer;
use App\Models\ChartOfAccount;
use App\Models\JournalEntryItem;
use App\Support\Ledger;
use Database\Seeders\LedgerSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BankingTest extends TestCase
{
    use RefreshDatabase;

    private BankAccount $current;

    private BankAccount $savings;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(LedgerSeeder::class);
        $this->current = BankAccount::query()->where('account_type', 'checking')->where('is_active', true)->firstOrFail();
        $this->savings = BankAccount::query()->where('account_type', 'savings')->firstOrFail();
    }

    private function balance(BankAccount $bank): string
    {
        return ChartOfAccount::query()->withTotals()->findOrFail($bank->gl_account_id)->currentBalance();
    }

    public function test_a_processed_transfer_moves_money_and_charges_the_fee(): void
    {
        $user = $this->userWithRole();
        $before = [$this->balance($this->current), $this->balance($this->savings)];

        $this->actingAs($user)->post(route('account.bank-transfers.store'), [
            'transfer_date' => '2026-10-01', 'from_account_id' => $this->savings->id, 'to_account_id' => $this->current->id,
            'transfer_amount' => '6800.00', 'transfer_charges' => '13.00', 'reference_number' => 'IBG-015',
        ])->assertSessionHasNoErrors();
        $transfer = BankTransfer::query()->sole();
        $this->assertSame('pending', $transfer->status);
        $this->assertSame($before[0], $this->balance($this->current));

        $this->actingAs($user)->put(route('account.bank-transfers.process', $transfer))->assertSessionHasNoErrors();

        $this->assertSame('completed', $transfer->fresh()->status);
        $this->assertSame(number_format((float) $before[0] + 6800, 2, '.', ''), $this->balance($this->current));
        $this->assertSame(number_format((float) $before[1] - 6813, 2, '.', ''), $this->balance($this->savings));
        $this->assertSame('13.00', ChartOfAccount::query()->withTotals()->where('account_code', '5510')->sole()->currentBalance());

        // Processed transfers are locked.
        $this->actingAs($user)->put(route('account.bank-transfers.process', $transfer))->assertSessionHasErrors('status');
        $this->actingAs($user)->delete(route('account.bank-transfers.destroy', $transfer));
        $this->assertModelExists($transfer);
    }

    public function test_cannot_transfer_to_the_same_account_or_a_negative_amount(): void
    {
        $this->actingAs($this->userWithRole())->post(route('account.bank-transfers.store'), [
            'transfer_date' => '2026-10-01', 'from_account_id' => $this->current->id, 'to_account_id' => $this->current->id, 'transfer_amount' => '-1',
        ])->assertSessionHasErrors(['to_account_id', 'transfer_amount']);
    }

    public function test_the_register_shows_bank_lines_with_a_running_balance_and_reconciles_them(): void
    {
        $user = $this->userWithRole();
        $sales = ChartOfAccount::query()->where('account_code', '4100')->sole();
        Ledger::post('2026-10-01', 'Cash sale', [['account_id' => $this->current->gl_account_id, 'debit' => 100], ['account_id' => $sales->id, 'credit' => 100]]);
        Ledger::post('2026-10-02', 'Refund', [['account_id' => $sales->id, 'debit' => 30], ['account_id' => $this->current->gl_account_id, 'credit' => 30]]);

        $this->actingAs($user)->get(route('account.bank-transactions.index', ['bank_account_id' => $this->current->id]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('account/bank-transactions/index')
                ->has('transactions.data', 2)
                ->where('counts', ['all' => 2, 'credit' => 1, 'debit' => 1])
                // Newest first: after the refund the balance is opening + 100 − 30.
                ->where('transactions.data.0.running_balance', fn ($v) => (float) $v === (float) $this->current->opening_balance + 70));

        // As on a bank statement: Credit is money in (the sale), Debit money out (the refund).
        $this->actingAs($user)->get(route('account.bank-transactions.index', ['bank_account_id' => $this->current->id, 'type' => 'credit']))
            ->assertInertia(fn ($page) => $page->has('transactions.data', 1)->where('transactions.data.0.debit_amount', fn ($v) => (float) $v === 100.0));
        // A date range narrows the lines but keeps the balance worked out from every line before it.
        $this->actingAs($user)->get(route('account.bank-transactions.index', ['bank_account_id' => $this->current->id, 'date_from' => '2026-10-02', 'date_to' => '2026-10-02']))
            ->assertInertia(fn ($page) => $page->has('transactions.data', 1)
                ->where('transactions.data.0.running_balance', fn ($v) => (float) $v === (float) $this->current->opening_balance + 70));

        $line = JournalEntryItem::query()->where('account_id', $this->current->gl_account_id)->firstOrFail();
        $this->actingAs($user)->put(route('account.bank-transactions.reconcile', $line));
        $this->assertNotNull($line->fresh()->reconciled_at);
        $this->actingAs($user)->put(route('account.bank-transactions.reconcile', $line));
        $this->assertNull($line->fresh()->reconciled_at);

        // Lines on non-bank accounts are not part of the register.
        $salesLine = JournalEntryItem::query()->where('account_id', $sales->id)->firstOrFail();
        $this->actingAs($user)->put(route('account.bank-transactions.reconcile', $salesLine))->assertNotFound();
    }

    public function test_guards_access(): void
    {
        $this->actingAs($this->userWithRole('vendor'))->get(route('account.bank-transactions.index'))->assertForbidden();
        $this->actingAs($this->userWithRole('client'))->get(route('account.bank-transfers.index'))->assertForbidden();
    }
}
