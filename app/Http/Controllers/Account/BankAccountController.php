<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\ChartOfAccount;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BankAccountController extends Controller
{
    public function index(Request $request): Response
    {
        $query = BankAccount::query()
            ->with(['glAccount' => fn ($q) => $q->select('id', 'account_code', 'account_name', 'normal_balance', 'opening_balance')->withTotals()])
            ->when($request->filled('status'), fn (Builder $q) => $q->where('is_active', $request->input('status') === 'active'));

        TableQuery::search($query, $request, ['account_number', 'account_name', 'bank_name']);
        $counts = TableQuery::countBy($query, 'account_type');
        $banks = TableQuery::paginate(
            $query->when(in_array($request->input('account_type'), BankAccount::TYPES, true), fn (Builder $q) => $q->where('account_type', $request->input('account_type'))),
            $request,
            [],
            ['account_number', 'account_name', 'bank_name', 'opening_balance'],
            'account_name',
            'asc',
        );
        $banks->getCollection()->each(fn (BankAccount $b) => $b->setAttribute('current_balance', $b->currentBalance()));

        return Inertia::render('account/bank-accounts/index', [
            'bankAccounts' => $banks,
            'counts' => ['all' => $counts->sum(), ...collect(BankAccount::TYPES)->mapWithKeys(fn ($type) => [$type => $counts[$type] ?? 0])],
            // Ledger accounts free to back a bank account (the edit form adds back its own).
            'glAccounts' => ChartOfAccount::query()->where('is_active', true)->orderBy('account_code')->get(['id', 'account_code', 'account_name']),
            'usedGlAccountIds' => BankAccount::query()->pluck('gl_account_id'),
            'filters' => TableQuery::filters($request, ['status', 'account_type']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        BankAccount::create($this->validated($request));

        return $this->done(__('Bank account created successfully.'));
    }

    public function update(Request $request, BankAccount $bankAccount): RedirectResponse
    {
        $bankAccount->update($this->validated($request, $bankAccount));

        return $this->done(__('Bank account updated successfully.'));
    }

    public function destroy(BankAccount $bankAccount): RedirectResponse
    {
        if ($bankAccount->glAccount->items()->exists()) {
            return $this->toast('error', __('Bank accounts with posted transactions cannot be deleted. Deactivate it instead.'));
        }

        $bankAccount->delete();

        return $this->done(__('Bank account deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?BankAccount $bankAccount = null): array
    {
        $data = $request->validate([
            'account_number' => ['required', 'string', 'max:50', Rule::unique('bank_accounts')->ignore($bankAccount)],
            'account_name' => ['required', 'string', 'max:255'],
            'bank_name' => ['required', 'string', 'max:255'],
            'branch_name' => ['nullable', 'string', 'max:255'],
            'account_type' => ['required', Rule::in(BankAccount::TYPES)],
            'opening_balance' => ['nullable', 'numeric', 'between:-9999999999999.99,9999999999999.99', 'decimal:0,2'],
            'iban' => ['nullable', 'string', 'max:50'],
            'swift_code' => ['nullable', 'string', 'max:20'],
            'routing_number' => ['nullable', 'string', 'max:30'],
            'is_active' => ['boolean'],
            'gl_account_id' => ['required', Rule::exists('chart_of_accounts', 'id'), Rule::unique('bank_accounts')->ignore($bankAccount)],
        ], [
            'gl_account_id.unique' => __('This ledger account already belongs to another bank account.'),
        ]);

        return [...$data, 'opening_balance' => $data['opening_balance'] ?? 0];
    }
}
