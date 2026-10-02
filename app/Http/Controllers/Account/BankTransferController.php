<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\BankTransfer;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BankTransferController extends Controller
{
    public function index(Request $request): Response
    {
        $dates = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', ...($request->filled('date_from') ? ['after_or_equal:date_from'] : [])],
        ]);
        $query = BankTransfer::query()->with(['fromAccount:id,account_name,account_number,bank_name', 'toAccount:id,account_name,account_number,bank_name'])
            ->when($dates['date_from'] ?? null, fn (Builder $q, string $from) => $q->whereDate('transfer_date', '>=', $from))
            ->when($dates['date_to'] ?? null, fn (Builder $q, string $to) => $q->whereDate('transfer_date', '<=', $to))
            ->when($request->filled('from_account_id'), fn (Builder $q) => $q->where('from_account_id', $request->integer('from_account_id')))
            ->when($request->filled('to_account_id'), fn (Builder $q) => $q->where('to_account_id', $request->integer('to_account_id')));
        TableQuery::search($query, $request, ['transfer_number', 'reference_number', 'description']);

        $counts = TableQuery::countBy($query, 'status');
        $query->when(in_array($request->input('status'), BankTransfer::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')));

        return Inertia::render('account/bank-transfers/index', [
            'transfers' => TableQuery::paginate($query, $request, [], ['transfer_number', 'transfer_date', 'transfer_amount'], 'transfer_date'),
            'counts' => ['all' => $counts->sum(), 'pending' => $counts['pending'] ?? 0, 'completed' => $counts['completed'] ?? 0],
            'bankAccounts' => BankAccount::query()->where('is_active', true)->orderBy('account_name')->get(['id', 'account_name', 'bank_name']),
            'filters' => TableQuery::filters($request, ['status', 'from_account_id', 'to_account_id', 'date_from', 'date_to']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        DB::transaction(function () use ($request) {
            $transfer = new BankTransfer($this->validated($request));
            $transfer->forceFill(['created_by' => $request->user()->id])->save();
            $transfer->assignNumber();
        });

        return $this->done(__('Bank transfer created. Process it once the money has moved.'));
    }

    public function update(Request $request, BankTransfer $bankTransfer): RedirectResponse
    {
        if ($bankTransfer->status !== 'pending') {
            return $this->toast('error', __('Only pending transfers can be edited.'));
        }

        $bankTransfer->update($this->validated($request));

        return $this->done(__('Bank transfer updated successfully.'));
    }

    public function destroy(BankTransfer $bankTransfer): RedirectResponse
    {
        if ($bankTransfer->status !== 'pending') {
            return $this->toast('error', __('Only pending transfers can be deleted.'));
        }

        $bankTransfer->delete();

        return $this->done(__('Bank transfer deleted successfully.'));
    }

    public function process(BankTransfer $bankTransfer): RedirectResponse
    {
        $bankTransfer->process();

        return $this->done(__('Transfer processed and posted to the ledger.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'transfer_date' => ['required', 'date'],
            'from_account_id' => ['required', Rule::exists('bank_accounts', 'id')->where('is_active', true)],
            'to_account_id' => ['required', 'different:from_account_id', Rule::exists('bank_accounts', 'id')->where('is_active', true)],
            'transfer_amount' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
            'transfer_charges' => ['nullable', 'numeric', 'min:0', 'max:9999999.99', 'decimal:0,2'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]) + ['transfer_charges' => 0];
    }
}
