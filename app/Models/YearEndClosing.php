<?php

namespace App\Models;

use App\Support\FinancialStatements;
use App\Support\Ledger;
use App\Support\LedgerAccounts;
use App\Support\Money;
use App\Support\Settings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A financial year closed into Retained Earnings: every revenue and expense account is brought back to zero
 * by one journal entry dated on the closing date, and the net profit (or loss) moves to equity.
 *
 * @property int $id
 * @property Carbon $closing_date
 * @property string $net_profit
 * @property int|null $journal_entry_id
 * @property int|null $closed_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User|null $closer
 */
class YearEndClosing extends Model
{
    /**
     * @return BelongsTo<User, $this>
     */
    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public static function close(string $date, User $by): self
    {
        $last = self::query()->max('closing_date');

        if (Carbon::parse($date)->isAfter(today())) {
            throw ValidationException::withMessages(['closing_date' => __('A year can only be closed once its last day has passed.')]);
        }

        if ($last !== null && $date <= substr((string) $last, 0, 10)) {
            throw ValidationException::withMessages(['closing_date' => __('The books are already closed up to :date.', ['date' => Settings::date($last)])]);
        }

        return DB::transaction(function () use ($date, $by) {
            $lines = [];
            $profit = 0;

            foreach (FinancialStatements::balances(null, $date) as $row) {
                if (! in_array($row['category'], ['revenue', 'expenses'], true) || $row['closing'] === 0) {
                    continue;
                }

                // Reverse the balance on its own side: revenue (credit-normal) is debited, expenses credited.
                $amount = Money::format(abs($row['closing']));
                $side = ($row['normal'] === 'credit') === ($row['closing'] > 0) ? 'debit' : 'credit';
                $lines[] = ['account_id' => $row['id'], $side => $amount, 'description' => __('Year-end close')];
                $earned = FinancialStatements::sectionAmount($row, $row['closing']);
                $profit += $row['category'] === 'revenue' ? $earned : -$earned;
            }

            if ($lines === []) {
                throw ValidationException::withMessages(['closing_date' => __('There is no profit or loss to close up to that date.')]);
            }

            if ($profit !== 0) {
                $lines[] = [
                    'account_id' => LedgerAccounts::id(LedgerAccounts::RETAINED_EARNINGS),
                    $profit > 0 ? 'credit' : 'debit' => Money::format(abs($profit)),
                    'description' => $profit > 0 ? __('Net profit for the year') : __('Net loss for the year'),
                ];
            }

            $closing = new self;
            $closing->forceFill(['closing_date' => $date, 'net_profit' => Money::format($profit), 'closed_by' => $by->id])->save();
            $entry = Ledger::post($date, __('Year-end close to :date', ['date' => Carbon::parse($date)->format('d M Y')]), $lines, $closing);
            $closing->forceFill(['journal_entry_id' => $entry->id])->save();

            return $closing;
        });
    }

    protected function casts(): array
    {
        return ['closing_date' => 'date:Y-m-d', 'net_profit' => 'decimal:2'];
    }
}
