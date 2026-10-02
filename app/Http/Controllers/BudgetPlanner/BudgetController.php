<?php

namespace App\Http\Controllers\BudgetPlanner;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\BudgetPeriod;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class BudgetController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Budget::query()->with(['period:id,period_name,financial_year', 'approver:id,name,email'])
            ->withSum('allocations as total_allocated', 'allocated_amount')
            ->when($request->filled('budget_period_id'), fn (Builder $q) => $q->where('budget_period_id', $request->integer('budget_period_id')))
            ->when(in_array($request->input('status'), Budget::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')));
        TableQuery::search($query, $request, ['budget_name']);

        $counts = TableQuery::countBy($query, 'budget_type');
        $query->when(in_array($request->input('type'), Budget::TYPES, true), fn (Builder $q) => $q->where('budget_type', $request->input('type')));

        return Inertia::render('budget-planner/budgets/index', [
            'budgets' => TableQuery::paginate($query, $request, [], ['budget_name', 'created_at'], 'created_at'),
            'counts' => ['all' => $counts->sum(), ...collect(Budget::TYPES)->mapWithKeys(fn ($t) => [$t => $counts[$t] ?? 0])],
            'periods' => BudgetPeriod::query()->where('status', '!=', 'closed')->orderByDesc('start_date')->get(['id', 'period_name', 'financial_year']),
            'allPeriods' => BudgetPeriod::query()->orderByDesc('start_date')->get(['id', 'period_name as name']),
            'filters' => TableQuery::filters($request, ['type', 'budget_period_id', 'status']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $budget = new Budget($this->validated($request));
        $budget->forceFill(['created_by' => $request->user()->id])->save();

        return $this->done(__('Budget created. Add its allocations, then send it for approval.'));
    }

    public function update(Request $request, Budget $budget): RedirectResponse
    {
        if ($budget->status !== 'draft') {
            return $this->toast('error', __('Only draft budgets can be edited.'));
        }

        $budget->update($this->validated($request));

        return $this->done(__('Budget updated successfully.'));
    }

    public function destroy(Budget $budget): RedirectResponse
    {
        if ($budget->status !== 'draft') {
            return $this->toast('error', __('Only draft budgets can be deleted.'));
        }

        $budget->delete();

        return $this->done(__('Budget deleted successfully.'));
    }

    /**
     * approve / activate / close, fixed by the route. A budget needs allocations to be approved,
     * and goes live only inside an active period.
     */
    public function transition(Request $request, Budget $budget, string $action): RedirectResponse
    {
        if ($action === 'approve' && ! $budget->allocations()->exists()) {
            throw ValidationException::withMessages(['status' => __('Allocate this budget to at least one account before approving it.')]);
        }

        if ($action === 'activate' && $budget->period->status !== 'active') {
            throw ValidationException::withMessages(['status' => __('Activate the budget period first.')]);
        }

        $budget->transition($action, $request->user());

        return $this->done(__('Budget :status.', ['status' => __($budget->status)]));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'budget_name' => ['required', 'string', 'max:255'],
            'budget_period_id' => ['required', Rule::exists('budget_periods', 'id')->whereNot('status', 'closed')],
            'budget_type' => ['required', Rule::in(Budget::TYPES)],
        ]);
    }
}
