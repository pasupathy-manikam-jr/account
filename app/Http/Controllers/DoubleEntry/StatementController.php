<?php

namespace App\Http\Controllers\DoubleEntry;

use App\Http\Controllers\Controller;
use App\Models\ChartOfAccount;
use App\Models\JournalEntryItem;
use App\Models\YearEndClosing;
use App\Support\FinancialStatements;
use App\Support\Money;
use App\Support\Settings;
use App\Support\TableQuery;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Double Entry: the ledger itself and the statements built from it. Everything is read from journal lines;
 * the only write is the year-end close, which posts its own journal entry.
 */
class StatementController extends Controller
{
    public function ledgerSummary(Request $request): Response
    {
        $filters = $this->period($request);
        $query = $this->ledgerLines($request, $filters);
        TableQuery::search($query, $request, ['journal_number', 'journal_entries.description', 'journal_entry_items.description', 'account_name', 'account_code']);

        // select() replaces the line columns; adding sums to them breaks MySQL's only_full_group_by.
        $totals = (clone $query)->toBase()->reorder()->select(DB::raw('sum(debit_amount) as debit, sum(credit_amount) as credit'))->first();
        $lines = TableQuery::paginate($query, $request, [], ['journal_date', 'debit_amount', 'credit_amount'], 'journal_date');
        $lines->getCollection()->transform(fn (JournalEntryItem $line) => [...$line->toArray(), 'reference' => FinancialStatements::referenceLabel($line->getAttribute('reference_type'))]);

        return Inertia::render('double-entry/ledger-summary', [
            'lines' => $lines,
            'totals' => ['debit' => Money::format(Money::toCents($totals->debit ?? 0)), 'credit' => Money::format(Money::toCents($totals->credit ?? 0))],
            'accounts' => ChartOfAccount::query()->orderBy('account_code')->get(['id', 'account_code', 'account_name']),
            'filters' => [...TableQuery::filters($request, ['account_id']), ...$filters],
        ]);
    }

    public function trialBalance(Request $request): Response
    {
        $filters = $this->asOf($request);

        return Inertia::render('double-entry/trial-balance', [
            'report' => $this->money(FinancialStatements::trialBalance($filters['date_to'])),
            'filters' => $filters,
        ]);
    }

    public function profitLoss(Request $request): Response
    {
        $filters = $this->period($request);

        return Inertia::render('double-entry/profit-loss', [
            'report' => $this->money(FinancialStatements::profitAndLoss($filters['date_from'], $filters['date_to'])),
            'filters' => $filters,
        ]);
    }

    public function balanceSheet(Request $request): Response
    {
        $filters = $this->asOf($request);
        $compare = $request->validate(['compare_to' => ['nullable', 'date', 'before:'.$filters['date_to']]])['compare_to'] ?? null;

        return Inertia::render('double-entry/balance-sheet', [
            'report' => $this->money(FinancialStatements::balanceSheet($filters['date_to'])),
            'comparison' => $compare ? $this->money(FinancialStatements::balanceSheet($compare)) : null,
            'closings' => YearEndClosing::query()->with('closer:id,name')->latest('closing_date')->get(),
            'filters' => [...$filters, 'compare_to' => $compare],
        ]);
    }

    /** Close revenue and expenses up to a date into Retained Earnings. */
    public function yearEndClose(Request $request): RedirectResponse
    {
        $date = $request->validate(['closing_date' => ['required', 'date']])['closing_date'];
        $closing = YearEndClosing::close($date, $request->user());

        return $this->done(__('Books closed to :date. Net :result of :amount moved to Retained Earnings.', [
            'date' => Settings::date($closing->closing_date),
            'result' => Money::toCents($closing->net_profit) >= 0 ? __('profit') : __('loss'),
            'amount' => Settings::money(abs((float) $closing->net_profit)),
        ]));
    }

    /** One PDF route per statement: ledger-summary, trial-balance, profit-loss, balance-sheet. */
    public function pdf(Request $request, string $statement): HttpResponse
    {
        $data = match ($statement) {
            'trial-balance' => ['report' => $this->money(FinancialStatements::trialBalance(($f = $this->asOf($request))['date_to'])), 'filters' => $f],
            'profit-loss' => ['report' => $this->money(FinancialStatements::profitAndLoss(($f = $this->period($request))['date_from'], $f['date_to'])), 'filters' => $f],
            'balance-sheet' => ['report' => $this->money(FinancialStatements::balanceSheet(($f = $this->asOf($request))['date_to'])), 'filters' => $f],
            default => ['lines' => $this->ledgerLines($request, $f = $this->period($request))->orderBy('journal_date')->orderBy('journal_entries.id')->get()
                ->map(fn (JournalEntryItem $l) => [...$l->toArray(), 'reference' => FinancialStatements::referenceLabel($l->getAttribute('reference_type'))]), 'filters' => $f],
        };

        return Pdf::loadView('pdf.double-entry', [...$data, 'statement' => $statement])
            ->download("{$statement}-{$data['filters']['date_to']}.pdf");
    }

    /**
     * @param  array{date_from: string, date_to: string}  $filters
     * @return Builder<JournalEntryItem>
     */
    private function ledgerLines(Request $request, array $filters): Builder
    {
        return FinancialStatements::lines($filters['date_from'], $filters['date_to'])
            ->when($request->filled('account_id'), fn (Builder $q) => $q->where('account_id', $request->integer('account_id')));
    }

    /**
     * From / to dates, defaulting to the year so far.
     *
     * @return array{date_from: string, date_to: string}
     */
    private function period(Request $request): array
    {
        $data = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', ...($request->filled('date_from') ? ['after_or_equal:date_from'] : [])],
        ]);

        return ['date_from' => $data['date_from'] ?? today()->startOfYear()->toDateString(), 'date_to' => $data['date_to'] ?? today()->toDateString()];
    }

    /**
     * @return array{date_to: string}
     */
    private function asOf(Request $request): array
    {
        return ['date_to' => $request->validate(['date_to' => ['nullable', 'date']])['date_to'] ?? today()->toDateString()];
    }

    /**
     * Turn every int (cents) in a statement into a formatted amount, leaving labels alone.
     *
     * @param  array<array-key, mixed>  $data
     * @return array<array-key, mixed>
     */
    private function money(array $data): array
    {
        return array_map(fn ($value) => match (true) {
            is_array($value) => $this->money($value),
            is_int($value) => Money::format($value),
            default => $value,
        }, $data);
    }
}
