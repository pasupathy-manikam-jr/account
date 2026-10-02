<?php

namespace App\Http\Controllers\BudgetPlanner;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\BudgetAllocation;
use App\Models\ChartOfAccount;
use App\Support\Money;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The plan per expense account. Spent is what the ledger shows on that account during the budget's period.
 */
class BudgetAllocationController extends Controller
{
    public function index(Request $request): Response
    {
        $query = BudgetAllocation::query()
            ->with(['budget:id,budget_name,status,budget_period_id', 'budget.period:id,period_name,start_date,end_date', 'account:id,account_code,account_name'])
            ->when($request->filled('budget_id'), fn (Builder $q) => $q->where('budget_id', $request->integer('budget_id')))
            ->when($request->filled('account_id'), fn (Builder $q) => $q->where('account_id', $request->integer('account_id')))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereHas('budget', fn (Builder $b) => $b->where('budget_name', 'like', "%{$search}%"))
                ->orWhereHas('account', fn (Builder $a) => $a->where('account_name', 'like', "%{$search}%")->orWhere('account_code', 'like', "%{$search}%"))));

        $all = (clone $query)->get();
        $spent = self::spent($all);
        $allocations = TableQuery::paginate($query, $request, [], ['allocated_amount', 'created_at'], 'created_at');
        $allocations->getCollection()->each(fn (BudgetAllocation $a) => $a->setAttribute('spent_amount', Money::format($spent[$a->id])));

        return Inertia::render('budget-planner/allocations/index', [
            'allocations' => $allocations,
            'stats' => [
                'count' => $all->count(),
                'allocated' => Money::format($all->sum(fn (BudgetAllocation $a) => Money::toCents($a->allocated_amount))),
                'spent' => Money::format(array_sum($spent)),
            ],
            'budgets' => Budget::query()->orderBy('budget_name')->get(['id', 'budget_name', 'status']),
            'accounts' => self::expenseAccounts(),
            'filters' => TableQuery::filters($request, ['budget_id', 'account_id']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        if ($error = $this->locked((int) $data['budget_id'])) {
            return $error;
        }

        BudgetAllocation::query()->create($data);

        return $this->done(__('Budget allocation created successfully.'));
    }

    public function update(Request $request, BudgetAllocation $budgetAllocation): RedirectResponse
    {
        $data = $this->validated($request, $budgetAllocation);

        if ($error = $this->locked($budgetAllocation->budget_id) ?? $this->locked((int) $data['budget_id'])) {
            return $error;
        }

        $budgetAllocation->update($data);

        return $this->done(__('Budget allocation updated successfully.'));
    }

    public function destroy(BudgetAllocation $budgetAllocation): RedirectResponse
    {
        if ($error = $this->locked($budgetAllocation->budget_id)) {
            return $error;
        }

        $budgetAllocation->delete();

        return $this->done(__('Budget allocation deleted successfully.'));
    }

    /**
     * Ledger spend on each allocation's account within its budget's period: [allocation id => cents].
     *
     * @param  Collection<int, BudgetAllocation>  $allocations
     * @return array<int, int>
     */
    public static function spent(Collection $allocations): array
    {
        $spent = [];

        foreach ($allocations->groupBy('budget_id') as $lines) {
            /** @var BudgetAllocation $first */
            $first = $lines->first();
            $period = $first->budget->period;
            $byMonth = Budget::spentByMonth(array_values($lines->pluck('account_id')->all()), $period->start_date, $period->end_date);

            foreach ($lines as $line) {
                $spent[$line->id] = array_sum($byMonth[$line->account_id] ?? []);
            }
        }

        return $spent;
    }

    /**
     * @return Collection<int, ChartOfAccount>
     */
    public static function expenseAccounts(): Collection
    {
        return ChartOfAccount::query()->where('is_active', true)
            ->whereHas('accountType', fn (Builder $q) => $q->where('category', 'expenses'))
            ->orderBy('account_code')->get(['id', 'account_code', 'account_name']);
    }

    /** Allocations are the plan being approved, so they change only while the budget is a draft. */
    private function locked(int $budgetId): ?RedirectResponse
    {
        return Budget::query()->whereKey($budgetId)->value('status') === 'draft'
            ? null
            : $this->toast('error', __('Allocations can only be changed while the budget is a draft.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?BudgetAllocation $allocation = null): array
    {
        return $request->validate([
            'budget_id' => ['required', Rule::exists('budgets', 'id')],
            'account_id' => [
                'required',
                Rule::in(self::expenseAccounts()->pluck('id')->all()),
                Rule::unique('budget_allocations', 'account_id')->where('budget_id', $request->integer('budget_id'))->ignore($allocation),
            ],
            'allocated_amount' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
        ], [
            'account_id.unique' => __('This budget already has an allocation for that account.'),
            'account_id.in' => __('Choose an active expense account.'),
        ]);
    }
}
