<?php

namespace App\Models;

use App\Support\Ledger;
use App\Support\LedgerAccounts;
use App\Support\Money;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * How an asset loses value over its useful life. The schedule is worked out from the cost, salvage value,
 * life and method; posting moves the depreciation accrued so far (and not yet posted) to the ledger.
 *
 * @property int $id
 * @property int $asset_id
 * @property string $method
 * @property int $useful_life_years
 * @property string $salvage_value
 * @property Carbon $start_date
 * @property string $posted_amount
 * @property Carbon|null $posted_through
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Asset $asset
 */
#[Fillable(['asset_id', 'method', 'useful_life_years', 'salvage_value', 'start_date'])]
class AssetDepreciation extends Model
{
    public const METHODS = ['straight_line', 'declining_balance', 'sum_of_years'];

    public const EXPENSE_ACCOUNT = '5430';

    public const ACCUMULATED_ACCOUNT = '1610';

    protected $attributes = ['salvage_value' => '0.00', 'posted_amount' => '0.00'];

    /**
     * @return BelongsTo<Asset, $this>
     */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    private function costCents(): int
    {
        return Money::toCents($this->asset->unit_price) * $this->asset->quantity;
    }

    /** What can be depreciated: cost less salvage value. */
    public function depreciableCents(): int
    {
        return max(0, $this->costCents() - Money::toCents($this->salvage_value));
    }

    /**
     * Depreciation for each year of the useful life, in cents; the last year takes any rounding remainder.
     * Declining balance is double-declining, never going below the salvage value.
     *
     * @return list<int>
     */
    public function yearlyAmounts(): array
    {
        $life = max(1, $this->useful_life_years);
        $base = $this->depreciableCents();
        $amounts = [];

        if ($this->method === 'declining_balance') {
            $book = $this->costCents();
            $floor = $this->costCents() - $base;

            for ($year = 1; $year <= $life; $year++) {
                $amount = $year === $life ? $book - $floor : min((int) round($book * 2 / $life), $book - $floor);
                $amounts[] = $amount;
                $book -= $amount;
            }

            return $amounts;
        }

        $digits = $life * ($life + 1) / 2;

        for ($year = 1; $year <= $life; $year++) {
            $amounts[] = $year === $life
                ? $base - array_sum($amounts)
                : (int) round($this->method === 'sum_of_years' ? $base * ($life - $year + 1) / $digits : $base / $life);
        }

        return $amounts;
    }

    /** Whole months of use from the start date up to the date. */
    private function monthsTo(CarbonInterface $date): int
    {
        return $date->isBefore($this->start_date) ? 0 : (int) floor($this->start_date->diffInMonths($date));
    }

    /** Depreciation accrued from the start date to the date: whole years, plus the months into the current one. */
    public function accumulatedAt(CarbonInterface $date): int
    {
        $amounts = $this->yearlyAmounts();
        $months = $this->monthsTo($date);
        $years = intdiv($months, 12);
        $accrued = array_sum(array_slice($amounts, 0, $years));

        if ($years < count($amounts)) {
            $accrued += (int) round($amounts[$years] * ($months % 12) / 12);
        }

        return min($accrued, $this->depreciableCents());
    }

    /** This year of the schedule's depreciation (zero once fully depreciated). */
    public function annualAt(CarbonInterface $date): int
    {
        return $this->yearlyAmounts()[intdiv($this->monthsTo($date), 12)] ?? 0;
    }

    /**
     * Figures for lists and the detail page, as of the date.
     *
     * @return array{cost: string, annual: string, accumulated: string, book_value: string, unposted: string, status: string}
     */
    public function figures(CarbonInterface $date): array
    {
        $accumulated = $this->accumulatedAt($date);

        return [
            'cost' => Money::format($this->costCents()),
            'annual' => Money::format($this->annualAt($date)),
            'accumulated' => Money::format($accumulated),
            'book_value' => Money::format($this->costCents() - $accumulated),
            'unposted' => Money::format($accumulated - Money::toCents($this->posted_amount)),
            'status' => $accumulated >= $this->depreciableCents() ? 'fully_depreciated' : 'depreciating',
        ];
    }

    /**
     * Post the depreciation accrued up to the date that hasn't been posted yet:
     * Dr Depreciation Expense / Cr Accumulated Depreciation.
     */
    public function postTo(CarbonInterface $date): int
    {
        $due = $this->accumulatedAt($date) - Money::toCents($this->posted_amount);

        if ($due <= 0) {
            throw ValidationException::withMessages(['status' => __('Nothing new to post: depreciation is posted up to date.')]);
        }

        DB::transaction(function () use ($date, $due) {
            $amount = Money::format($due);
            Ledger::post($date->toDateString(), __('Depreciation of :asset to :date', ['asset' => $this->asset->name, 'date' => $date->format('d M Y')]), [
                ['account_id' => LedgerAccounts::id(self::EXPENSE_ACCOUNT), 'debit' => $amount, 'description' => $this->asset->serial_code],
                ['account_id' => LedgerAccounts::id(self::ACCUMULATED_ACCOUNT), 'credit' => $amount, 'description' => $this->asset->serial_code],
            ], $this);

            $this->forceFill(['posted_amount' => Money::format(Money::toCents($this->posted_amount) + $due), 'posted_through' => $date->toDateString()])->save();
        });

        return $due;
    }

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'posted_through' => 'date:Y-m-d',
            'salvage_value' => 'decimal:2',
            'posted_amount' => 'decimal:2',
            'useful_life_years' => 'integer',
        ];
    }
}
