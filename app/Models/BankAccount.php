<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $account_number
 * @property string $account_name
 * @property string $bank_name
 * @property string|null $branch_name
 * @property string $account_type
 * @property string $opening_balance
 * @property string|null $iban
 * @property string|null $swift_code
 * @property string|null $routing_number
 * @property bool $is_active
 * @property int $gl_account_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read ChartOfAccount $glAccount
 */
#[Fillable(['account_number', 'account_name', 'bank_name', 'branch_name', 'account_type', 'opening_balance', 'iban', 'swift_code', 'routing_number', 'is_active', 'gl_account_id'])]
class BankAccount extends Model
{
    public const TYPES = ['checking', 'savings', 'credit', 'loan'];

    /**
     * @return BelongsTo<ChartOfAccount, $this>
     */
    public function glAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'gl_account_id');
    }

    /** Types that hold the company's own money; credit lines and loans are owed, not cash. */
    public const CASH_TYPES = ['checking', 'savings'];

    /**
     * The ledger is the single record of money: a bank's opening balance is its GL account's
     * opening balance, so trial balances and reports see it too.
     */
    protected static function booted(): void
    {
        static::saved(function (BankAccount $bank) {
            if ($bank->wasChanged('gl_account_id') && $old = $bank->getOriginal('gl_account_id')) {
                ChartOfAccount::query()->whereKey($old)->update(['opening_balance' => 0]);
            }

            ChartOfAccount::query()->whereKey($bank->gl_account_id)->update(['opening_balance' => $bank->opening_balance]);
        });

        static::deleted(fn (BankAccount $bank) => ChartOfAccount::query()->whereKey($bank->gl_account_id)->update(['opening_balance' => 0]));
    }

    /**
     * The bank's GL account balance: opening balance plus everything posted (load glAccount with withTotals()).
     */
    public function currentBalance(): string
    {
        return $this->glAccount->currentBalance();
    }

    protected function casts(): array
    {
        return [
            'opening_balance' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
