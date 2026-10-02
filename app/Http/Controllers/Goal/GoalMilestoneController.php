<?php

namespace App\Http\Controllers\Goal;

use App\Http\Controllers\Controller;
use App\Models\Goal;
use App\Models\GoalMilestone;
use App\Support\Money;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Goal → Milestones: cumulative checkpoints, achieved automatically as contributions come in.
 */
class GoalMilestoneController extends Controller
{
    public function index(Request $request): Response
    {
        $visible = fn () => GoalMilestone::query()->whereHas('goal', fn (Builder $g) => $g->visibleTo($request->user()));

        // The goal's total so far gives each milestone's achieved amount.
        $query = $visible()->with(['goal' => fn ($g) => $g->select(['id', 'goal_name', 'status'])->withSum('contributions as current_amount', 'amount')])
            ->when($request->filled('goal_id'), fn (Builder $q) => $q->where('goal_id', $request->integer('goal_id')));
        TableQuery::search($query, $request, ['milestone_name', 'description']);

        $counts = [
            'pending' => (clone $query)->whereNull('achieved_date')->whereDate('target_date', '>=', today())->count(),
            'achieved' => (clone $query)->whereNotNull('achieved_date')->count(),
            'overdue' => (clone $query)->whereNull('achieved_date')->whereDate('target_date', '<', today())->count(),
        ];
        $query->when($request->input('status'), fn (Builder $q, $status) => match ($status) {
            'achieved' => $q->whereNotNull('achieved_date'),
            'pending' => $q->whereNull('achieved_date')->whereDate('target_date', '>=', today()),
            'overdue' => $q->whereNull('achieved_date')->whereDate('target_date', '<', today()),
            default => $q,
        });

        $all = $visible()->get(['id', 'target_amount', 'achieved_date']);
        $target = $all->sum(fn (GoalMilestone $m) => Money::toCents($m->target_amount));
        $achieved = $all->whereNotNull('achieved_date')->sum(fn (GoalMilestone $m) => Money::toCents($m->target_amount));

        return Inertia::render('goal/milestones/index', [
            'milestones' => TableQuery::paginate($query, $request, [], ['milestone_name', 'target_amount', 'target_date', 'achieved_date'], 'target_date', 'asc'),
            'counts' => ['all' => array_sum($counts), ...$counts],
            'stats' => ['total' => $all->count(), ...$counts, 'achieved_amount' => Money::format($achieved), 'ratio' => $target > 0 ? round($achieved / $target * 100) : 0],
            'goals' => Goal::query()->visibleTo($request->user())->whereNot('status', 'cancelled')->orderBy('goal_name')->get(['id', 'goal_name', 'target_amount']),
            'filters' => TableQuery::filters($request, ['status', 'goal_id']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $milestone = GoalMilestone::query()->create($this->validated($request));
        $milestone->goal->refreshMilestones();

        return $this->done(__('Milestone created successfully.'));
    }

    public function update(Request $request, GoalMilestone $milestone): RedirectResponse
    {
        abort_unless($milestone->goal->isVisibleTo($request->user()), 404);
        $milestone->update($this->validated($request));
        $milestone->goal()->firstOrFail()->refreshMilestones();

        return $this->done(__('Milestone updated successfully.'));
    }

    public function destroy(Request $request, GoalMilestone $milestone): RedirectResponse
    {
        abort_unless($milestone->goal->isVisibleTo($request->user()), 404);
        $milestone->delete();

        return $this->done(__('Milestone deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'goal_id' => ['required', Rule::exists('goals', 'id')->whereNot('status', 'cancelled')],
            'milestone_name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'target_amount' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
            'target_date' => ['required', 'date'],
        ]);

        $goal = Goal::query()->whereKey($data['goal_id'])->firstOrFail();
        abort_unless($goal->isVisibleTo($request->user()), 404);

        if (Money::toCents($data['target_amount']) > Money::toCents($goal->target_amount)) {
            throw ValidationException::withMessages(['target_amount' => __('A milestone cannot be more than its goal\'s target amount.')]);
        }

        return $data;
    }
}
