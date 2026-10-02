<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A cumulative checkpoint on a goal: achieved on the date its goal's contributions first reach the target amount.
 *
 * @property int $id
 * @property int $goal_id
 * @property string $milestone_name
 * @property string|null $description
 * @property string $target_amount
 * @property Carbon $target_date
 * @property Carbon|null $achieved_date
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read string|null $status
 * @property-read Goal $goal
 */
#[Fillable(['goal_id', 'milestone_name', 'description', 'target_amount', 'target_date'])]
class GoalMilestone extends Model
{
    public const STATUSES = ['pending', 'achieved', 'overdue'];

    protected $appends = ['status'];

    /**
     * @return BelongsTo<Goal, $this>
     */
    public function goal(): BelongsTo
    {
        return $this->belongsTo(Goal::class);
    }

    /** Achieved, overdue (still pending past its target date) or pending. */
    public function getStatusAttribute(): ?string
    {
        if (! array_key_exists('target_date', $this->attributes)) {
            return null;
        }

        return match (true) {
            $this->achieved_date !== null => 'achieved',
            $this->target_date->lt(today()) => 'overdue',
            default => 'pending',
        };
    }

    protected function casts(): array
    {
        return ['target_date' => 'date:Y-m-d', 'achieved_date' => 'date:Y-m-d', 'target_amount' => 'decimal:2'];
    }
}
