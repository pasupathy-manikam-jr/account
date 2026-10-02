<?php

namespace Database\Seeders;

use App\Models\AccountType;
use App\Models\BankAccount;
use App\Models\ChartOfAccount;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class LedgerSeeder extends Seeder
{
    /**
     * The standard account types, chart of accounts and demo bank accounts (database/demo/*.json).
     * Seeded types and accounts are system records: they can be edited but not deleted.
     */
    public function run(): void
    {
        /** @var list<array<string, string>> $types */
        $types = File::json(database_path('demo/account_types.json'), JSON_THROW_ON_ERROR);

        foreach ($types as $row) {
            AccountType::query()->firstOrNew(['code' => $row['code']])
                ->fill($row)->forceFill(['is_system_type' => true])->save();
        }

        $typeIds = AccountType::query()->pluck('id', 'code');

        /** @var list<array<string, string>> $accounts */
        $accounts = File::json(database_path('demo/chart_of_accounts.json'), JSON_THROW_ON_ERROR);

        foreach ($accounts as $row) {
            ChartOfAccount::query()->firstOrNew(['account_code' => $row['account_code']])->fill([
                'account_name' => $row['account_name'],
                'account_type_id' => $typeIds[$row['type']],
                'normal_balance' => $row['normal_balance'],
                'description' => $row['description'],
                // Bank-linked accounts get theirs from the bank account below.
                'opening_balance' => $row['opening_balance'] ?? '0.00',
            ])->forceFill(['is_system_account' => true])->save();
        }

        $accountIds = ChartOfAccount::query()->pluck('id', 'account_code');

        /** @var list<array<string, mixed>> $banks */
        $banks = File::json(database_path('demo/bank_accounts.json'), JSON_THROW_ON_ERROR);

        foreach ($banks as $row) {
            $gl = $accountIds[$row['gl_account']];
            unset($row['gl_account']);

            BankAccount::query()->updateOrCreate(['account_number' => $row['account_number']], [...$row, 'gl_account_id' => $gl]);
            // Model events are off under DatabaseSeeder, so mirror BankAccount::booted() here.
            ChartOfAccount::query()->whereKey($gl)->update(['opening_balance' => $row['opening_balance']]);
        }
    }
}
