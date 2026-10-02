<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\AccountType;
use App\Models\ChartOfAccount;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ChartOfAccountController extends Controller
{
    public function index(Request $request): Response
    {
        $query = ChartOfAccount::query()
            ->with(['accountType:id,name,category', 'parentAccount:id,account_code,account_name'])
            ->withTotals()
            ->when($request->filled('account_type_id'), fn (Builder $q) => $q->where('account_type_id', $request->integer('account_type_id')))
            ->when($request->filled('status'), fn (Builder $q) => $q->where('is_active', $request->input('status') === 'active'));

        TableQuery::search($query, $request, ['account_code', 'account_name']);
        $counts = TableQuery::countBy($query, 'normal_balance');
        $accounts = TableQuery::paginate(
            $query->when(in_array($request->input('normal_balance'), AccountType::BALANCES, true), fn (Builder $q) => $q->where('normal_balance', $request->input('normal_balance'))),
            $request,
            [],
            ['account_code', 'account_name', 'normal_balance', 'opening_balance'],
            'account_code',
            'asc',
        );
        $accounts->getCollection()->each(fn (ChartOfAccount $a) => $a->setAttribute('current_balance', $a->currentBalance()));

        return Inertia::render('account/chart-of-accounts/index', [
            'accounts' => $accounts,
            'counts' => ['all' => $counts->sum(), 'debit' => $counts['debit'] ?? 0, 'credit' => $counts['credit'] ?? 0],
            'accountTypes' => AccountType::query()->where('is_active', true)->orderBy('id')->get(['id', 'name', 'normal_balance']),
            'parentAccounts' => ChartOfAccount::query()->orderBy('account_code')->get(['id', 'account_code', 'account_name']),
            'filters' => TableQuery::filters($request, ['account_type_id', 'status', 'normal_balance']),
        ]);
    }

    public function show(Request $request, ChartOfAccount $chartOfAccount): Response
    {
        $chartOfAccount->load(['accountType:id,name,category', 'parentAccount:id,account_code,account_name', 'bankAccount:id,gl_account_id,account_name'])
            ->loadSum('items as debit_total', 'debit_amount')
            ->loadSum('items as credit_total', 'credit_amount');
        $chartOfAccount->setAttribute('current_balance', $chartOfAccount->currentBalance());

        return Inertia::render('account/chart-of-accounts/show', [
            'account' => $chartOfAccount,
            'history' => $chartOfAccount->items()
                ->with('journalEntry:id,journal_number,journal_date,description,reference_type')
                ->latest('id')
                ->paginate(10)
                ->withQueryString(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        ChartOfAccount::create($this->validated($request));

        return $this->done(__('Account created successfully.'));
    }

    public function update(Request $request, ChartOfAccount $chartOfAccount): RedirectResponse
    {
        $chartOfAccount->update($this->validated($request, $chartOfAccount));

        return $this->done(__('Account updated successfully.'));
    }

    public function destroy(ChartOfAccount $chartOfAccount): RedirectResponse
    {
        $inUse = $chartOfAccount->items()->exists() || $chartOfAccount->children()->exists() || $chartOfAccount->bankAccount()->exists();

        if ($chartOfAccount->is_system_account || $inUse) {
            return $this->toast('error', __('System accounts and accounts with transactions, sub-accounts or a bank account cannot be deleted.'));
        }

        $chartOfAccount->delete();

        return $this->done(__('Account deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?ChartOfAccount $account = null): array
    {
        $data = $request->validate([
            'account_code' => ['required', 'string', 'max:20', Rule::unique('chart_of_accounts')->ignore($account)],
            'account_name' => ['required', 'string', 'max:255'],
            'account_type_id' => ['required', Rule::exists('account_types', 'id')],
            'parent_account_id' => [
                'nullable',
                Rule::exists('chart_of_accounts', 'id'),
                function (string $attribute, mixed $value, \Closure $fail) use ($account) {
                    if ($account && $this->isSelfOrDescendant((int) $value, $account)) {
                        $fail(__('An account cannot be its own parent or sit under one of its sub-accounts.'));
                    }
                },
            ],
            'normal_balance' => ['required', Rule::in(AccountType::BALANCES)],
            'opening_balance' => ['nullable', 'numeric', 'between:-9999999999999.99,9999999999999.99', 'decimal:0,2'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['boolean'],
        ]);

        $parent = ChartOfAccount::query()->whereKey($data['parent_account_id'] ?? null)->first();

        return [...$data, 'opening_balance' => $data['opening_balance'] ?? 0, 'level' => $parent ? $parent->level + 1 : 1];
    }

    /**
     * Whether $candidateId is $account itself or below it, which would make the tree a loop.
     */
    private function isSelfOrDescendant(int $candidateId, ChartOfAccount $account): bool
    {
        for ($id = $candidateId, $guard = 0; $id && $guard < 50; $guard++) {
            if ($id === $account->id) {
                return true;
            }

            $id = (int) ChartOfAccount::query()->whereKey($id)->value('parent_account_id');
        }

        return false;
    }
}
