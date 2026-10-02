<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property string $code
 * @property string $category
 * @property string $normal_balance
 * @property string|null $description
 * @property bool $is_active
 * @property bool $is_system_type
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'code', 'category', 'normal_balance', 'description', 'is_active'])]
class AccountType extends Model
{
    /** The five account categories, with the side that increases them. */
    public const CATEGORIES = [
        'assets' => 'debit',
        'liabilities' => 'credit',
        'equity' => 'credit',
        'revenue' => 'credit',
        'expenses' => 'debit',
    ];

    public const BALANCES = ['debit', 'credit'];

    /**
     * @return HasMany<ChartOfAccount, $this>
     */
    public function accounts(): HasMany
    {
        return $this->hasMany(ChartOfAccount::class);
    }

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_system_type' => 'boolean',
        ];
    }
}
