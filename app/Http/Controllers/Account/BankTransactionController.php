<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\JournalEntryItem;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The bank register: every journal line on a bank account's ledger account, newest first, with a running
 * balance. Nothing is stored twice; reconciling marks the journal line itself.
 */
class BankTransactionController extends Controller
{
    private const PER_PAGE = [10, 25, 50, 100];

    public function index(Request $request): Response
    {
        $banks = BankAccount::query()->orderBy('account_name')->get(['id', 'account_name', 'account_number', 'bank_name', 'gl_account_id', 'opening_balance']);
        $dates = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', ...($request->filled('date_from') ? ['after_or_equal:date_from'] : [])],
        ]);

        // Running balance per bank in date order, computed by the database across every line, not just this page.
        $lines = DB::table('journal_entry_items as i')
            ->join('journal_entries as e', 'e.id', '=', 'i.journal_entry_id')
            ->join('bank_accounts as b', 'b.gl_account_id', '=', 'i.account_id')
            ->join('chart_of_accounts as c', 'c.id', '=', 'i.account_id')
            ->select([
                'i.id', 'i.account_id', 'i.description', 'i.debit_amount', 'i.credit_amount', 'i.reconciled_at',
                'e.journal_number', 'e.journal_date', 'e.description as entry_description', 'e.reference_type',
                'b.id as bank_account_id',
                // On the account's normal side: debits raise a current account, credits raise a loan or credit line.
                DB::raw("b.opening_balance + SUM(CASE WHEN c.normal_balance = 'debit' THEN i.debit_amount - i.credit_amount ELSE i.credit_amount - i.debit_amount END) OVER (PARTITION BY i.account_id ORDER BY e.journal_date, i.id) as running_balance"),
            ]);

        $query = DB::query()->fromSub($lines, 't')
            ->when($request->filled('bank_account_id'), fn (Builder $q) => $q->where('bank_account_id', $request->integer('bank_account_id')))
            // The running balance is worked out over every line first, so a date range doesn't reset it.
            ->when($dates['date_from'] ?? null, fn (Builder $q, string $from) => $q->whereDate('journal_date', '>=', $from))
            ->when($dates['date_to'] ?? null, fn (Builder $q, string $to) => $q->whereDate('journal_date', '<=', $to))
            ->when($request->input('reconciled') === 'reconciled', fn (Builder $q) => $q->whereNotNull('reconciled_at'))
            ->when($request->input('reconciled') === 'unreconciled', fn (Builder $q) => $q->whereNull('reconciled_at'))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('journal_number', 'like', "%{$search}%")->orWhere('entry_description', 'like', "%{$search}%")->orWhere('description', 'like', "%{$search}%")));

        // Tabs use the bank statement's words, as the demo does: money in is a credit, money out a debit.
        $counts = (clone $query)->selectRaw('count(*) as total, sum(case when debit_amount > 0 then 1 else 0 end) as money_in, sum(case when credit_amount > 0 then 1 else 0 end) as money_out')->first();
        $query->when($request->input('type') === 'credit', fn (Builder $q) => $q->where('debit_amount', '>', 0))
            ->when($request->input('type') === 'debit', fn (Builder $q) => $q->where('credit_amount', '>', 0));

        $perPage = in_array($request->integer('per_page'), self::PER_PAGE, true) ? $request->integer('per_page') : self::PER_PAGE[0];
        $direction = $request->input('sort_direction') === 'asc' ? 'asc' : 'desc';

        return Inertia::render('account/bank-transactions/index', [
            'transactions' => $query->orderBy('journal_date', $direction)->orderBy('id', $direction)->paginate($perPage)->withQueryString(),
            'counts' => ['all' => (int) ($counts->total ?? 0), 'credit' => (int) ($counts->money_in ?? 0), 'debit' => (int) ($counts->money_out ?? 0)],
            'bankAccounts' => $banks->map(fn (BankAccount $b) => ['id' => $b->id, 'name' => $b->account_name, 'bank_name' => $b->bank_name, 'account_number' => $b->account_number]),
            'filters' => $request->only(['search', 'sort_direction', 'per_page', 'bank_account_id', 'reconciled', 'type', 'date_from', 'date_to']),
        ]);
    }

    /**
     * Mark a bank line as matched to the bank statement, or undo it.
     */
    public function reconcile(Request $request, JournalEntryItem $item): RedirectResponse
    {
        abort_unless(BankAccount::query()->where('gl_account_id', $item->account_id)->exists(), 404);

        $item->forceFill($item->reconciled_at
            ? ['reconciled_at' => null, 'reconciled_by' => null]
            : ['reconciled_at' => now(), 'reconciled_by' => $request->user()->id])->save();

        return $this->done($item->reconciled_at ? __('Transaction reconciled.') : __('Transaction marked as unreconciled.'));
    }
}
