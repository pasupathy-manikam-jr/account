<?php

namespace Tests\Feature\Account;

use App\Models\BankAccount;
use App\Models\ChartOfAccount;
use App\Support\Ledger;
use Database\Seeders\LedgerSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BankAccountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(LedgerSeeder::class);
    }

    private function gl(string $code): ChartOfAccount
    {
        return ChartOfAccount::query()->where('account_code', $code)->firstOrFail();
    }

    private function payload(array $overrides = []): array
    {
        return [
            'account_number' => '5641-2233-0091',
            'account_name' => 'Payroll Account',
            'bank_name' => 'Maybank',
            'branch_name' => 'Jalan Tun Perak',
            'account_type' => 'checking',
            'opening_balance' => '1000.00',
            'iban' => null,
            'swift_code' => 'MBBEMYKL',
            'routing_number' => null,
            'is_active' => true,
            'gl_account_id' => $this->gl('1030')->id,
            ...$overrides,
        ];
    }

    public function test_lists_with_type_tabs_and_balances_from_the_ledger(): void
    {
        $bank = BankAccount::query()->where('account_type', 'savings')->firstOrFail();
        Ledger::post('2026-10-01', 'Deposit', [
            ['account_id' => $bank->gl_account_id, 'debit' => '500.00'],
            ['account_id' => $this->gl('4100')->id, 'credit' => '500.00'],
        ]);

        $this->actingAs($this->userWithRole())
            ->get(route('account.bank-accounts.index', ['account_type' => 'savings']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('account/bank-accounts/index')
                ->where('counts', ['all' => 5, 'checking' => 2, 'savings' => 1, 'credit' => 1, 'loan' => 1])
                ->has('bankAccounts.data', 1)
                ->where('bankAccounts.data.0.current_balance', number_format((float) $bank->opening_balance + 500, 2, '.', '')));
    }

    public function test_creates_updates_and_deletes_a_bank_account(): void
    {
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('account.bank-accounts.store'), $this->payload())->assertSessionHasNoErrors();
        $bank = BankAccount::query()->where('account_number', '5641-2233-0091')->firstOrFail();

        $this->actingAs($user)->put(route('account.bank-accounts.update', $bank), $this->payload(['is_active' => false]))->assertSessionHasNoErrors();
        $this->assertFalse($bank->fresh()->is_active);

        $this->actingAs($user)->delete(route('account.bank-accounts.destroy', $bank));
        $this->assertModelMissing($bank);
    }

    public function test_the_opening_balance_lives_on_the_ledger_account(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('account.bank-accounts.store'), $this->payload())->assertSessionHasNoErrors();
        $bank = BankAccount::query()->where('account_number', '5641-2233-0091')->firstOrFail();
        $this->assertSame('1000.00', $this->gl('1030')->opening_balance);

        // Moving the bank to another ledger account moves its opening balance with it.
        $this->actingAs($user)->put(route('account.bank-accounts.update', $bank), $this->payload(['gl_account_id' => $this->gl('1040')->id]))->assertSessionHasNoErrors();
        $this->assertSame('0.00', $this->gl('1030')->opening_balance);
        $this->assertSame('1000.00', $this->gl('1040')->opening_balance);
    }

    public function test_one_ledger_account_backs_one_bank_account(): void
    {
        $taken = BankAccount::query()->firstOrFail()->gl_account_id;

        $this->actingAs($this->userWithRole())
            ->post(route('account.bank-accounts.store'), $this->payload(['gl_account_id' => $taken, 'account_type' => 'current', 'account_name' => '']))
            ->assertSessionHasErrors(['gl_account_id', 'account_type', 'account_name']);
    }

    public function test_keeps_bank_accounts_with_postings(): void
    {
        $bank = BankAccount::query()->firstOrFail();
        Ledger::post('2026-10-01', 'Fee', [
            ['account_id' => $this->gl('5510')->id, 'debit' => 5],
            ['account_id' => $bank->gl_account_id, 'credit' => 5],
        ]);

        $this->actingAs($this->userWithRole())->delete(route('account.bank-accounts.destroy', $bank));
        $this->assertModelExists($bank);
    }

    public function test_other_roles_cannot_manage_bank_accounts(): void
    {
        $this->actingAs($this->userWithRole('vendor'))->get(route('account.bank-accounts.index'))->assertForbidden();
        $this->actingAs($this->userWithRole('staff'))->delete(route('account.bank-accounts.destroy', BankAccount::query()->firstOrFail()))->assertForbidden();
    }
}
