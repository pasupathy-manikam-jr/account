<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\CashEntry;
use App\Models\TransactionCategory;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Revenues and expenses (Accounting → Revenue / Expense). The route fixes the kind.
 */
class CashEntryController extends Controller
{
    public function index(Request $request): Response
    {
        $kind = $this->kind($request);

        $query = CashEntry::query()->where('kind', $kind)
            ->with(['category:id,category_name', 'bankAccount:id,account_name,bank_name', 'chartOfAccount:id,account_code,account_name', 'approver:id,name'])
            ->when($request->filled('category_id'), fn (Builder $q) => $q->where('category_id', $request->integer('category_id')))
            ->when($request->filled('bank_account_id'), fn (Builder $q) => $q->where('bank_account_id', $request->integer('bank_account_id')));
        TableQuery::search($query, $request, ['entry_number', 'description', 'reference_number']);

        TableQuery::month($query, $request, 'entry_date');
        $counts = TableQuery::countBy($query, 'status');
        $query->when(in_array($request->input('status'), CashEntry::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')));

        return Inertia::render('account/cash-entries/index', [
            'kind' => $kind,
            'entries' => TableQuery::paginate($query, $request, [], ['entry_number', 'entry_date', 'amount'], 'entry_date'),
            'counts' => ['all' => $counts->sum(), ...collect(CashEntry::STATUSES)->mapWithKeys(fn ($s) => [$s => $counts[$s] ?? 0])],
            'categories' => TransactionCategory::query()->where('kind', $kind)->where('is_active', true)->orderBy('category_name')
                ->get(['id', 'category_name', 'gl_account_id']),
            'bankAccounts' => BankAccount::query()->where('is_active', true)->orderBy('account_name')->get(['id', 'account_name', 'bank_name']),
            'glAccounts' => TransactionCategoryController::glAccounts($kind),
            'filters' => TableQuery::filters($request, ['status', 'category_id', 'bank_account_id', 'month']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $kind = $this->kind($request);

        DB::transaction(function () use ($request, $kind) {
            $entry = new CashEntry($this->validated($request, $kind));
            $entry->forceFill(['kind' => $kind, 'created_by' => $request->user()->id])->save();
            $entry->assignNumber();
        });

        return $this->done($kind === 'revenue' ? __('Revenue recorded successfully.') : __('Expense recorded successfully.'));
    }

    public function update(Request $request, CashEntry $entry): RedirectResponse
    {
        abort_unless($entry->kind === $this->kind($request), 404);

        if ($entry->status !== 'draft') {
            return $this->toast('error', __('Only draft entries can be edited.'));
        }

        $entry->update($this->validated($request, $entry->kind));

        return $this->done(__('Entry updated successfully.'));
    }

    public function destroy(Request $request, CashEntry $entry): RedirectResponse
    {
        abort_unless($entry->kind === $this->kind($request), 404);

        if ($entry->status !== 'draft') {
            return $this->toast('error', __('Only draft entries can be deleted.'));
        }

        $entry->delete();

        return $this->done(__('Entry deleted successfully.'));
    }

    public function approve(Request $request, CashEntry $entry): RedirectResponse
    {
        abort_unless($entry->kind === $this->kind($request), 404);
        $entry->approve($request->user());

        return $this->done(__('Entry approved.'));
    }

    public function post(Request $request, CashEntry $entry): RedirectResponse
    {
        abort_unless($entry->kind === $this->kind($request), 404);
        $entry->post();

        return $this->done(__('Entry posted to the ledger.'));
    }

    private function kind(Request $request): string
    {
        return (string) $request->route()?->defaults['kind'];
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, string $kind): array
    {
        return $request->validate([
            'entry_date' => ['required', 'date'],
            'category_id' => ['required', Rule::exists('transaction_categories', 'id')->where('kind', $kind)->where('is_active', true)],
            'bank_account_id' => ['required', Rule::exists('bank_accounts', 'id')->where('is_active', true)],
            'chart_of_account_id' => ['required', Rule::in(TransactionCategoryController::glAccounts($kind)->pluck('id')->all())],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
            'description' => ['nullable', 'string', 'max:1000'],
            'reference_number' => ['nullable', 'string', 'max:100'],
        ], [
            'chart_of_account_id.in' => $kind === 'revenue' ? __('Choose an active revenue account.') : __('Choose an active expense account.'),
        ]);
    }
}
