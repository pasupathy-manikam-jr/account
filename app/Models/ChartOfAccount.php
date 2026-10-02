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
 * @property int $id
 * @property string $account_code
 * @property string $account_name
 * @property int $account_type_id
 * @property int|null $parent_account_id
 * @property int $level
 * @property string $normal_balance
 * @property string $opening_balance
 * @property string|null $description
 * @property bool $is_active
 * @property bool $is_system_account
 * @property string|null $debit_total
 * @property string|null $credit_total
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read AccountType $accountType
 * @property-read ChartOfAccount|null $parentAccount
 */
#[Fillable(['account_code', 'account_name', 'account_type_id', 'parent_account_id', 'level', 'normal_balance', 'opening_balance', 'description', 'is_active'])]
class ChartOfAccount extends Model
{
    /**
     * @return BelongsTo<AccountType, $this>
     */
    public function accountType(): BelongsTo
    {
        return $this->belongsTo(AccountType::class);
    }

    /**
     * @return BelongsTo<ChartOfAccount, $this>
     */
    public function parentAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'parent_account_id');
    }

    /**
     * @return HasMany<ChartOfAccount, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(ChartOfAccount::class, 'parent_account_id');
    }

    /**
     * @return HasMany<JournalEntryItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(JournalEntryItem::class, 'account_id');
    }

    /**
     * @return HasOne<BankAccount, $this>
     */
    public function bankAccount(): HasOne
    {
        return $this->hasOne(BankAccount::class, 'gl_account_id');
    }

    /**
     * Load the posted debit and credit totals that currentBalance() needs.
     *
     * @param  Builder<ChartOfAccount>  $query
     * @return Builder<ChartOfAccount>
     */
    public function scopeWithTotals(Builder $query): Builder
    {
        return $query
            ->withSum('items as debit_total', 'debit_amount')
            ->withSum('items as credit_total', 'credit_amount');
    }

    /**
     * Net movement on the account's normal side, in cents (needs withTotals()).
     */
    public function movementCents(): int
    {
        $net = Money::toCents($this->debit_total) - Money::toCents($this->credit_total);

        return $this->normal_balance === 'debit' ? $net : -$net;
    }

    /**
     * Opening balance plus everything posted, on the account's normal side (needs withTotals()).
     */
    public function currentBalance(): string
    {
        return Money::format(Money::toCents($this->opening_balance) + $this->movementCents());
    }

    protected function casts(): array
    {
        return [
            'opening_balance' => 'decimal:2',
            'is_active' => 'boolean',
            'is_system_account' => 'boolean',
        ];
    }
}
