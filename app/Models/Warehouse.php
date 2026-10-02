<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property string|null $address
 * @property string|null $city
 * @property string|null $zip_code
 * @property string|null $phone
 * @property string|null $email
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'address', 'city', 'zip_code', 'phone', 'email', 'is_active'])]
class Warehouse extends Model
{
    /**
     * @return HasMany<WarehouseStock, $this>
     */
    public function stocks(): HasMany
    {
        return $this->hasMany(WarehouseStock::class);
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
