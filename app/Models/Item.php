<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property string $name
 * @property string $sku
 * @property string $type
 * @property int $category_id
 * @property int $unit_id
 * @property string $sale_price
 * @property string $purchase_price
 * @property string|null $image
 * @property string|null $description
 * @property string|null $long_description
 * @property bool $is_active
 * @property string|null $total_quantity
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read ItemCategory $category
 * @property-read Unit $unit
 */
#[Fillable(['name', 'sku', 'type', 'category_id', 'unit_id', 'sale_price', 'purchase_price', 'description', 'long_description', 'is_active'])]
class Item extends Model
{
    public const TYPES = ['product', 'service', 'part'];

    /** Types that are held in warehouses; services have no stock. */
    public const STOCKED_TYPES = ['product', 'part'];

    protected $appends = ['image_url'];

    /**
     * @return BelongsTo<ItemCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ItemCategory::class);
    }

    /**
     * @return BelongsTo<Unit, $this>
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /**
     * @return BelongsToMany<Tax, $this>
     */
    public function taxes(): BelongsToMany
    {
        return $this->belongsToMany(Tax::class);
    }

    /**
     * @return HasMany<WarehouseStock, $this>
     */
    public function stocks(): HasMany
    {
        return $this->hasMany(WarehouseStock::class);
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image ? Storage::disk('public')->url($this->image) : null;
    }

    protected function casts(): array
    {
        return [
            'sale_price' => 'decimal:2',
            'purchase_price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
