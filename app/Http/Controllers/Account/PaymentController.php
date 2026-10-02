<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\Payment;
use App\Models\User;
use App\Support\Money;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Customer payments and vendor payments (Accounting menu). The route's `kind` default says which.
 */
class PaymentController extends Controller
{
    public function index(Request $request): Response
    {
        $kind = $this->kind($request);

        $query = Payment::query()->where('kind', $kind)->visibleTo($request->user(), $kind)
            ->with(['party:id,name,email', 'bankAccount:id,account_name,bank_name', 'allocations.invoice'])
            ->when($request->filled('party_id'), fn (Builder $q) => $q->where('party_id', $request->integer('party_id')))
            ->when($request->filled('bank_account_id'), fn (Builder $q) => $q->where('bank_account_id', $request->integer('bank_account_id')))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('payment_number', 'like', "%{$search}%")->orWhere('reference_number', 'like', "%{$search}%")
                ->orWhereHas('party', fn (Builder $p) => $p->where('name', 'like', "%{$search}%"))));

        TableQuery::month($query, $request, 'payment_date');
        $counts = TableQuery::countBy($query, 'status');
        $query->when(in_array($request->input('status'), Payment::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')));

        return Inertia::render('account/payments/index', [
            'kind' => $kind,
            'payments' => TableQuery::paginate($query, $request, [], ['payment_number', 'payment_date', 'payment_amount'], 'payment_date'),
            'counts' => ['all' => $counts->sum(), ...collect(Payment::STATUSES)->mapWithKeys(fn ($s) => [$s => $counts[$s] ?? 0])],
            'parties' => User::query()->where('type', Payment::KINDS[$kind]['party_type'])->orderBy('name')->get(['id', 'name']),
            'bankAccounts' => BankAccount::query()->orderBy('account_name')->get(['id', 'account_name as name']),
            'filters' => TableQuery::filters($request, ['status', 'month', 'party_id', 'bank_account_id']),
        ]);
    }

    public function create(Request $request): Response
    {
        $kind = $this->kind($request);
        $config = Payment::KINDS[$kind];

        // Open documents with money still owed, and notes with credit left, grouped by the party they belong to.
        $partyRelation = $kind === 'customer' ? 'customer' : 'vendor';
        $noteNumber = $kind === 'customer' ? 'credit_note_number' : 'debit_note_number';

        $invoices = $config['invoice']::query()->whereIn('status', ['posted', 'partial'])
            ->with("{$partyRelation}:id,name,email")
            ->orderBy('due_date')->get()
            ->filter(fn (Model $i) => Money::toCents((string) $i->getAttribute('balance_amount')) > 0)
            ->map(fn (Model $i) => [
                'id' => $i->getKey(),
                'number' => $i->getAttribute('invoice_number'),
                'party_id' => $i->getAttribute($config['party_column']),
                'party' => $i->getRelation($partyRelation)?->only(['id', 'name', 'email']),
                'due_date' => $i->getAttribute('due_date')?->format('Y-m-d'),
                'total_amount' => $i->getAttribute('total_amount'),
                'balance_amount' => $i->getAttribute('balance_amount'),
            ])->values();

        $notes = $config['note']::query()->whereIn('status', ['approved', 'partial'])->get()
            ->filter(fn (Model $n) => Money::toCents((string) $n->getAttribute('balance_amount')) > 0)
            ->map(fn (Model $n) => [
                'id' => $n->getKey(),
                'number' => $n->getAttribute($noteNumber),
                'party_id' => $n->getAttribute($config['party_column']),
                'balance_amount' => $n->getAttribute('balance_amount'),
            ])->values();

        return Inertia::render('account/payments/form', [
            'kind' => $kind,
            'invoices' => $invoices,
            'notes' => $notes,
            'bankAccounts' => BankAccount::query()->where('is_active', true)->whereIn('account_type', BankAccount::CASH_TYPES)
                ->orderBy('account_name')->get(['id', 'account_name', 'bank_name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $kind = $this->kind($request);
        $config = Payment::KINDS[$kind];
        $invoiceTable = (new $config['invoice'])->getTable();
        $noteTable = (new $config['note'])->getTable();
        $partyId = $request->integer('party_id');

        $data = $request->validate([
            'payment_date' => ['required', 'date'],
            'party_id' => ['required', Rule::exists('users', 'id')->where('type', $config['party_type'])],
            'bank_account_id' => ['required', Rule::exists('bank_accounts', 'id')->where('is_active', true)->whereIn('account_type', BankAccount::CASH_TYPES)],
            'payment_amount' => ['required', 'numeric', 'min:0', 'max:9999999999.99', 'decimal:0,2'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'allocations' => ['required', 'array', 'min:1', 'max:50'],
            'allocations.*.invoice_id' => ['required', 'distinct', Rule::exists($invoiceTable, 'id')->where($config['party_column'], $partyId)->whereIn('status', ['posted', 'partial'])],
            'allocations.*.amount' => ['required', 'numeric', 'gt:0', 'decimal:0,2'],
            'applications' => ['array', 'max:20'],
            'applications.*.note_id' => ['required', 'distinct', Rule::exists($noteTable, 'id')->where($config['party_column'], $partyId)->whereIn('status', ['approved', 'partial'])],
            'applications.*.amount' => ['required', 'numeric', 'gt:0', 'decimal:0,2'],
        ], [], [
            'party_id' => $kind === 'customer' ? __('customer') : __('vendor'),
            'allocations.*.invoice_id' => __('invoice'),
            'allocations.*.amount' => __('amount'),
            'applications.*.note_id' => $kind === 'customer' ? __('credit note') : __('debit note'),
            'applications.*.amount' => __('amount'),
        ]);
        $applications = $data['applications'] ?? [];

        // What is allocated must be exactly the cash plus the notes, and fit each document's balance.
        validator($data)->after(function (Validator $validator) use ($data, $applications, $config) {
            $cents = fn (array $rows) => array_sum(array_map(fn ($r) => Money::toCents($r['amount']), $rows));

            if ($cents($data['allocations']) !== Money::toCents($data['payment_amount']) + $cents($applications)) {
                $validator->errors()->add('allocations', __('The amounts allocated to invoices must equal the payment plus any notes applied.'));
            }

            foreach ($data['allocations'] as $i => $row) {
                $invoice = $config['invoice']::query()->whereKey($row['invoice_id'])->first();

                if ($invoice && Money::toCents($row['amount']) > Money::toCents((string) $invoice->balance_amount)) {
                    $validator->errors()->add("allocations.{$i}.amount", __('Only :balance is left to pay on this invoice.', ['balance' => $invoice->balance_amount]));
                }
            }

            foreach ($applications as $i => $row) {
                $note = $config['note']::query()->whereKey($row['note_id'])->first();

                if ($note && Money::toCents($row['amount']) > Money::toCents((string) $note->balance_amount)) {
                    $validator->errors()->add("applications.{$i}.amount", __('Only :balance of credit is left on this note.', ['balance' => $note->balance_amount]));
                }
            }
        })->validate();

        $payment = DB::transaction(function () use ($data, $applications, $kind, $config, $request) {
            $payment = new Payment([
                'payment_date' => $data['payment_date'],
                'party_id' => $data['party_id'],
                'bank_account_id' => $data['bank_account_id'],
                'payment_amount' => $data['payment_amount'],
                'reference_number' => $data['reference_number'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);
            $payment->forceFill(['kind' => $kind, 'created_by' => $request->user()->id])->save();
            $payment->allocations()->createMany(array_map(fn ($r) => [
                'invoice_type' => (new $config['invoice'])->getMorphClass(), 'invoice_id' => $r['invoice_id'], 'allocated_amount' => $r['amount'],
            ], $data['allocations']));
            $payment->noteApplications()->createMany(array_map(fn ($r) => [
                'note_type' => (new $config['note'])->getMorphClass(), 'note_id' => $r['note_id'], 'applied_amount' => $r['amount'],
            ], $applications));
            $payment->assignNumber();

            return $payment;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Payment recorded. Clear it once the money has moved.')]);

        return to_route("account.{$config['permission']}.show", $payment);
    }

    public function show(Request $request, Payment $payment): Response
    {
        abort_unless($payment->kind === $this->kind($request) && $payment->isVisibleTo($request->user()), 404);

        return Inertia::render('account/payments/show', [
            'kind' => $payment->kind,
            'payment' => $payment->load(['party:id,name,email', 'bankAccount:id,account_name,bank_name,account_number', 'allocations.invoice', 'noteApplications.note']),
        ]);
    }

    public function destroy(Request $request, Payment $payment): RedirectResponse
    {
        abort_unless($payment->kind === $this->kind($request), 404);

        if ($payment->status !== 'pending') {
            return $this->toast('error', __('Only pending payments can be deleted.'));
        }

        $payment->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => __('Payment deleted successfully.')]);

        return to_route('account.'.Payment::KINDS[$payment->kind]['permission'].'.index');
    }

    public function clear(Request $request, Payment $payment): RedirectResponse
    {
        abort_unless($payment->kind === $this->kind($request), 404);
        $payment->clear();

        return $this->done(__('Payment cleared and posted to the ledger.'));
    }

    public function cancel(Request $request, Payment $payment): RedirectResponse
    {
        abort_unless($payment->kind === $this->kind($request), 404);
        $payment->cancel();

        return $this->done(__('Payment cancelled.'));
    }

    private function kind(Request $request): string
    {
        return (string) $request->route()?->defaults['kind'];
    }
}
