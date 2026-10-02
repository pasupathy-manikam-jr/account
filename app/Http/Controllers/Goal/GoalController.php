<?php

namespace App\Http\Controllers\Goal;

use App\Http\Controllers\Controller;
use App\Models\ChartOfAccount;
use App\Models\Goal;
use App\Models\GoalCategory;
use App\Support\Money;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Goal → Goals: financial targets, tracked by the contributions made towards them.
 */
class GoalController extends Controller
{
    public function index(Request $request): Response
    {
        $visible = fn () => Goal::query()->visibleTo($request->user());

        $query = $visible()->with('category:id,category_name')->withSum('contributions as current_amount', 'amount')
            ->when($request->filled('category_id'), fn (Builder $q) => $q->where('category_id', $request->integer('category_id')))
            ->when(in_array($request->input('priority'), Goal::PRIORITIES, true), fn (Builder $q) => $q->where('priority', $request->input('priority')))
            ->when(in_array($request->input('goal_type'), Goal::TYPES, true), fn (Builder $q) => $q->where('goal_type', $request->input('goal_type')));
        TableQuery::search($query, $request, ['goal_name', 'description']);

        $counts = TableQuery::countBy($query, 'status');
        $query->when(in_array($request->input('status'), Goal::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')));

        $all = $visible()->withSum('contributions as current_amount', 'amount')->get(['id', 'status', 'target_amount']);
        $statusTotals = $all->countBy('status');

        return Inertia::render('goal/goals/index', [
            'goals' => TableQuery::paginate($query, $request, [], ['goal_name', 'target_amount', 'target_date', 'start_date'], 'target_date', 'asc'),
            'counts' => ['all' => $counts->sum(), ...collect(Goal::STATUSES)->mapWithKeys(fn ($s) => [$s => $counts[$s] ?? 0])],
            'stats' => [
                'total' => $all->count(),
                'active' => $statusTotals['active'] ?? 0,
                'completed' => $statusTotals['completed'] ?? 0,
                'draft' => $statusTotals['draft'] ?? 0,
                'target' => Money::format($all->sum(fn (Goal $g) => Money::toCents($g->target_amount))),
                'current' => Money::format($all->sum(fn (Goal $g) => Money::toCents($g->getAttribute('current_amount')))),
            ],
            ...$this->options(),
            'filters' => TableQuery::filters($request, ['status', 'category_id', 'priority', 'goal_type']),
        ]);
    }

    public function show(Request $request, Goal $goal): Response
    {
        abort_unless($goal->isVisibleTo($request->user()), 404);

        return Inertia::render('goal/goals/show', [
            'goal' => $goal->loadSum('contributions as current_amount', 'amount')->load([
                'category:id,category_name',
                'chartOfAccount:id,account_code,account_name',
                'milestones' => fn ($q) => $q->orderBy('target_amount'),
                'contributions' => fn ($q) => $q->orderByDesc('contribution_date')->orderByDesc('id'),
            ]),
            ...$this->options(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $goal = new Goal($this->validated($request));
        $goal->forceFill(['created_by' => $request->user()->id])->save();

        return $this->done(__('Goal created successfully.'));
    }

    public function update(Request $request, Goal $goal): RedirectResponse
    {
        abort_unless($goal->isVisibleTo($request->user()), 404);

        if (in_array($goal->status, ['completed', 'cancelled'], true)) {
            return $this->toast('error', __('Completed or cancelled goals cannot be edited.'));
        }

        $goal->update($this->validated($request));

        return $this->done(__('Goal updated successfully.'));
    }

    public function destroy(Request $request, Goal $goal): RedirectResponse
    {
        abort_unless($goal->isVisibleTo($request->user()), 404);

        if (! in_array($goal->status, ['draft', 'cancelled'], true)) {
            return $this->toast('error', __('Only draft or cancelled goals can be deleted.'));
        }

        $goal->delete();

        // Deleting can happen from the goal's own page, so go to the list rather than back.
        Inertia::flash('toast', ['type' => 'success', 'message' => __('Goal deleted successfully.')]);

        return to_route('goal.goals.index');
    }

    public function activate(Request $request, Goal $goal): RedirectResponse
    {
        return $this->move($request, $goal, 'active', __('Goal activated.'));
    }

    public function complete(Request $request, Goal $goal): RedirectResponse
    {
        return $this->move($request, $goal, 'completed', __('Goal marked as completed.'));
    }

    public function cancel(Request $request, Goal $goal): RedirectResponse
    {
        return $this->move($request, $goal, 'cancelled', __('Goal cancelled.'));
    }

    private function move(Request $request, Goal $goal, string $status, string $message): RedirectResponse
    {
        abort_unless($goal->isVisibleTo($request->user()), 404);
        $goal->moveTo($status);

        return $this->done($message);
    }

    /**
     * @return array<string, mixed>
     */
    private function options(): array
    {
        return [
            'categories' => GoalCategory::query()->where('is_active', true)->orderBy('category_name')->get(['id', 'category_name']),
            'chartOfAccounts' => ChartOfAccount::query()->where('is_active', true)->orderBy('account_code')->get(['id', 'account_code', 'account_name']),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'goal_name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'category_id' => ['nullable', Rule::exists('goal_categories', 'id')->where('is_active', true)],
            'goal_type' => ['required', Rule::in(Goal::TYPES)],
            'priority' => ['required', Rule::in(Goal::PRIORITIES)],
            'target_amount' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
            'start_date' => ['required', 'date'],
            'target_date' => ['required', 'date', 'after_or_equal:start_date'],
            'chart_of_account_id' => ['nullable', Rule::exists('chart_of_accounts', 'id')->where('is_active', true)],
        ]);
    }
}
