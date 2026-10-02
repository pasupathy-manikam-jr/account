<?php

namespace App\Support;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The double-entry engine: the only way money reaches the ledger.
 */
class Ledger
{
    /**
     * Post one balanced journal entry.
     *
     * Each line moves one account on one side; debits must equal credits to the cent.
     * Errors are thrown as a validation error on "lines", so a controller can let them bubble.
     *
     * @param  list<array{account_id: int, debit?: string|int|float|null, credit?: string|int|float|null, description?: string|null}>  $lines
     */
    public static function post(string $date, string $description, array $lines, ?Model $reference = null): JournalEntry
    {
        $rows = [];
        $debits = 0;
        $credits = 0;

        foreach ($lines as $line) {
            $debit = Money::toCents($line['debit'] ?? 0);
            $credit = Money::toCents($line['credit'] ?? 0);

            if ($debit < 0 || $credit < 0 || ($debit > 0) === ($credit > 0)) {
                self::fail(__('Each journal line needs either a debit or a credit amount.'));
            }

            $debits += $debit;
            $credits += $credit;
            $rows[] = [
                'account_id' => $line['account_id'],
                'description' => $line['description'] ?? null,
                'debit_amount' => Money::format($debit),
                'credit_amount' => Money::format($credit),
            ];
        }

        if (count($rows) < 2) {
            self::fail(__('A journal entry needs at least two lines.'));
        }

        if ($debits !== $credits) {
            self::fail(__('Debits (:debits) and credits (:credits) must be equal.', [
                'debits' => Money::format($debits),
                'credits' => Money::format($credits),
            ]));
        }

        $accountIds = array_unique(array_column($rows, 'account_id'));
        $active = ChartOfAccount::query()->whereKey($accountIds)->where('is_active', true)->count();

        if ($active !== count($accountIds)) {
            self::fail(__('Journal lines can only post to active accounts.'));
        }

        return DB::transaction(function () use ($date, $description, $rows, $reference) {
            $entry = new JournalEntry(['journal_date' => $date, 'description' => $description]);
            $entry->reference()->associate($reference);
            $entry->save();

            $entry->forceFill(['journal_number' => sprintf('JE-%s-%04d', $entry->journal_date->format('Y'), $entry->id)])->save();
            $entry->items()->createMany($rows);

            return $entry;
        });
    }

    private static function fail(string $message): never
    {
        throw ValidationException::withMessages(['lines' => $message]);
    }
}
