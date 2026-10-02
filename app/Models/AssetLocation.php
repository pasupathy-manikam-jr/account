<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property string $code
 * @property string $type
 * @property int|null $parent_id
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read AssetLocation|null $parent
 */
#[Fillable(['name', 'code', 'type', 'parent_id', 'is_active'])]
class AssetLocation extends Model
{
    public const TYPES = ['building', 'floor', 'room', 'warehouse', 'site'];

    /**
     * @return BelongsTo<AssetLocation, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /**
     * @return HasMany<AssetLocation, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    /**
     * @return HasMany<Asset, $this>
     */
    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class, 'location_id');
    }

    /**
     * Ids of this location and every location under it, so a parent can't be moved beneath its own child.
     *
     * @return list<int>
     */
    public function selfAndDescendantIds(): array
    {
        $ids = [$this->id];
        $level = [$this->id];

        while ($level !== []) {
            $level = array_values(self::query()->whereIn('parent_id', $level)->pluck('id')->map(fn ($id) => (int) $id)->all());
            $ids = [...$ids, ...$level];
        }

        return $ids;
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
