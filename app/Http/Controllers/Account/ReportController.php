<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\CreditNote;
use App\Models\DebitNote;
use App\Models\JournalEntryItem;
use App\Models\Payment;
use App\Models\PurchaseInvoice;
use App\Models\SalesInvoice;
use App\Models\User;
use App\Support\LedgerAccounts;
use App\Support\Money;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Accounting → Reports: invoice/bill aging, tax summary and customer/vendor balances, read from the documents.
 * Customer and vendor reports mirror each other through Payment::KINDS.
 */
class ReportController extends Controller
{
    public const REPORTS = ['invoice-aging', 'bill-aging', 'tax-summary', 'customer-balance', 'vendor-balance'];

    /** Aging columns: days past due, inclusive upper bound (null = no limit). "Current" is not yet due. */
    private const BUCKETS = ['current' => 0, '1_30' => 30, '31_60' => 60, '61_90' => 90, 'over_90' => null];

    private const POSTED_INVOICE = ['posted', 'partial', 'paid'];

    private const POSTED_NOTE = ['approved', 'partial', 'applied'];

    public function index(Request $request): Response
    {
        return Inertia::render('account/reports/index', $this->build($request));
    }

    public function pdf(Request $request): HttpResponse
    {
        $data = $this->build($request);

        return Pdf::loadView('pdf.report', [...$data])
            ->setPaper('a4', $data['report'] === 'tax-summary' ? 'portrait' : 'landscape')
            ->download("{$data['report']}-".($data['filters']['as_of'] ?? $data['filters']['date_to']).'.pdf');
    }

    /**
     * Customer or vendor detail: their Receivable (or Payable) ledger lines in the period with a running balance,
     * read from the journal entries of their invoices, notes and payments (retainer settlements included).
     */
    public function statement(Request $request, User $party): Response
    {
        return Inertia::render('account/reports/statement', $this->statementData($request, $party));
    }

    public function statementPdf(Request $request, User $party): HttpResponse
    {
        $data = $this->statementData($request, $party, 'print');

        return Pdf::loadView('pdf.statement', [...$data])
            ->download('statement-'.str($party->name)->slug().'.pdf');
    }

    /**
     * @return array<string, mixed>
     */
    private function statementData(Request $request, User $party, string $ability = 'view'): array
    {
        $kind = match ($party->type) {
            'client' => 'customer',
            'vendor' => 'vendor',
            default => abort(404),
        };
        abort_unless($request->user()?->can("{$ability}-{$kind}-detail-report"), 403);

        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);
        $from = $validated['date_from'] ?? today()->startOfYear()->toDateString();
        $to = $validated['date_to'] ?? today()->toDateString();

        $config = Payment::KINDS[$kind];
        $documents = [
            $config['invoice'] => $config['invoice']::query()->where($config['party_column'], $party->id)->pluck('id'),
            $config['note'] => $config['note']::query()->where($config['party_column'], $party->id)->pluck('id'),
            Payment::class => Payment::query()->where('kind', $kind)->where('party_id', $party->id)->pluck('id'),
        ];
        // Receivable grows with debits, Payable with credits.
        $sign = $kind === 'customer' ? 1 : -1;

        $lines = JournalEntryItem::query()
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_items.journal_entry_id')
            ->where('account_id', LedgerAccounts::id($kind === 'customer' ? LedgerAccounts::ACCOUNTS_RECEIVABLE : LedgerAccounts::ACCOUNTS_PAYABLE))
            ->where(function ($q) use ($documents) {
                foreach ($documents as $model => $ids) {
                    $q->orWhere(fn ($w) => $w->where('reference_type', (new $model)->getMorphClass())->whereIn('reference_id', $ids));
                }
            })
            ->whereDate('journal_date', '<=', $to)
            ->orderBy('journal_date')->orderBy('journal_entries.id')
            ->get(['journal_entry_items.id', 'journal_date', 'journal_number', 'journal_entries.description', 'debit_amount', 'credit_amount']);

        $opening = 0;
        $balance = 0;
        $rows = [];

        foreach ($lines as $line) {
            $debit = Money::toCents($line->getAttribute('debit_amount'));
            $credit = Money::toCents($line->getAttribute('credit_amount'));
            $balance += $sign * ($debit - $credit);

            if ($line->getAttribute('journal_date') < $from) {
                $opening = $balance;

                continue;
            }

            $rows[] = [
                'id' => $line->id,
                'date' => $line->getAttribute('journal_date'),
                'number' => $line->getAttribute('journal_number'),
                'description' => $line->getAttribute('description'),
                'debit' => Money::format($debit),
                'credit' => Money::format($credit),
                'balance' => Money::format($balance),
            ];
        }

        return [
            'kind' => $kind,
            'party' => $party->only('id', 'name', 'email'),
            'filters' => ['date_from' => $from, 'date_to' => $to],
            'opening' => Money::format($opening),
            'closing' => Money::format($balance),
            'debits' => Money::format(collect($rows)->sum(fn (array $r) => Money::toCents($r['debit']))),
            'credits' => Money::format(collect($rows)->sum(fn (array $r) => Money::toCents($r['credit']))),
            'rows' => $rows,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function build(Request $request): array
    {
        $validated = $request->validate([
            'report' => ['nullable', 'in:'.implode(',', self::REPORTS)],
            'as_of' => ['nullable', 'date'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'zero' => ['nullable', 'boolean'],
        ]);

        $report = $validated['report'] ?? 'invoice-aging';
        $asOf = $validated['as_of'] ?? today()->toDateString();
        $from = $validated['date_from'] ?? today()->startOfYear()->toDateString();
        $to = $validated['date_to'] ?? today()->endOfYear()->toDateString();
        $zero = (bool) ($validated['zero'] ?? false);

        $filters = match (true) {
            $report === 'tax-summary' => ['date_from' => $from, 'date_to' => $to],
            str_ends_with($report, 'balance') => ['as_of' => $asOf, 'zero' => $zero],
            default => ['as_of' => $asOf],
        };

        $data = match ($report) {
            'invoice-aging' => $this->aging('customer', $asOf),
            'bill-aging' => $this->aging('vendor', $asOf),
            'customer-balance' => $this->balances('customer', $asOf, $zero),
            'vendor-balance' => $this->balances('vendor', $asOf, $zero),
            default => $this->taxSummary($from, $to),
        };

        return ['report' => $report, 'filters' => $filters, 'data' => $data];
    }

    /**
     * Unpaid posted invoices (or bills) per party, bucketed by days past due as of the date.
     *
     * @return array{rows: list<array<string, mixed>>, totals: array<string, string>}
     */
    private function aging(string $kind, string $asOf): array
    {
        $config = Payment::KINDS[$kind];
        /** @var class-string<SalesInvoice|PurchaseInvoice> $invoice */
        $invoice = $config['invoice'];
        $date = Carbon::parse($asOf);

        $rows = $invoice::query()
            ->whereIn('status', ['posted', 'partial'])
            ->whereDate('invoice_date', '<=', $asOf)
            ->get(['id', $config['party_column'], 'due_date', 'total_amount', 'paid_amount'])
            ->groupBy($config['party_column'])
            ->map(function (Collection $invoices, int $partyId) use ($date) {
                $cents = array_fill_keys(array_keys(self::BUCKETS), 0);

                foreach ($invoices as $row) {
                    $late = (int) $row->due_date->diffInDays($date, false);
                    $bucket = collect(self::BUCKETS)->search(fn (?int $max) => $max === null || $late <= $max);
                    $cents[$bucket] += Money::toCents($row->total_amount) - Money::toCents($row->paid_amount);
                }

                return ['party_id' => $partyId, ...$cents, 'total' => array_sum($cents)];
            })
            ->filter(fn (array $row) => $row['total'] !== 0);

        return $this->withParties($rows->all(), [...array_keys(self::BUCKETS), 'total']);
    }

    /**
     * Invoiced, returned/credited and paid per party up to the date. Paid is cash only: an invoice's paid amount
     * also counts the notes applied to it, which already sit in the notes column.
     *
     * @return array{rows: list<array<string, mixed>>, totals: array<string, string>}
     */
    private function balances(string $kind, string $asOf, bool $zero): array
    {
        $config = Payment::KINDS[$kind];
        /** @var class-string<SalesInvoice|PurchaseInvoice> $invoice */
        $invoice = $config['invoice'];
        /** @var class-string<CreditNote|DebitNote> $note */
        $note = $config['note'];
        $party = $config['party_column'];
        $noteDate = $kind === 'customer' ? 'credit_note_date' : 'debit_note_date';

        $invoices = $invoice::query()->whereIn('status', self::POSTED_INVOICE)->whereDate('invoice_date', '<=', $asOf)
            ->selectRaw("{$party} as party_id, sum(total_amount) as invoiced, sum(paid_amount) as settled")->groupBy($party)->get()->keyBy('party_id');
        $notes = $note::query()->whereIn('status', self::POSTED_NOTE)->whereDate($noteDate, '<=', $asOf)
            ->selectRaw("{$party} as party_id, sum(total_amount) as noted, sum(applied_amount) as applied")->groupBy($party)->get()->keyBy('party_id');

        $parties = User::query()->where('type', $config['party_type'])->when(! $zero, fn ($q) => $q->whereIn('id', $invoices->keys()->merge($notes->keys())))->pluck('id');

        $rows = $parties->map(function (int $id) use ($invoices, $notes) {
            $i = $invoices->get($id);
            $n = $notes->get($id);
            $invoiced = Money::toCents($i?->getAttribute('invoiced') ?? 0);
            $noted = Money::toCents($n?->getAttribute('noted') ?? 0);
            $paid = Money::toCents($i?->getAttribute('settled') ?? 0) - Money::toCents($n?->getAttribute('applied') ?? 0);

            return ['party_id' => $id, 'invoiced' => $invoiced, 'notes' => $noted, 'paid' => $paid, 'balance' => $invoiced - $noted - $paid];
        })->filter(fn (array $row) => $zero || $row['balance'] !== 0);

        return $this->withParties($rows->all(), ['invoiced', 'notes', 'paid', 'balance']);
    }

    /**
     * Tax on posted sales (collected) and purchases (paid) in the period, net of credit and debit notes,
     * per tax. A line with several taxes splits its tax amount by rate.
     *
     * @return array{collected: list<array{name: string, amount: string}>, paid: list<array{name: string, amount: string}>, total_collected: string, total_paid: string, net: string}
     */
    private function taxSummary(string $from, string $to): array
    {
        $collected = $this->taxByName([
            [SalesInvoice::class, 'invoice_date', self::POSTED_INVOICE, 1],
            [CreditNote::class, 'credit_note_date', self::POSTED_NOTE, -1],
        ], $from, $to);
        $paid = $this->taxByName([
            [PurchaseInvoice::class, 'invoice_date', self::POSTED_INVOICE, 1],
            [DebitNote::class, 'debit_note_date', self::POSTED_NOTE, -1],
        ], $from, $to);

        $format = fn (array $taxes) => array_map(fn (string $name, int $cents) => ['name' => $name, 'amount' => Money::format($cents)], array_keys($taxes), $taxes);

        return [
            'collected' => $format($collected),
            'paid' => $format($paid),
            'total_collected' => Money::format(array_sum($collected)),
            'total_paid' => Money::format(array_sum($paid)),
            'net' => Money::format(array_sum($collected) - array_sum($paid)),
        ];
    }

    /**
     * @param  list<array{class-string<SalesInvoice|CreditNote|PurchaseInvoice|DebitNote>, string, list<string>, int}>  $sources  [document model, date column, statuses, sign]
     * @return array<string, int> cents per "Tax (rate%)"
     */
    private function taxByName(array $sources, string $from, string $to): array
    {
        $totals = [];

        foreach ($sources as [$model, $dateColumn, $statuses, $sign]) {
            $documents = $model::query()->whereIn('status', $statuses)->whereDate($dateColumn, '>=', $from)->whereDate($dateColumn, '<=', $to)
                ->with('items:id,'.(new $model)->items()->getForeignKeyName().',taxes,tax_amount')->get();
            $lines = $documents->flatMap(fn (SalesInvoice|CreditNote|PurchaseInvoice|DebitNote $doc) => $doc->items);

            foreach ($lines as $line) {
                /** @var list<array{name: string, rate: string}> $taxes */
                $taxes = $line->getAttribute('taxes') ?? [];
                $rateSum = array_sum(array_map(fn (array $tax) => (float) $tax['rate'], $taxes));
                $remaining = Money::toCents($line->getAttribute('tax_amount'));

                foreach ($taxes as $index => $tax) {
                    // The last tax takes the rounding remainder so the split adds back up to the line.
                    $share = $index === array_key_last($taxes) || $rateSum == 0 ? $remaining : (int) round(Money::toCents($line->getAttribute('tax_amount')) * (float) $tax['rate'] / $rateSum);
                    $remaining -= $share;
                    $name = sprintf('%s (%s%%)', $tax['name'], $tax['rate']);
                    $totals[$name] = ($totals[$name] ?? 0) + $sign * $share;
                }
            }
        }

        ksort($totals);

        return $totals;
    }

    /**
     * Attach each party's name and email, then format the cent columns and their totals.
     *
     * @param  array<array-key, array<array-key, int>>  $rows
     * @param  list<string>  $columns
     * @return array{rows: list<array<string, mixed>>, totals: array<string, string>}
     */
    private function withParties(array $rows, array $columns): array
    {
        $rows = collect($rows);
        $users = User::query()->whereIn('id', $rows->pluck('party_id'))->get(['id', 'name', 'email'])->keyBy('id');

        return [
            'rows' => array_values($rows->map(fn (array $row) => [
                'party_id' => $row['party_id'],
                'name' => $users[$row['party_id']]->name ?? '-',
                'email' => $users[$row['party_id']]->email ?? '',
                ...collect($columns)->mapWithKeys(fn (string $c) => [$c => Money::format($row[$c])]),
            ])->sortBy('name')->all()),
            'totals' => collect($columns)->mapWithKeys(fn (string $c) => [$c => Money::format($rows->sum($c))])->all(),
        ];
    }
}
