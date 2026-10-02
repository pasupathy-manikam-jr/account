<?php

namespace App\Models;

use App\Support\Money;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * A financial target: draft → active → completed (or cancelled). Its current amount is the sum of its
 * contributions (`withSum('contributions as current_amount', 'amount')`), never stored.
 *
 * @property int $id
 * @property string $goal_name
 * @property string|null $description
 * @property int|null $category_id
 * @property string $goal_type
 * @property string $priority
 * @property string $target_amount
 * @property Carbon $start_date
 * @property Carbon $target_date
 * @property int|null $chart_of_account_id
 * @property string $status
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read GoalCategory|null $category
 * @property-read ChartOfAccount|null $chartOfAccount
 */
#[Fillable(['goal_name', 'description', 'category_id', 'goal_type', 'priority', 'target_amount', 'start_date', 'target_date', 'chart_of_account_id'])]
class Goal extends Model
{
    public const STATUSES = ['draft', 'active', 'completed', 'cancelled'];

    public const TYPES = ['savings', 'debt_reduction', 'expense_reduction', 'revenue'];

    public const PRIORITIES = ['low', 'medium', 'high', 'critical'];

    /** Tracking pace, from progress % minus elapsed-time %: the lowest gap each status still allows. */
    public const PACES = ['ahead' => 5, 'on_track' => -5, 'behind' => -20, 'critical' => null];

    protected $attributes = ['status' => 'draft', 'priority' => 'medium'];

    /**
     * @return BelongsTo<GoalCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(GoalCategory::class);
    }

    /**
     * @return BelongsTo<ChartOfAccount, $this>
     */
    public function chartOfAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class);
    }

    /**
     * @return HasMany<GoalContribution, $this>
     */
    public function contributions(): HasMany
    {
        return $this->hasMany(GoalContribution::class);
    }

    /**
     * @return HasMany<GoalMilestone, $this>
     */
    public function milestones(): HasMany
    {
        return $this->hasMany(GoalMilestone::class);
    }

    /**
     * Everyone with manage-any-goals sees every goal; others only the goals they created.
     *
     * @param  Builder<Goal>  $query
     * @return Builder<Goal>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->can('manage-any-goals') ? $query : $query->where('created_by', $user->id);
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->can('manage-any-goals') || $this->created_by === $user->id;
    }

    /** Draft → active, active → completed, draft/active → cancelled. */
    public function moveTo(string $status): void
    {
        $from = ['active' => ['draft'], 'completed' => ['active'], 'cancelled' => ['draft', 'active']][$status] ?? [];

        if (! in_array($this->status, $from, true)) {
            throw ValidationException::withMessages(['status' => __('This goal is :status and cannot be changed that way.', ['status' => __($this->status)])]);
        }

        $this->forceFill(['status' => $status])->save();
    }

    /**
     * Walk the contributions by date with a running total; each milestone is achieved on the date the total
     * first reaches its target amount.
     */
    public function refreshMilestones(): void
    {
        $contributions = $this->contributions()->orderBy('contribution_date')->orderBy('id')->get(['contribution_date', 'amount']);

        foreach ($this->milestones()->get() as $milestone) {
            $total = 0;
            $achieved = null;

            foreach ($contributions as $contribution) {
                $total += Money::toCents($contribution->amount);

                if ($total >= Money::toCents($milestone->target_amount)) {
                    $achieved = $contribution->contribution_date;
                    break;
                }
            }

            $milestone->forceFill(['achieved_date' => $achieved])->save();
        }
    }

    /**
     * Where a goal stands on a date: ahead, on_track, behind or critical, comparing the share of the target
     * reached with the share of the start → target period elapsed.
     */
    public static function pace(float $progressPercent, CarbonInterface $start, CarbonInterface $target, CarbonInterface $on): string
    {
        $days = max(1, $start->diffInDays($target));
        $elapsed = min(100, max(0, $start->diffInDays($on, false) / $days * 100));
        $gap = $progressPercent - $elapsed;

        return (string) collect(self::PACES)->search(fn (?int $floor) => $floor === null || $gap >= $floor);
    }

    protected function casts(): array
    {
        // current_amount comes from withSum()/loadSum(); the cast keeps it "1500.00" on every database.
        return ['start_date' => 'date:Y-m-d', 'target_date' => 'date:Y-m-d', 'target_amount' => 'decimal:2', 'current_amount' => 'decimal:2'];
    }
}
