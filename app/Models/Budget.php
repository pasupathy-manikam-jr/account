<?php

namespace App\Models;

use App\Models\Concerns\HasBudgetWorkflow;
use App\Support\Money;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A spending plan for one period, split across expense accounts by its allocations.
 *
 * @property int $id
 * @property string $budget_name
 * @property int $budget_period_id
 * @property string $budget_type
 * @property string $status
 * @property int|null $approved_by
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read BudgetPeriod $period
 */
#[Fillable(['budget_name', 'budget_period_id', 'budget_type'])]
class Budget extends Model
{
    use HasBudgetWorkflow;

    public const TYPES = ['operational', 'capital', 'cash_flow'];

    protected $attributes = ['status' => 'draft'];

    /**
     * @return BelongsTo<BudgetPeriod, $this>
     */
    public function period(): BelongsTo
    {
        return $this->belongsTo(BudgetPeriod::class, 'budget_period_id');
    }

    /**
     * @return HasMany<BudgetAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(BudgetAllocation::class);
    }

    /**
     * What was actually spent on each account during the period, by month, from the posted journal lines:
     * [account_id => ['2026-05' => cents, ...]]. Expense accounts are debit-normal, so spend is debit − credit;
     * year-end closing entries are left out.
     *
     * ponytail: buckets lines in PHP (portable across MySQL/SQLite); move to a grouped query if the ledger gets large.
     *
     * @param  list<int>  $accountIds
     * @return array<int, array<string, int>>
     */
    public static function spentByMonth(array $accountIds, CarbonInterface $from, CarbonInterface $to): array
    {
        $spent = [];

        JournalEntryItem::query()
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_items.journal_entry_id')
            ->whereIn('account_id', $accountIds)
            ->whereDate('journal_date', '>=', $from)->whereDate('journal_date', '<=', $to)
            // A year-end close zeroes expense accounts; it isn't spending.
            ->where(fn ($q) => $q->whereNull('reference_type')->orWhere('reference_type', '!=', (new YearEndClosing)->getMorphClass()))
            ->get(['account_id', 'journal_date', 'debit_amount', 'credit_amount'])
            ->each(function (JournalEntryItem $line) use (&$spent) {
                $month = substr((string) $line->getAttribute('journal_date'), 0, 7);
                $spent[$line->account_id][$month] = ($spent[$line->account_id][$month] ?? 0)
                    + Money::toCents($line->debit_amount) - Money::toCents($line->credit_amount);
            });

        return $spent;
    }
}
