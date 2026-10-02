<?php

namespace Database\Seeders;

use App\Models\BankAccount;
use App\Models\BankTransfer;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class BankTransferSeeder extends Seeder
{
    /**
     * The demo's bank transfers (database/demo/bank_transfers.json) between our active bank accounts.
     * Completed ones go through BankTransfer::process(), so balances move for real. Skipped once transfers exist.
     */
    public function run(): void
    {
        if (BankTransfer::query()->exists()) {
            return;
        }

        /** @var list<array{date: string, from: int, to: int, amount: string, charges: string, reference_number: string|null, description: string|null, status: string}> $rows */
        $rows = File::json(database_path('demo/bank_transfers.json'), JSON_THROW_ON_ERROR);
        $banks = BankAccount::query()->where('is_active', true)->orderBy('id')->pluck('id')->all();
        $creator = User::query()->where('email', 'admin@example.com')->value('id');

        if (count($banks) < 2) {
            return;
        }

        foreach ($rows as $row) {
            $from = $banks[$row['from'] % count($banks)];
            $to = $banks[$row['to'] % count($banks)];

            if ($from === $to) {
                $to = $banks[($row['to'] + 1) % count($banks)];
            }

            $transfer = new BankTransfer([
                'transfer_date' => $row['date'],
                'from_account_id' => $from,
                'to_account_id' => $to,
                'transfer_amount' => $row['amount'],
                'transfer_charges' => $row['charges'],
                'reference_number' => $row['reference_number'],
                'description' => $row['description'],
            ]);
            $transfer->forceFill(['created_by' => $creator])->save();
            $transfer->assignNumber();

            if ($row['status'] === 'completed') {
                $transfer->process();
            }
        }
    }
}
