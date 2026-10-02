<?php

namespace App\Models;

use App\Support\Money;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * A register entry: one item or a lot of identical items (quantity) bought together.
 *
 * @property int $id
 * @property string $name
 * @property string $serial_code
 * @property int $category_id
 * @property int|null $location_id
 * @property string|null $description
 * @property Carbon $purchase_date
 * @property int $quantity
 * @property string $unit_price
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read string|null $purchase_cost
 * @property-read string|null $status
 * @property-read AssetCategory $category
 * @property-read AssetLocation|null $location
 * @property-read AssetDepreciation|null $depreciation
 */
#[Fillable(['name', 'serial_code', 'category_id', 'location_id', 'description', 'purchase_date', 'quantity', 'unit_price'])]
class Asset extends Model
{
    public const STATUSES = ['available', 'assigned', 'maintenance'];

    protected $appends = ['purchase_cost', 'status'];

    /**
     * @return BelongsTo<AssetCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class);
    }

    /**
     * @return BelongsTo<AssetLocation, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(AssetLocation::class);
    }

    /**
     * @return HasMany<AssetAssignment, $this>
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(AssetAssignment::class);
    }

    /**
     * @return HasMany<AssetMaintenance, $this>
     */
    public function maintenances(): HasMany
    {
        return $this->hasMany(AssetMaintenance::class);
    }

    /**
     * @return HasOne<AssetDepreciation, $this>
     */
    public function depreciation(): HasOne
    {
        return $this->hasOne(AssetDepreciation::class);
    }

    /**
     * The counts the status needs: items handed out and maintenance under way.
     *
     * @param  Builder<Asset>  $query
     * @return Builder<Asset>
     */
    public function scopeWithStatusCounts(Builder $query): Builder
    {
        return $query->withCount([
            'assignments as out_count' => fn (Builder $q) => $q->whereNull('returned_date'),
            'maintenances as repair_count' => fn (Builder $q) => $q->where('status', 'in_progress'),
        ]);
    }

    /**
     * Status filter matching getStatusAttribute(): in maintenance wins, then fully handed out.
     *
     * @param  Builder<Asset>  $query
     * @return Builder<Asset>
     */
    public function scopeWhereStatus(Builder $query, string $status): Builder
    {
        $repair = fn (Builder $q) => $q->where('status', 'in_progress');
        $handedOut = fn (Builder $q) => $q->whereRaw('(select count(*) from asset_assignments where asset_assignments.asset_id = assets.id and returned_date is null) >= assets.quantity');

        return match ($status) {
            'maintenance' => $query->whereHas('maintenances', $repair),
            'assigned' => $query->whereDoesntHave('maintenances', $repair)->where($handedOut),
            default => $query->whereDoesntHave('maintenances', $repair)->whereNot($handedOut),
        };
    }

    /** Null when loaded without its price columns. */
    public function getPurchaseCostAttribute(): ?string
    {
        if (! array_key_exists('unit_price', $this->attributes) || ! array_key_exists('quantity', $this->attributes)) {
            return null;
        }

        return Money::format(Money::toCents($this->unit_price) * (int) $this->quantity);
    }

    /** Needs withStatusCounts(); null otherwise. */
    public function getStatusAttribute(): ?string
    {
        if (! array_key_exists('out_count', $this->attributes)) {
            return null;
        }

        return match (true) {
            (int) $this->attributes['repair_count'] > 0 => 'maintenance',
            (int) $this->attributes['out_count'] >= (int) $this->quantity => 'assigned',
            default => 'available',
        };
    }

    protected function casts(): array
    {
        return ['purchase_date' => 'date:Y-m-d', 'unit_price' => 'decimal:2', 'quantity' => 'integer'];
    }
}
