<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\Retainer;
use App\Models\RetainerPayment;
use App\Support\Money;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Inertia\Inertia;
use Inertia\Response;

class RetainerPaymentController extends Controller
{
    public function index(Request $request): Response
    {
        $query = RetainerPayment::query()
            ->visibleTo($request->user())
            ->with(['customer:id,name,email', 'bankAccount:id,account_name,bank_name', 'allocations.retainer:id,retainer_number'])
            ->when($request->filled('customer_id'), fn (Builder $q) => $q->where('customer_id', $request->integer('customer_id')))
            ->when($request->filled('bank_account_id'), fn (Builder $q) => $q->where('bank_account_id', $request->integer('bank_account_id')))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('payment_number', 'like', "%{$search}%")
                ->orWhere('reference_number', 'like', "%{$search}%")
                ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'like', "%{$search}%"))));

        TableQuery::month($query, $request, 'payment_date');
        $counts = TableQuery::countBy($query, 'status');
        $query->when(in_array($request->input('status'), RetainerPayment::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')));

        return Inertia::render('retainer-payments/index', [
            'payments' => TableQuery::paginate($query, $request, [], ['payment_number', 'payment_date', 'payment_amount'], 'payment_date'),
            'counts' => ['all' => $counts->sum(), ...collect(RetainerPayment::STATUSES)->mapWithKeys(fn ($s) => [$s => $counts[$s] ?? 0])],
            'customers' => SalesInvoiceController::customers(),
            'bankAccounts' => BankAccount::query()->orderBy('account_name')->get(['id', 'account_name as name']),
            'filters' => TableQuery::filters($request, ['status', 'month', 'customer_id', 'bank_account_id']),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('retainer-payments/form', [
            // Customers with retainers that can still take a deposit, with what each still owes.
            'retainers' => Retainer::query()->whereIn('status', Retainer::PAYABLE)->whereNull('invoice_id')
                ->with('customer:id,name,email')->orderBy('retainer_date')
                ->get(['id', 'retainer_number', 'retainer_date', 'customer_id', 'total_amount', 'paid_amount', 'status', 'due_date'])
                ->filter(fn (Retainer $r) => Money::toCents((string) $r->balance_amount) > 0)->values(),
            'bankAccounts' => BankAccount::query()->where('is_active', true)->whereIn('account_type', BankAccount::CASH_TYPES)
                ->orderBy('account_name')->get(['id', 'account_name', 'bank_name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $customerId = $request->integer('customer_id');

        $data = $request->validate([
            'payment_date' => ['required', 'date'],
            'customer_id' => ['required', Rule::exists('users', 'id')->where('type', 'client')],
            'bank_account_id' => ['required', Rule::exists('bank_accounts', 'id')->where('is_active', true)->whereIn('account_type', BankAccount::CASH_TYPES)],
            'payment_amount' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'allocations' => ['required', 'array', 'min:1', 'max:50'],
            'allocations.*.retainer_id' => ['required', 'distinct', Rule::exists('retainers', 'id')
                ->where('customer_id', $customerId)->whereIn('status', Retainer::PAYABLE)->whereNull('invoice_id')],
            'allocations.*.allocated_amount' => ['required', 'numeric', 'gt:0', 'decimal:0,2'],
        ], [], [
            'allocations.*.retainer_id' => __('retainer'),
            'allocations.*.allocated_amount' => __('amount'),
        ]);

        // Allocations must use the whole payment and fit each retainer's balance.
        validator($data)->after(function (Validator $validator) use ($data) {
            $allocated = array_sum(array_map(fn ($a) => Money::toCents($a['allocated_amount']), $data['allocations']));

            if ($allocated !== Money::toCents($data['payment_amount'])) {
                $validator->errors()->add('allocations', __('The allocations (:allocated) must add up to the payment amount.', ['allocated' => Money::format($allocated)]));
            }

            foreach ($data['allocations'] as $i => $allocation) {
                $retainer = Retainer::query()->whereKey($allocation['retainer_id'])->first();

                if ($retainer && Money::toCents($allocation['allocated_amount']) > Money::toCents((string) $retainer->balance_amount)) {
                    $validator->errors()->add("allocations.{$i}.allocated_amount", __('Only :balance is left to pay on this retainer.', ['balance' => $retainer->balance_amount]));
                }
            }
        })->validate();

        $payment = DB::transaction(function () use ($data, $request) {
            $payment = new RetainerPayment;
            $allocations = $data['allocations'];
            unset($data['allocations']);
            $payment->fill($data)->forceFill(['created_by' => $request->user()->id])->save();
            $payment->allocations()->createMany($allocations);
            $payment->forceFill(['payment_number' => sprintf('RP-%s-%03d', $payment->payment_date->format('Y-m'), $payment->id)])->save();

            return $payment;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Retainer payment recorded. Clear it once the money is in the bank.')]);

        return to_route('retainer-payments.show', $payment);
    }

    public function show(Request $request, RetainerPayment $retainerPayment): Response
    {
        abort_unless($retainerPayment->isVisibleTo($request->user()), 404);

        return Inertia::render('retainer-payments/show', [
            'payment' => $retainerPayment->load([
                'customer:id,name,email',
                'bankAccount:id,account_name,bank_name,account_number',
                'allocations.retainer:id,retainer_number,retainer_date,total_amount,paid_amount,status,due_date',
            ]),
        ]);
    }

    public function destroy(RetainerPayment $retainerPayment): RedirectResponse
    {
        if ($retainerPayment->status !== 'pending') {
            return $this->toast('error', __('Only pending payments can be deleted.'));
        }

        $retainerPayment->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Retainer payment deleted successfully.')]);

        return to_route('retainer-payments.index');
    }

    public function clear(RetainerPayment $retainerPayment): RedirectResponse
    {
        $retainerPayment->clear();

        return $this->done(__('Payment cleared and the deposit recorded.'));
    }

    public function cancel(RetainerPayment $retainerPayment): RedirectResponse
    {
        $retainerPayment->cancel();

        return $this->done(__('Payment cancelled.'));
    }
}
