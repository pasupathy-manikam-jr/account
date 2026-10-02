<?php

namespace App\Http\Controllers\BudgetPlanner;

use App\Http\Controllers\Controller;
use App\Models\BudgetPeriod;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BudgetPeriodController extends Controller
{
    public function index(Request $request): Response
    {
        $query = BudgetPeriod::query()->with('approver:id,name,email')->withCount('budgets');
        TableQuery::search($query, $request, ['period_name', 'financial_year']);

        $counts = TableQuery::countBy($query, 'status');
        $query->when(in_array($request->input('status'), BudgetPeriod::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')));

        return Inertia::render('budget-planner/periods/index', [
            'periods' => TableQuery::paginate($query, $request, [], ['period_name', 'financial_year', 'start_date', 'end_date'], 'start_date'),
            'counts' => ['all' => $counts->sum(), ...collect(BudgetPeriod::STATUSES)->mapWithKeys(fn ($s) => [$s => $counts[$s] ?? 0])],
            'filters' => TableQuery::filters($request, ['status']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $period = new BudgetPeriod($this->validated($request));
        $period->forceFill(['created_by' => $request->user()->id])->save();

        return $this->done(__('Budget period created successfully.'));
    }

    public function update(Request $request, BudgetPeriod $budgetPeriod): RedirectResponse
    {
        if ($budgetPeriod->status !== 'draft') {
            return $this->toast('error', __('Only draft budget periods can be edited.'));
        }

        $budgetPeriod->update($this->validated($request));

        return $this->done(__('Budget period updated successfully.'));
    }

    public function destroy(BudgetPeriod $budgetPeriod): RedirectResponse
    {
        if ($budgetPeriod->status !== 'draft' || $budgetPeriod->budgets()->exists()) {
            return $this->toast('error', __('Only draft budget periods with no budgets can be deleted.'));
        }

        $budgetPeriod->delete();

        return $this->done(__('Budget period deleted successfully.'));
    }

    /** approve / activate / close, fixed by the route. */
    public function transition(Request $request, BudgetPeriod $budgetPeriod, string $action): RedirectResponse
    {
        $budgetPeriod->transition($action, $request->user());

        return $this->done(__('Budget period :status.', ['status' => __($budgetPeriod->status)]));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'period_name' => ['required', 'string', 'max:255'],
            'financial_year' => ['required', 'integer', 'between:2000,2100'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
        ]);
    }
}
