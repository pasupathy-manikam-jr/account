<?php

namespace App\Support;

use App\Models\ChartOfAccount;
use App\Models\JournalEntryItem;
use App\Models\YearEndClosing;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Account balances and the statements built from them, all derived from journal lines plus opening balances.
 * Amounts are cents on each account's normal side (a positive asset is a debit, a positive liability a credit).
 *
 * Opening balances were keyed in per account and don't net to zero, so the difference is shown as
 * Opening Balance Equity, the usual home for it, to keep the trial balance and balance sheet in balance.
 */
class FinancialStatements
{
    public const CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];

    /**
     * Every account with its balance on $from (null = before any posting), its debits and credits in
     * [$from, $to], and its balance on $to. Year-end closing entries can be left out (for profit and loss).
     *
     * @return Collection<int, array{id: int, code: string, name: string, type: string, category: string, normal: string, opening: int, debit: int, credit: int, closing: int}>
     */
    public static function balances(?string $from, string $to, bool $withClosings = true): Collection
    {
        $sums = function (?string $after, ?string $before) use ($withClosings) {
            return JournalEntryItem::query()
                ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_items.journal_entry_id')
                ->when($after, fn (Builder $q) => $q->whereDate('journal_date', '>=', $after))
                ->when($before, fn (Builder $q) => $q->whereDate('journal_date', '<=', $before))
                ->when(! $withClosings, fn (Builder $q) => $q->where(fn (Builder $w) => $w
                    ->whereNull('reference_type')->orWhere('reference_type', '!=', (new YearEndClosing)->getMorphClass())))
                ->groupBy('account_id')
                ->selectRaw('account_id, sum(debit_amount) as debits, sum(credit_amount) as credits')
                ->get()->keyBy('account_id');
        };

        $before = $from === null ? collect() : $sums(null, Carbon::parse($from)->subDay()->toDateString());
        $during = $sums($from, $to);

        return ChartOfAccount::query()->with('accountType:id,name,category')->orderBy('account_code')->get()
            ->map(function (ChartOfAccount $account) use ($before, $during) {
                $sign = $account->normal_balance === 'debit' ? 1 : -1;
                $net = fn ($row) => $row === null ? 0 : $sign * (Money::toCents($row->getAttribute('debits')) - Money::toCents($row->getAttribute('credits')));
                $moved = $during->get($account->id);
                $opening = Money::toCents($account->opening_balance) + $net($before->get($account->id));

                return [
                    'id' => $account->id,
                    'code' => $account->account_code,
                    'name' => $account->account_name,
                    'type' => $account->accountType->name,
                    'category' => $account->accountType->category,
                    'normal' => $account->normal_balance,
                    'opening' => $opening,
                    'debit' => Money::toCents($moved?->getAttribute('debits') ?? 0),
                    'credit' => Money::toCents($moved?->getAttribute('credits') ?? 0),
                    'closing' => $opening + $net($moved),
                ];
            });
    }

    /**
     * Journal lines in [$from, $to] with their entry's number, date, description and reference, and their account.
     *
     * @return Builder<JournalEntryItem>
     */
    public static function lines(string $from, string $to): Builder
    {
        return JournalEntryItem::query()
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_items.journal_entry_id')
            ->join('chart_of_accounts', 'chart_of_accounts.id', '=', 'journal_entry_items.account_id')
            ->whereDate('journal_date', '>=', $from)
            ->whereDate('journal_date', '<=', $to)
            ->select([
                'journal_entry_items.id', 'journal_entry_items.journal_entry_id', 'account_id', 'journal_date', 'journal_number', 'reference_type', 'account_code', 'account_name',
                'debit_amount', 'credit_amount', 'journal_entries.description as entry_description', 'journal_entry_items.description',
            ]);
    }

    /** "App\Models\SalesInvoice" → "Sales Invoice". */
    public static function referenceLabel(?string $type): string
    {
        return $type === null ? __('Manual Entry') : __(Str::headline(class_basename($type)));
    }

    /**
     * A balance (on the account's normal side) restated on its statement section's side: assets and expenses
     * read as debits, liabilities, equity and revenue as credits. Contra accounts (accumulated depreciation,
     * sales returns) come out negative, so they reduce their section instead of adding to it.
     *
     * @param  array{category: string, normal: string}  $row
     */
    public static function sectionAmount(array $row, int $amount): int
    {
        $sectionSide = in_array($row['category'], ['assets', 'expenses'], true) ? 'debit' : 'credit';

        return $row['normal'] === $sectionSide ? $amount : -$amount;
    }

    /**
     * Opening balances on the debit side less those on the credit side. Shown as Opening Balance Equity
     * (a credit when positive) so debits equal credits.
     */
    public static function openingDifference(): int
    {
        return (int) ChartOfAccount::query()->get(['normal_balance', 'opening_balance'])
            ->sum(fn (ChartOfAccount $a) => ($a->normal_balance === 'debit' ? 1 : -1) * Money::toCents($a->opening_balance));
    }

    /**
     * Each account's balance on the date as a debit or credit amount, plus the opening-balance line.
     *
     * @return array{rows: list<array{code: string, name: string, debit: int, credit: int}>, debit: int, credit: int}
     */
    public static function trialBalance(string $asOf): array
    {
        $rows = [];

        foreach (self::balances(null, $asOf) as $row) {
            if ($row['closing'] !== 0) {
                $debit = ($row['normal'] === 'debit') === ($row['closing'] > 0);
                $rows[] = ['code' => $row['code'], 'name' => $row['name'], 'debit' => $debit ? abs($row['closing']) : 0, 'credit' => $debit ? 0 : abs($row['closing'])];
            }
        }

        if (($difference = self::openingDifference()) !== 0) {
            $rows[] = ['code' => '', 'name' => __('Opening Balance Equity'), 'debit' => max(0, -$difference), 'credit' => max(0, $difference)];
        }

        return ['rows' => $rows, 'debit' => array_sum(array_column($rows, 'debit')), 'credit' => array_sum(array_column($rows, 'credit'))];
    }

    /**
     * Revenue and expense movements in the period (year-end closing entries excluded).
     *
     * @return array{revenue: list<array{code: string, name: string, amount: int}>, expenses: list<array{code: string, name: string, amount: int}>, total_revenue: int, total_expenses: int, net: int}
     */
    public static function profitAndLoss(string $from, string $to): array
    {
        $lines = ['revenue' => [], 'expenses' => []];

        foreach (self::balances($from, $to, withClosings: false) as $row) {
            $amount = self::sectionAmount($row, $row['closing'] - $row['opening']);

            if (isset($lines[$row['category']]) && $amount !== 0) {
                $lines[$row['category']][] = ['code' => $row['code'], 'name' => $row['name'], 'amount' => $amount];
            }
        }

        $revenue = array_sum(array_column($lines['revenue'], 'amount'));
        $expenses = array_sum(array_column($lines['expenses'], 'amount'));

        return ['revenue' => $lines['revenue'], 'expenses' => $lines['expenses'], 'total_revenue' => $revenue, 'total_expenses' => $expenses, 'net' => $revenue - $expenses];
    }

    /**
     * Assets, liabilities and equity on the date, grouped by account type. Equity also carries profit not yet
     * closed into Retained Earnings and the opening-balance difference.
     *
     * @return array<string, mixed>
     */
    public static function balanceSheet(string $asOf): array
    {
        $balances = self::balances(null, $asOf);
        $sections = [];

        foreach (['assets', 'liabilities', 'equity'] as $category) {
            $sections[$category] = $balances->where('category', $category)->where('closing', '!=', 0)
                ->map(fn (array $r) => [...$r, 'amount' => self::sectionAmount($r, $r['closing'])])
                ->groupBy('type')
                ->map(fn (Collection $rows, string $type) => [
                    'type' => $type,
                    'rows' => $rows->map(fn (array $r) => ['code' => $r['code'], 'name' => $r['name'], 'amount' => $r['amount']])->values()->all(),
                    'total' => $rows->sum('amount'),
                ])->values()->all();
        }

        $section = fn (string $category) => $balances->where('category', $category)->sum(fn (array $r) => self::sectionAmount($r, $r['closing']));
        $earnings = $section('revenue') - $section('expenses');
        $extra = array_values(array_filter([
            $earnings !== 0 ? ['code' => '', 'name' => __('Current Year Earnings'), 'amount' => $earnings] : null,
            ($difference = self::openingDifference()) !== 0 ? ['code' => '', 'name' => __('Opening Balance Equity'), 'amount' => $difference] : null,
        ]));

        if ($extra !== []) {
            $sections['equity'][] = ['type' => __('Earnings & Adjustments'), 'rows' => $extra, 'total' => array_sum(array_column($extra, 'amount'))];
        }

        $totals = array_map(fn (array $groups) => array_sum(array_column($groups, 'total')), $sections);

        return [...$sections, 'total_assets' => $totals['assets'], 'total_liabilities' => $totals['liabilities'], 'total_equity' => $totals['equity']];
    }
}
