<?php

namespace Database\Seeders;

use App\Models\BankAccount;
use App\Models\CashEntry;
use App\Models\ChartOfAccount;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class CashEntrySeeder extends Seeder
{
    /**
     * The demo's revenue/expense categories and entries (database/demo/cash_entries.json). Posted entries go
     * through CashEntry::post(), so the bank and ledger balances move for real. Skipped once entries exist.
     */
    public function run(): void
    {
        /** @var array{categories: list<array<string, mixed>>, entries: list<array<string, mixed>>} $data */
        $data = File::json(database_path('demo/cash_entries.json'), JSON_THROW_ON_ERROR);
        $accounts = ChartOfAccount::query()->pluck('id', 'account_code');

        foreach ($data['categories'] as $row) {
            if (! isset($accounts[$row['gl_account']])) {
                continue;
            }

            TransactionCategory::query()->firstOrNew(['kind' => $row['kind'], 'category_code' => $row['category_code']])
                ->fill(['category_name' => $row['category_name'], 'gl_account_id' => $accounts[$row['gl_account']], 'description' => $row['description']])
                ->save();
        }

        if (CashEntry::query()->exists()) {
            return;
        }

        $categories = TransactionCategory::query()->get()->keyBy(fn (TransactionCategory $c) => "{$c->kind}:{$c->category_code}");
        $banks = BankAccount::query()->where('is_active', true)->whereIn('account_type', BankAccount::CASH_TYPES)->orderBy('id')->pluck('id')->all();
        $admin = User::query()->where('email', 'admin@example.com')->first();

        foreach ($data['entries'] as $row) {
            $category = $categories["{$row['kind']}:{$row['category']}"] ?? null;

            if (! $category || $banks === [] || ! $admin) {
                continue;
            }

            $entry = new CashEntry([
                'entry_date' => $row['date'],
                'category_id' => $category->id,
                'bank_account_id' => $banks[$row['bank'] % count($banks)],
                'chart_of_account_id' => $category->gl_account_id,
                'amount' => $row['amount'],
                'description' => $row['description'],
                'reference_number' => $row['reference_number'],
            ]);
            $entry->forceFill(['kind' => $row['kind'], 'created_by' => $admin->id])->save();
            $entry->assignNumber();

            if ($row['status'] !== 'draft') {
                $entry->approve($admin);
            }

            if ($row['status'] === 'posted') {
                $entry->post();
            }
        }
    }
}
