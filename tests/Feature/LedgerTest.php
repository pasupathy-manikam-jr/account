<?php

namespace Tests\Feature;

use App\Models\AccountType;
use App\Models\ChartOfAccount;
use App\Support\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class LedgerTest extends TestCase
{
    use RefreshDatabase;

    private function account(string $code, string $category, string $opening = '0'): ChartOfAccount
    {
        $type = AccountType::query()->firstOrCreate(
            ['code' => strtoupper($category)],
            ['name' => ucfirst($category), 'category' => $category, 'normal_balance' => AccountType::CATEGORIES[$category]],
        );

        return ChartOfAccount::create([
            'account_code' => $code,
            'account_name' => "Account {$code}",
            'account_type_id' => $type->id,
            'normal_balance' => $type->normal_balance,
            'opening_balance' => $opening,
        ]);
    }

    private function balance(ChartOfAccount $account): string
    {
        return ChartOfAccount::query()->withTotals()->findOrFail($account->id)->currentBalance();
    }

    public function test_posts_a_balanced_entry_and_moves_balances_on_their_normal_side(): void
    {
        $cash = $this->account('1000', 'assets', '100.00');
        $revenue = $this->account('4000', 'revenue');
        $tax = $this->account('2210', 'liabilities');

        $entry = Ledger::post('2026-10-01', 'Invoice INV-1', [
            ['account_id' => $cash->id, 'debit' => '110.10'],
            ['account_id' => $revenue->id, 'credit' => '100.00'],
            ['account_id' => $tax->id, 'credit' => '10.10'],
        ]);

        $this->assertSame(sprintf('JE-2026-%04d', $entry->id), $entry->journal_number);
        $this->assertCount(3, $entry->items);
        $this->assertSame('210.10', $this->balance($cash));
        $this->assertSame('100.00', $this->balance($revenue));
        $this->assertSame('10.10', $this->balance($tax));

        // Float sums would drift here: 0.1 + 0.2 is not 0.3.
        Ledger::post('2026-10-02', 'Refund', [
            ['account_id' => $revenue->id, 'debit' => '0.1'],
            ['account_id' => $revenue->id, 'debit' => '0.2'],
            ['account_id' => $cash->id, 'credit' => '0.3'],
        ]);
        $this->assertSame('209.80', $this->balance($cash));
    }

    public function test_rejects_unbalanced_one_sided_or_inactive_entries(): void
    {
        $cash = $this->account('1000', 'assets');
        $revenue = $this->account('4000', 'revenue');
        $closed = $this->account('4100', 'revenue');
        $closed->update(['is_active' => false]);

        $cases = [
            [['account_id' => $cash->id, 'debit' => 100], ['account_id' => $revenue->id, 'credit' => 99.99]],
            [['account_id' => $cash->id, 'debit' => 100, 'credit' => 100], ['account_id' => $revenue->id, 'credit' => 0]],
            [['account_id' => $cash->id, 'debit' => -5], ['account_id' => $revenue->id, 'credit' => -5]],
            [['account_id' => $cash->id, 'debit' => 100]],
            [['account_id' => $cash->id, 'debit' => 100], ['account_id' => $closed->id, 'credit' => 100]],
        ];

        foreach ($cases as $lines) {
            try {
                Ledger::post('2026-10-01', 'Bad', $lines);
                $this->fail('Expected the entry to be rejected: '.json_encode($lines));
            } catch (ValidationException $e) {
                $this->assertArrayHasKey('lines', $e->errors());
            }
        }

        $this->assertDatabaseCount('journal_entries', 0);
        $this->assertDatabaseCount('journal_entry_items', 0);
    }
}
