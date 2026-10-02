<?php

namespace App\Http\Controllers\BudgetPlanner;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Support\Money;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Month-by-month plan against actual for live and closed budgets. The plan to date is the allocation spread
 * evenly over the period's days; variance is plan to date less actual (negative = overspending the pace).
 */
class BudgetMonitoringController extends Controller
{
    public function index(Request $request): Response
    {
        $budgets = Budget::query()->whereIn('status', ['active', 'closed'])
            ->with(['period:id,period_name,start_date,end_date', 'allocations:id,budget_id,account_id,allocated_amount'])
            ->orderBy('budget_name')->get();
        $budgetId = $request->integer('budget_id');

        $rows = [];
        $summary = [];

        foreach ($budgets as $budget) {
            $period = $budget->period;
            $allocated = $budget->allocations->sum(fn ($a) => Money::toCents($a->allocated_amount));
            $byAccount = Budget::spentByMonth(array_values($budget->allocations->pluck('account_id')->all()), $period->start_date, $period->end_date);
            $byMonth = [];

            foreach ($byAccount as $months) {
                foreach ($months as $month => $cents) {
                    $byMonth[$month] = ($byMonth[$month] ?? 0) + $cents;
                }
            }

            $days = (int) $period->start_date->diffInDays($period->end_date) + 1;
            $last = min($period->end_date, today());
            $spent = 0;

            for ($month = $period->start_date->startOfMonth(); $month <= $last; $month = $month->addMonth()) {
                $spent += $byMonth[$month->format('Y-m')] ?? 0;
                $asOf = min($month->endOfMonth()->startOfDay(), $period->end_date, today());
                $planned = (int) round($allocated * ((int) $period->start_date->diffInDays($asOf) + 1) / $days);

                if ($budgetId === 0 || $budgetId === $budget->id) {
                    $rows[] = [
                        'key' => "{$budget->id}-{$month->format('Y-m')}",
                        'budget_id' => $budget->id,
                        'budget_name' => $budget->budget_name,
                        'date' => $asOf->toDateString(),
                        'allocated' => Money::format($allocated),
                        'planned' => Money::format($planned),
                        'spent' => Money::format($spent),
                        'variance' => Money::format($planned - $spent),
                        'variance_percentage' => $allocated > 0 ? round(($planned - $spent) / $allocated * 100, 2) : 0,
                    ];
                }
            }

            if ($budgetId === 0 || $budgetId === $budget->id) {
                $summary[] = ['allocated' => $allocated, 'spent' => $spent];
            }
        }

        usort($rows, fn (array $a, array $b) => [$b['date'], $a['budget_name']] <=> [$a['date'], $b['budget_name']]);

        return Inertia::render('budget-planner/monitoring/index', [
            'rows' => $rows,
            'stats' => [
                'budgets' => count($summary),
                'allocated' => Money::format(array_sum(array_column($summary, 'allocated'))),
                'spent' => Money::format(array_sum(array_column($summary, 'spent'))),
            ],
            'budgets' => $budgets->map(fn (Budget $b) => ['id' => $b->id, 'name' => $b->budget_name])->values(),
            'filters' => ['budget_id' => $budgetId ?: null],
        ]);
    }
}
