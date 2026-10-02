<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $tax_name
 * @property string $rate
 * @property string|null $type_code LHDN tax type (01 sales, 02 service, 06 not applicable, E exempt…)
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['tax_name', 'rate', 'type_code'])]
class Tax extends Model
{
    /**
     * @return BelongsToMany<Item, $this>
     */
    public function items(): BelongsToMany
    {
        return $this->belongsToMany(Item::class);
    }

    protected function casts(): array
    {
        return ['rate' => 'decimal:2'];
    }
}
