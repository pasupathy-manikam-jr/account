<?php

namespace App\Http\Controllers\Goal;

use App\Http\Controllers\Controller;
use App\Models\Goal;
use App\Models\GoalContribution;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Goal → Contributions: money put towards active goals. Every change re-dates the goal's milestones.
 */
class GoalContributionController extends Controller
{
    public function index(Request $request): Response
    {
        $query = GoalContribution::query()->whereHas('goal', fn (Builder $g) => $g->visibleTo($request->user()))
            ->with('goal:id,goal_name,status')
            ->when($request->filled('goal_id'), fn (Builder $q) => $q->where('goal_id', $request->integer('goal_id')))
            ->when(in_array($request->input('contribution_type'), GoalContribution::TYPES, true), fn (Builder $q) => $q->where('contribution_type', $request->input('contribution_type')));

        return Inertia::render('goal/contributions/index', [
            'contributions' => TableQuery::paginate($query, $request, ['notes'], ['contribution_date', 'amount'], 'contribution_date'),
            'goals' => Goal::query()->visibleTo($request->user())->orderBy('goal_name')->get(['id', 'goal_name', 'status']),
            'filters' => TableQuery::filters($request, ['goal_id', 'contribution_type']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        DB::transaction(fn () => GoalContribution::query()->create($data)->goal->refreshMilestones());

        return $this->done(__('Contribution added successfully.'));
    }

    public function update(Request $request, GoalContribution $contribution): RedirectResponse
    {
        if ($error = $this->locked($request, $contribution)) {
            return $error;
        }

        $data = $this->validated($request);
        $previous = $contribution->goal;

        DB::transaction(function () use ($contribution, $data, $previous) {
            $contribution->update($data);
            // Moving a contribution to another goal changes both goals' milestones.
            $previous->refreshMilestones();
            $contribution->goal()->firstOrFail()->refreshMilestones();
        });

        return $this->done(__('Contribution updated successfully.'));
    }

    public function destroy(Request $request, GoalContribution $contribution): RedirectResponse
    {
        if ($error = $this->locked($request, $contribution)) {
            return $error;
        }

        DB::transaction(function () use ($contribution) {
            $contribution->delete();
            $contribution->goal->refreshMilestones();
        });

        return $this->done(__('Contribution deleted successfully.'));
    }

    /** Contributions to a goal that is no longer active stay as they are. */
    private function locked(Request $request, GoalContribution $contribution): ?RedirectResponse
    {
        abort_unless($contribution->goal->isVisibleTo($request->user()), 404);

        return $contribution->goal->status === 'active' ? null : $this->toast('error', __('Contributions can only be changed while their goal is active.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'goal_id' => ['required', Rule::exists('goals', 'id')->where('status', 'active')],
            'contribution_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
            'contribution_type' => ['required', Rule::in(GoalContribution::TYPES)],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'goal_id.exists' => __('Contributions can only be added to active goals.'),
        ]);

        abort_unless(Goal::query()->whereKey($data['goal_id'])->firstOrFail()->isVisibleTo($request->user()), 404);

        return $data;
    }
}
