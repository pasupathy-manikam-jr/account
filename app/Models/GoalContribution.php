<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $goal_id
 * @property Carbon $contribution_date
 * @property string $amount
 * @property string $contribution_type
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Goal $goal
 */
#[Fillable(['goal_id', 'contribution_date', 'amount', 'contribution_type', 'notes'])]
class GoalContribution extends Model
{
    public const TYPES = ['manual', 'automatic'];

    /**
     * @return BelongsTo<Goal, $this>
     */
    public function goal(): BelongsTo
    {
        return $this->belongsTo(Goal::class);
    }

    protected function casts(): array
    {
        return ['contribution_date' => 'date:Y-m-d', 'amount' => 'decimal:2'];
    }
}
