<?php

namespace Tests\Feature\Account;

use App\Models\BankAccount;
use App\Models\CashEntry;
use App\Models\ChartOfAccount;
use App\Models\TransactionCategory;
use Database\Seeders\LedgerSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashEntryTest extends TestCase
{
    use RefreshDatabase;

    private BankAccount $bank;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(LedgerSeeder::class);
        $this->bank = BankAccount::query()->where('account_type', 'checking')->where('is_active', true)->firstOrFail();
    }

    private function account(string $code): ChartOfAccount
    {
        return ChartOfAccount::query()->withTotals()->where('account_code', $code)->sole();
    }

    private function category(string $kind, string $code): TransactionCategory
    {
        $category = new TransactionCategory(['category_name' => ucfirst($kind), 'category_code' => strtoupper($kind).'-1', 'gl_account_id' => $this->account($code)->id]);
        $category->forceFill(['kind' => $kind])->save();

        return $category;
    }

    public function test_revenue_is_approved_then_posted_into_the_bank(): void
    {
        $user = $this->userWithRole();
        $category = $this->category('revenue', '4130');

        $this->actingAs($user)->post(route('account.revenues.store'), [
            'entry_date' => '2026-10-01', 'category_id' => $category->id, 'bank_account_id' => $this->bank->id,
            'chart_of_account_id' => $category->gl_account_id, 'amount' => '7650.00', 'description' => 'Annual maintenance contract',
        ])->assertSessionHasNoErrors();
        $entry = CashEntry::query()->sole();
        $this->assertSame(sprintf('REV-2026-10-%03d', $entry->id), $entry->entry_number);

        // Must be approved before it can be posted.
        $this->actingAs($user)->put(route('account.revenues.post', $entry))->assertSessionHasErrors('status');
        $this->actingAs($user)->put(route('account.revenues.approve', $entry));
        $this->actingAs($user)->put(route('account.revenues.post', $entry))->assertSessionHasNoErrors();

        $this->assertSame('posted', $entry->fresh()->status);
        $this->assertSame('7650.00', $this->account('4130')->currentBalance());
        $this->assertSame(
            number_format((float) $this->bank->opening_balance + 7650, 2, '.', ''),
            $this->account($this->bank->glAccount->account_code)->currentBalance(),
        );
    }

    public function test_an_expense_is_charged_and_paid_from_the_bank(): void
    {
        $category = $this->category('expense', '5320');
        $entry = new CashEntry(['entry_date' => '2026-10-01', 'category_id' => $category->id, 'bank_account_id' => $this->bank->id, 'chart_of_account_id' => $category->gl_account_id, 'amount' => '1200.00']);
        $entry->forceFill(['kind' => 'expense'])->save();
        $entry->assignNumber();
        $entry->approve($this->userWithRole());
        $entry->post();

        $this->assertSame('1200.00', $this->account('5320')->currentBalance());
        $this->assertSame(
            number_format((float) $this->bank->opening_balance - 1200, 2, '.', ''),
            $this->account($this->bank->glAccount->account_code)->currentBalance(),
        );
    }

    public function test_the_month_strip_narrows_the_expense_list(): void
    {
        $category = $this->category('expense', '5320');
        foreach (['2026-09-15', '2026-10-01', '2026-10-20'] as $date) {
            $entry = new CashEntry(['entry_date' => $date, 'category_id' => $category->id, 'bank_account_id' => $this->bank->id, 'chart_of_account_id' => $category->gl_account_id, 'amount' => '10.00']);
            $entry->forceFill(['kind' => 'expense'])->save();
        }

        $this->actingAs($this->userWithRole())->get(route('account.expenses.index', ['month' => '2026-10']))
            ->assertInertia(fn ($page) => $page->has('entries.data', 2)->where('counts.all', 2)->where('filters.month', '2026-10'));
    }

    public function test_entries_post_only_to_accounts_of_their_kind(): void
    {
        $user = $this->userWithRole();
        $revenueCategory = $this->category('revenue', '4130');

        $this->actingAs($user)->post(route('account.expenses.store'), [
            'entry_date' => '2026-10-01', 'category_id' => $revenueCategory->id, 'bank_account_id' => $this->bank->id,
            'chart_of_account_id' => $this->account('4130')->id, 'amount' => '-5',
        ])->assertSessionHasErrors(['category_id', 'chart_of_account_id', 'amount']);

        $this->actingAs($user)->post(route('account.expense-categories.store'), [
            'category_name' => 'Travel', 'category_code' => 'EXP-T', 'gl_account_id' => $this->account('1000')->id,
        ])->assertSessionHasErrors('gl_account_id');
    }

    public function test_categories_with_entries_are_kept_and_posted_entries_are_locked(): void
    {
        $user = $this->userWithRole();
        $category = $this->category('expense', '5300');
        $entry = new CashEntry(['entry_date' => '2026-10-01', 'category_id' => $category->id, 'bank_account_id' => $this->bank->id, 'chart_of_account_id' => $category->gl_account_id, 'amount' => '2000.00']);
        $entry->forceFill(['kind' => 'expense'])->save();
        $entry->assignNumber();
        $entry->approve($user);
        $entry->post();

        $this->actingAs($user)->delete(route('account.expense-categories.destroy', $category));
        $this->assertModelExists($category);
        $this->actingAs($user)->delete(route('account.expenses.destroy', $entry));
        $this->assertModelExists($entry);
        // A revenue route can't touch an expense.
        $this->actingAs($user)->put(route('account.revenues.approve', $entry))->assertNotFound();
    }

    public function test_renders_the_pages_and_guards_access(): void
    {
        $user = $this->userWithRole();
        $this->category('revenue', '4130');

        foreach (['account.revenues.index', 'account.expenses.index', 'account.revenue-categories.index', 'account.expense-categories.index'] as $name) {
            $this->actingAs($user)->get(route($name))->assertOk();
        }
        $this->actingAs($user)->get(route('account.revenue-categories.index'))->assertInertia(fn ($page) => $page->has('categories', 1)->where('kind', 'revenue'));
        $this->actingAs($this->userWithRole('vendor'))->get(route('account.revenues.index'))->assertForbidden();
    }
}
