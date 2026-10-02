<?php

namespace App\Models;

use App\Support\Ledger;
use App\Support\LedgerAccounts;
use App\Support\Money;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A customer's advance payment against one or more retainers: pending → cleared or cancelled.
 * Clearing banks the money as a customer deposit (Dr bank / Cr Customer Deposits) and credits the retainers.
 *
 * @property int $id
 * @property string|null $payment_number
 * @property Carbon $payment_date
 * @property int $customer_id
 * @property int $bank_account_id
 * @property string $payment_amount
 * @property string|null $reference_number
 * @property string $status
 * @property string|null $notes
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $customer
 * @property-read BankAccount $bankAccount
 */
#[Fillable(['payment_date', 'customer_id', 'bank_account_id', 'payment_amount', 'reference_number', 'notes'])]
class RetainerPayment extends Model
{
    public const STATUSES = ['pending', 'cleared', 'cancelled'];

    protected $attributes = ['status' => 'pending'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    /**
     * @return BelongsTo<BankAccount, $this>
     */
    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    /**
     * @return HasMany<RetainerPaymentAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(RetainerPaymentAllocation::class, 'payment_id');
    }

    /**
     * @param  Builder<RetainerPayment>  $query
     * @return Builder<RetainerPayment>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->can('manage-any-retainer-payments') ? $query : $query->where('customer_id', $user->id);
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->can('manage-any-retainer-payments') || $this->customer_id === $user->id;
    }

    /**
     * Pending → cleared: the money is in the bank. Posts the deposit and credits each allocated retainer.
     */
    public function clear(): void
    {
        $this->expect('pending');

        DB::transaction(function () {
            $this->load('allocations.retainer', 'bankAccount', 'customer:id,name');

            foreach ($this->allocations as $allocation) {
                $retainer = Retainer::query()->lockForUpdate()->findOrFail($allocation->retainer_id);

                if (Money::toCents($allocation->allocated_amount) > Money::toCents((string) $retainer->balance_amount)) {
                    throw ValidationException::withMessages(['status' => __('Retainer :number has only :balance left to pay.', [
                        'number' => $retainer->retainer_number,
                        'balance' => $retainer->balance_amount,
                    ])]);
                }

                $retainer->addPayment(Money::toCents($allocation->allocated_amount));
            }

            Ledger::post($this->payment_date->format('Y-m-d'), __('Retainer Payment #:number', ['number' => $this->payment_number]), [
                ['account_id' => $this->bankAccount->gl_account_id, 'debit' => $this->payment_amount, 'description' => __('Deposit from :name', ['name' => $this->customer->name])],
                ['account_id' => LedgerAccounts::id(LedgerAccounts::CUSTOMER_DEPOSITS), 'credit' => $this->payment_amount, 'description' => __('Customer deposit held')],
            ], $this);

            $this->forceFill(['status' => 'cleared'])->save();
        });
    }

    /** Pending → cancelled: nothing was banked, so nothing to reverse. */
    public function cancel(): void
    {
        $this->expect('pending');
        $this->forceFill(['status' => 'cancelled'])->save();
    }

    private function expect(string $status): void
    {
        if ($this->status !== $status) {
            throw ValidationException::withMessages(['status' => __('Only pending payments can be cleared or cancelled.')]);
        }
    }

    protected function casts(): array
    {
        return [
            'payment_date' => 'date:Y-m-d',
            'payment_amount' => 'decimal:2',
        ];
    }
}
