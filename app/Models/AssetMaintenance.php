<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * A service job on an asset: scheduled → in_progress → completed, or cancelled before it is done.
 *
 * @property int $id
 * @property int $asset_id
 * @property string $title
 * @property string $maintenance_type
 * @property string $priority
 * @property Carbon $scheduled_date
 * @property Carbon|null $completed_date
 * @property string $status
 * @property string $cost
 * @property string|null $technician
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Asset $asset
 */
#[Fillable(['asset_id', 'title', 'maintenance_type', 'priority', 'scheduled_date', 'cost', 'technician', 'notes'])]
class AssetMaintenance extends Model
{
    public const STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];

    public const TYPES = ['preventive', 'corrective', 'emergency'];

    public const PRIORITIES = ['low', 'medium', 'high', 'critical'];

    /** action => [allowed from, to] */
    public const TRANSITIONS = ['start' => [['scheduled'], 'in_progress'], 'complete' => [['scheduled', 'in_progress'], 'completed'], 'cancel' => [['scheduled', 'in_progress'], 'cancelled']];

    protected $attributes = ['status' => 'scheduled', 'priority' => 'medium', 'cost' => '0.00'];

    /**
     * @return BelongsTo<Asset, $this>
     */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function transition(string $action): void
    {
        [$from, $to] = self::TRANSITIONS[$action];

        if (! in_array($this->status, $from, true)) {
            throw ValidationException::withMessages(['status' => __('This maintenance is :status and cannot be changed that way.', ['status' => __(str_replace('_', ' ', $this->status))])]);
        }

        $this->forceFill(['status' => $to] + ($to === 'completed' ? ['completed_date' => today()] : []))->save();
    }

    protected function casts(): array
    {
        return ['scheduled_date' => 'date:Y-m-d', 'completed_date' => 'date:Y-m-d', 'cost' => 'decimal:2'];
    }
}
