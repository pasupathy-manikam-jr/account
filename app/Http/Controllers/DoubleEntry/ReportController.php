<?php

namespace App\Http\Controllers\DoubleEntry;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\Budget;
use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Support\FinancialStatements;
use App\Support\Money;
use App\Support\TableQuery;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Double Entry → Reports: general ledger, account statement, journal entries, cash flow and expenses.
 * All read from journal lines; amounts leave here formatted, never stored.
 */
class ReportController extends Controller
{
    public const REPORTS = ['general-ledger', 'account-statement', 'journal-entries', 'cash-flow', 'expense-report'];

    public function index(Request $request): Response
    {
        return Inertia::render('double-entry/reports', [
            ...$this->build($request, paginate: true),
            'accounts' => ChartOfAccount::query()->orderBy('account_code')->get(['id', 'account_code', 'account_name']),
        ]);
    }

    public function pdf(Request $request): HttpResponse
    {
        $data = $this->build($request, paginate: false);

        return Pdf::loadView('pdf.double-entry-reports', [...$data])
            ->setPaper('a4', 'landscape')
            ->download("{$data['report']}-{$data['filters']['date_to']}.pdf");
    }

    /**
     * @return array{report: string, filters: array<string, mixed>, data: mixed}
     */
    private function build(Request $request, bool $paginate): array
    {
        $report = in_array($request->input('report'), self::REPORTS, true) ? $request->input('report') : 'general-ledger';
        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', ...($request->filled('date_from') ? ['after_or_equal:date_from'] : [])],
            'account_id' => ['nullable', 'integer', 'exists:chart_of_accounts,id'],
        ]);
        $from = $validated['date_from'] ?? today()->startOfYear()->toDateString();
        $to = $validated['date_to'] ?? today()->toDateString();

        if ($report === 'expense-report') {
            // A column per month, so the expense report covers at most a year.
            $request->validate(['date_to' => ['nullable', 'before:'.Carbon::parse($from)->addYear()->toDateString()]]);
        }

        $accountId = $validated['account_id'] ?? null;

        if ($report === 'account-statement' && $accountId === null) {
            // The busiest cash or bank account.
            $accountId = ChartOfAccount::query()->whereKey($this->cashAccounts())->withCount('items')
                ->orderByDesc('items_count')->orderBy('account_code')->value('id');
        }

        $filters = array_filter(['report' => $report, 'date_from' => $from, 'date_to' => $to, 'account_id' => $accountId, 'search' => $request->input('search')], fn ($v) => $v !== null && $v !== '');

        $data = match ($report) {
            'general-ledger' => $this->ledger($from, $to, $accountId),
            'account-statement' => $this->ledger($from, $to, $accountId, keepEmpty: true)[0] ?? null,
            'journal-entries' => $this->journalEntries($request, $from, $to, $paginate),
            'cash-flow' => $this->cashFlow($from, $to),
            default => $this->expenses($from, $to),
        };

        return ['report' => $report, 'filters' => $filters, 'data' => $data];
    }

    /**
     * Per account: opening balance, each line with a running balance on its normal side, closing balance.
     *
     * @return list<array<string, mixed>>
     */
    private function ledger(string $from, string $to, ?int $accountId, bool $keepEmpty = false): array
    {
        $balances = FinancialStatements::balances($from, $to)
            ->when($accountId, fn ($rows) => $rows->where('id', $accountId))
            ->filter(fn (array $r) => $keepEmpty || $r['opening'] !== 0 || $r['debit'] !== 0 || $r['credit'] !== 0);
        $lines = FinancialStatements::lines($from, $to)
            ->whereIn('account_id', $balances->pluck('id'))
            ->orderBy('journal_date')->orderBy('journal_entries.id')->orderBy('journal_entry_items.id')
            ->get()->groupBy('account_id');

        return array_values($balances->map(function (array $account) use ($lines) {
            $running = $account['opening'];
            $sign = $account['normal'] === 'debit' ? 1 : -1;

            return [
                'id' => $account['id'],
                'code' => $account['code'],
                'name' => $account['name'],
                'normal' => $account['normal'],
                'opening' => Money::format($account['opening']),
                'lines' => $lines->get($account['id'], collect())->map(function (JournalEntryItem $line) use (&$running, $sign) {
                    $debit = Money::toCents($line->debit_amount);
                    $credit = Money::toCents($line->credit_amount);
                    $running += $sign * ($debit - $credit);

                    return [
                        'id' => $line->id,
                        'date' => substr((string) $line->getAttribute('journal_date'), 0, 10),
                        'number' => $line->getAttribute('journal_number'),
                        'reference' => FinancialStatements::referenceLabel($line->getAttribute('reference_type')),
                        'description' => $line->description ?? $line->getAttribute('entry_description'),
                        'debit' => Money::format($debit),
                        'credit' => Money::format($credit),
                        'balance' => Money::format($running),
                    ];
                })->values()->all(),
                'debit' => Money::format($account['debit']),
                'credit' => Money::format($account['credit']),
                'closing' => Money::format($account['closing']),
            ];
        })->all());
    }

    /**
     * Journal entries in the period with their lines; paginated on screen, all of them in the PDF.
     *
     * @return mixed
     */
    private function journalEntries(Request $request, string $from, string $to, bool $paginate)
    {
        $query = JournalEntry::query()
            ->with(['items' => fn ($q) => $q->with('account:id,account_code,account_name')->orderBy('id')])
            ->withSum('items as total', 'debit_amount')
            ->whereDate('journal_date', '>=', $from)->whereDate('journal_date', '<=', $to);
        TableQuery::search($query, $request, ['journal_number', 'description']);

        $shape = fn (JournalEntry $entry) => [
            'id' => $entry->id,
            'number' => $entry->journal_number,
            'date' => $entry->journal_date->toDateString(),
            'description' => $entry->description,
            'reference' => FinancialStatements::referenceLabel($entry->reference_type),
            'total' => Money::format(Money::toCents($entry->getAttribute('total') ?? 0)),
            'lines' => $entry->items->map(fn (JournalEntryItem $item) => [
                'id' => $item->id,
                'code' => $item->account->account_code,
                'name' => $item->account->account_name,
                'description' => $item->description,
                'debit' => $item->debit_amount,
                'credit' => $item->credit_amount,
            ])->all(),
        ];

        if (! $paginate) {
            return $query->orderBy('journal_date')->orderBy('id')->get()->map($shape)->all();
        }

        $entries = TableQuery::paginate($query, $request, [], ['journal_date', 'journal_number'], 'journal_date');
        $entries->setCollection($entries->getCollection()->map($shape));

        return $entries;
    }

    /**
     * Direct-method cash flow. For every entry touching a cash account, each non-cash line's
     * (credit − debit) is the cash it brought in or paid out, classified by that line's account.
     *
     * @return array<string, mixed>
     */
    private function cashFlow(string $from, string $to): array
    {
        $cash = $this->cashAccounts()->all();
        // Loans and credit lines held as bank accounts are borrowing, so financing.
        $borrowing = BankAccount::query()->whereNotIn('account_type', BankAccount::CASH_TYPES)->pluck('gl_account_id')->all();
        $entryIds = FinancialStatements::lines($from, $to)->whereIn('account_id', $cash)->pluck('journal_entry_id')->unique();

        $effects = JournalEntryItem::query()->whereIn('journal_entry_id', $entryIds)->whereNotIn('account_id', $cash)
            ->get(['account_id', 'debit_amount', 'credit_amount'])
            ->groupBy('account_id')
            ->map(fn ($items) => $items->sum(fn (JournalEntryItem $i) => Money::toCents($i->credit_amount) - Money::toCents($i->debit_amount)))
            ->filter();

        $accounts = ChartOfAccount::query()->with('accountType:id,code')->whereKey($effects->keys())->orderBy('account_code')->get();
        $sections = ['operating' => [], 'investing' => [], 'financing' => []];

        foreach ($accounts as $account) {
            $section = match (true) {
                $account->accountType->code === 'FA' => 'investing',
                in_array($account->accountType->code, ['LTL', 'SC', 'RE'], true), in_array($account->id, $borrowing, true) => 'financing',
                default => 'operating',
            };
            $sections[$section][] = ['code' => $account->account_code, 'name' => $account->account_name, 'amount' => $effects[$account->id]];
        }

        $balances = FinancialStatements::balances($from, $to)->whereIn('id', $cash);
        $net = (int) $effects->sum();

        return [
            'sections' => collect($sections)->map(fn (array $rows, string $key) => [
                'key' => $key,
                'rows' => array_map(fn (array $r) => [...$r, 'amount' => Money::format($r['amount'])], $rows),
                'inflow' => Money::format(array_sum(array_filter(array_column($rows, 'amount'), fn (int $a) => $a > 0))),
                'outflow' => Money::format(-array_sum(array_filter(array_column($rows, 'amount'), fn (int $a) => $a < 0))),
                'net' => Money::format(array_sum(array_column($rows, 'amount'))),
            ])->values()->all(),
            'opening' => Money::format($balances->sum('opening')),
            'net' => Money::format($net),
            'closing' => Money::format($balances->sum('closing')),
        ];
    }

    /**
     * Expense accounts by month, with row, column and grand totals.
     *
     * @return array<string, mixed>
     */
    private function expenses(string $from, string $to): array
    {
        $accounts = ChartOfAccount::query()->whereHas('accountType', fn (Builder $q) => $q->where('category', 'expenses'))
            ->orderBy('account_code')->get(['id', 'account_code', 'account_name']);
        $spent = Budget::spentByMonth(array_values($accounts->pluck('id')->all()), Carbon::parse($from), Carbon::parse($to));

        $months = [];

        for ($month = Carbon::parse($from)->startOfMonth(); $month->toDateString() <= $to; $month = $month->addMonth()) {
            $months[] = $month->format('Y-m');
        }

        $rows = $accounts->filter(fn (ChartOfAccount $a) => isset($spent[$a->id]))->map(fn (ChartOfAccount $a) => [
            'code' => $a->account_code,
            'name' => $a->account_name,
            'months' => array_map(fn (string $m) => $spent[$a->id][$m] ?? 0, $months),
            'total' => array_sum($spent[$a->id]),
        ])->values();
        $total = $rows->sum('total');
        $largest = $rows->sortByDesc('total')->first();

        return [
            'months' => $months,
            'rows' => $rows->map(fn (array $r) => [
                ...$r,
                'months' => array_map(Money::format(...), $r['months']),
                'total' => Money::format($r['total']),
                'share' => $total !== 0 ? round($r['total'] / $total * 100, 1) : 0,
            ])->all(),
            'month_totals' => array_map(fn (int $i) => Money::format($rows->sum(fn (array $r) => $r['months'][$i])), array_keys($months)),
            'total' => Money::format($total),
            'largest' => $largest ? ['name' => $largest['name'], 'amount' => Money::format($largest['total'])] : null,
            'average' => Money::format(count($months) ? intdiv($total, count($months)) : 0),
        ];
    }

    /**
     * GL accounts of the company's cash and bank accounts.
     *
     * @return Collection<int, int>
     */
    private function cashAccounts(): Collection
    {
        return ChartOfAccount::query()->whereIn('id', BankAccount::query()->whereIn('account_type', BankAccount::CASH_TYPES)->select('gl_account_id'))
            ->orderBy('account_code')->pluck('id');
    }
}
