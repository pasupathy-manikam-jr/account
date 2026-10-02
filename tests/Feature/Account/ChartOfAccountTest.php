<?php

namespace Tests\Feature\Account;

use App\Models\AccountType;
use App\Models\ChartOfAccount;
use App\Support\Ledger;
use Database\Seeders\LedgerSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChartOfAccountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(LedgerSeeder::class);
    }

    private function payload(array $overrides = []): array
    {
        return [
            'account_code' => '1050',
            'account_name' => 'Cash - Branch',
            'account_type_id' => AccountType::query()->where('code', 'CA')->value('id'),
            'parent_account_id' => null,
            'normal_balance' => 'debit',
            'opening_balance' => '250.50',
            'description' => null,
            'is_active' => true,
            ...$overrides,
        ];
    }

    private function account(string $code): ChartOfAccount
    {
        return ChartOfAccount::query()->where('account_code', $code)->firstOrFail();
    }

    public function test_lists_with_balance_tabs_and_current_balances(): void
    {
        Ledger::post('2026-10-01', 'Cash sale', [
            ['account_id' => $this->account('1000')->id, 'debit' => '120.00'],
            ['account_id' => $this->account('4100')->id, 'credit' => '120.00'],
        ]);

        $this->actingAs($this->userWithRole())
            ->get(route('account.chart-of-accounts.index', ['search' => '1000']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('account/chart-of-accounts/index')
                ->where('counts', ['all' => 1, 'debit' => 1, 'credit' => 0])
                ->where('accounts.data.0.account_code', '1000')
                ->where('accounts.data.0.current_balance', '120.00'));

        $this->actingAs($this->userWithRole())
            ->get(route('account.chart-of-accounts.index', ['normal_balance' => 'credit', 'per_page' => 100]))
            ->assertInertia(fn ($page) => $page->has('accounts.data', 24)->where('counts.all', 54));
    }

    public function test_shows_an_account_with_its_journal_history(): void
    {
        $cash = $this->account('1000');
        Ledger::post('2026-10-01', 'Cash sale', [
            ['account_id' => $cash->id, 'debit' => '75.25'],
            ['account_id' => $this->account('4100')->id, 'credit' => '75.25'],
        ]);

        $this->actingAs($this->userWithRole())
            ->get(route('account.chart-of-accounts.show', $cash))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('account/chart-of-accounts/show')
                ->where('account.current_balance', '75.25')
                ->has('history.data', 1)
                ->where('history.data.0.journal_entry.description', 'Cash sale'));
    }

    public function test_creates_a_sub_account_one_level_down_then_updates_and_deletes_it(): void
    {
        $user = $this->userWithRole();
        $parent = $this->account('1000');

        $this->actingAs($user)->post(route('account.chart-of-accounts.store'), $this->payload(['parent_account_id' => $parent->id]))->assertSessionHasNoErrors();
        $child = $this->account('1050');
        $this->assertSame(2, $child->level);
        $this->assertSame('250.50', $child->opening_balance);

        $this->actingAs($user)->put(route('account.chart-of-accounts.update', $child), $this->payload(['account_name' => 'Cash - Penang']))->assertSessionHasNoErrors();
        $this->assertSame(1, $child->fresh()->level);
        $this->assertSame('Cash - Penang', $child->fresh()->account_name);

        $this->actingAs($user)->delete(route('account.chart-of-accounts.destroy', $child));
        $this->assertModelMissing($child);
    }

    public function test_validates_codes_amounts_and_loops(): void
    {
        $user = $this->userWithRole();

        $this->actingAs($user)
            ->post(route('account.chart-of-accounts.store'), $this->payload(['account_code' => '1000', 'account_name' => '', 'opening_balance' => '12.345', 'normal_balance' => 'x']))
            ->assertSessionHasErrors(['account_code', 'account_name', 'opening_balance', 'normal_balance']);

        $parent = $this->account('1000');
        $child = ChartOfAccount::create([...$this->payload(['parent_account_id' => $parent->id]), 'level' => 2]);

        $this->actingAs($user)
            ->put(route('account.chart-of-accounts.update', $parent), [...$this->payload(['account_code' => '1000', 'parent_account_id' => $child->id])])
            ->assertSessionHasErrors('parent_account_id');
    }

    public function test_keeps_system_accounts_and_accounts_with_postings(): void
    {
        $user = $this->userWithRole();
        $system = $this->account('1000');
        $this->actingAs($user)->delete(route('account.chart-of-accounts.destroy', $system));
        $this->assertModelExists($system);

        $custom = ChartOfAccount::create($this->payload());
        Ledger::post('2026-10-01', 'Float', [
            ['account_id' => $custom->id, 'debit' => 10],
            ['account_id' => $system->id, 'credit' => 10],
        ]);
        $this->actingAs($user)->delete(route('account.chart-of-accounts.destroy', $custom));
        $this->assertModelExists($custom);
    }

    public function test_other_roles_cannot_manage_accounts(): void
    {
        $this->actingAs($this->userWithRole('client'))->get(route('account.chart-of-accounts.index'))->assertForbidden();
        $this->actingAs($this->userWithRole('staff'))->post(route('account.chart-of-accounts.store'), $this->payload())->assertForbidden();
    }
}
