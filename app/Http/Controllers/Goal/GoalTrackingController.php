<?php

namespace App\Http\Controllers\Goal;

use App\Http\Controllers\Controller;
use App\Models\Goal;
use App\Models\GoalContribution;
use App\Support\Money;
use App\Support\TableQuery;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Goal → Tracking: read-only. One row per contribution with the goal's running total, progress and pace
 * against the time elapsed, all worked out from the contributions.
 */
class GoalTrackingController extends Controller
{
    public function index(Request $request): Response
    {
        $goals = Goal::query()->visibleTo($request->user())
            ->when($request->filled('goal_id'), fn ($q) => $q->whereKey($request->integer('goal_id')));
        TableQuery::search($goals, $request, ['goal_name']);
        $goals = $goals
            ->with(['contributions' => fn ($q) => $q->orderBy('contribution_date')->orderBy('id')])
            ->get();

        $rows = $goals->flatMap(function (Goal $goal) {
            $running = 0;
            $target = max(1, Money::toCents($goal->target_amount));

            return $goal->contributions->map(function (GoalContribution $c) use ($goal, &$running, $target) {
                $running += Money::toCents($c->amount);
                $progress = round($running / $target * 100, 1);

                return [
                    'id' => $c->id,
                    'goal_id' => $goal->id,
                    'goal_name' => $goal->goal_name,
                    'goal_type' => $goal->goal_type,
                    'date' => $c->contribution_date->toDateString(),
                    'days_left' => (int) $c->contribution_date->diffInDays($goal->target_date, false),
                    'amount' => $c->amount,
                    'running_total' => Money::format($running),
                    'progress' => min(100, $progress),
                    'status' => Goal::pace($progress, $goal->start_date, $goal->target_date, $c->contribution_date),
                ];
            });
        });

        $counts = $rows->countBy('status');
        $status = $request->input('status');
        $filtered = $rows->when(array_key_exists((string) $status, Goal::PACES), fn ($r) => $r->where('status', $status))
            ->sortByDesc('date')->values();

        $perPage = in_array($request->integer('per_page'), TableQuery::PER_PAGE, true) ? $request->integer('per_page') : TableQuery::PER_PAGE[0];
        $page = max(1, $request->integer('page', 1));

        return Inertia::render('goal/tracking/index', [
            'trackings' => (new LengthAwarePaginator($filtered->forPage($page, $perPage)->values(), $filtered->count(), $perPage, $page, [
                'path' => $request->url(),
                'query' => $request->query(),
            ])),
            'counts' => ['all' => $rows->count(), ...collect(Goal::PACES)->mapWithKeys(fn ($floor, $pace) => [$pace => $counts[$pace] ?? 0])],
            'stats' => ['total_contributions' => Money::format($rows->sum(fn (array $r) => Money::toCents($r['amount'])))],
            'goals' => Goal::query()->visibleTo($request->user())->orderBy('goal_name')->get(['id', 'goal_name']),
            'filters' => TableQuery::filters($request, ['status', 'goal_id']),
        ]);
    }
}
