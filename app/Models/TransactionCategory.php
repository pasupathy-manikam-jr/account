<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A revenue or expense category (System Setup) and the ledger account its entries post to.
 *
 * @property int $id
 * @property string $kind
 * @property string $category_name
 * @property string $category_code
 * @property int $gl_account_id
 * @property string|null $description
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read ChartOfAccount $glAccount
 */
#[Fillable(['category_name', 'category_code', 'gl_account_id', 'description', 'is_active'])]
class TransactionCategory extends Model
{
    public const KINDS = ['revenue', 'expense'];

    /** The account category a kind's ledger accounts must belong to. */
    public const ACCOUNT_CATEGORY = ['revenue' => 'revenue', 'expense' => 'expenses'];

    /**
     * @return BelongsTo<ChartOfAccount, $this>
     */
    public function glAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'gl_account_id');
    }

    /**
     * @return HasMany<CashEntry, $this>
     */
    public function entries(): HasMany
    {
        return $this->hasMany(CashEntry::class, 'category_id');
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
