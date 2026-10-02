<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * An asset handed to a member of staff until it is returned.
 *
 * @property int $id
 * @property int $asset_id
 * @property int $assigned_to
 * @property Carbon $assigned_date
 * @property Carbon|null $expected_return_date
 * @property string $condition
 * @property Carbon|null $returned_date
 * @property string|null $return_condition
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read string $status
 * @property-read Asset $asset
 * @property-read User $assignee
 */
#[Fillable(['asset_id', 'assigned_to', 'assigned_date', 'expected_return_date', 'condition', 'notes'])]
class AssetAssignment extends Model
{
    public const CONDITIONS = ['excellent', 'good', 'fair', 'poor'];

    protected $appends = ['status'];

    /**
     * @return BelongsTo<Asset, $this>
     */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /** returned, overdue (still out after the expected return date) or active. */
    public function getStatusAttribute(): string
    {
        return match (true) {
            $this->returned_date !== null => 'returned',
            $this->expected_return_date !== null && $this->expected_return_date->isBefore(today()) => 'overdue',
            default => 'active',
        };
    }

    protected function casts(): array
    {
        return ['assigned_date' => 'date:Y-m-d', 'expected_return_date' => 'date:Y-m-d', 'returned_date' => 'date:Y-m-d'];
    }
}
