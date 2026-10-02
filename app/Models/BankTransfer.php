<?php

namespace App\Models;

use App\Support\Ledger;
use App\Support\LedgerAccounts;
use App\Support\Money;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Money moved between two of the company's bank accounts: pending → completed.
 * Processing posts Dr receiving bank (amount) / Dr Bank Charges (fees) / Cr sending bank (amount + fees).
 *
 * @property int $id
 * @property string|null $transfer_number
 * @property Carbon $transfer_date
 * @property int $from_account_id
 * @property int $to_account_id
 * @property string $transfer_amount
 * @property string $transfer_charges
 * @property string|null $reference_number
 * @property string|null $description
 * @property string $status
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read BankAccount $fromAccount
 * @property-read BankAccount $toAccount
 */
#[Fillable(['transfer_date', 'from_account_id', 'to_account_id', 'transfer_amount', 'transfer_charges', 'reference_number', 'description'])]
class BankTransfer extends Model
{
    public const STATUSES = ['pending', 'completed'];

    protected $attributes = ['status' => 'pending', 'transfer_charges' => '0.00'];

    /**
     * @return BelongsTo<BankAccount, $this>
     */
    public function fromAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'from_account_id');
    }

    /**
     * @return BelongsTo<BankAccount, $this>
     */
    public function toAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'to_account_id');
    }

    public function assignNumber(): void
    {
        $this->forceFill(['transfer_number' => sprintf('BT-%s-%03d', $this->transfer_date->format('Y-m'), $this->id)])->save();
    }

    /**
     * Pending → completed: the money leaves one account and arrives in the other.
     */
    public function process(): void
    {
        if ($this->status !== 'pending') {
            throw ValidationException::withMessages(['status' => __('Only pending transfers can be processed.')]);
        }

        DB::transaction(function () {
            $this->load('fromAccount', 'toAccount');
            $charges = Money::toCents($this->transfer_charges);
            $lines = [
                ['account_id' => $this->toAccount->gl_account_id, 'debit' => $this->transfer_amount, 'description' => __('Transfer received from :name', ['name' => $this->fromAccount->account_name])],
                ['account_id' => $this->fromAccount->gl_account_id, 'credit' => Money::format(Money::toCents($this->transfer_amount) + $charges), 'description' => __('Transfer sent to :name', ['name' => $this->toAccount->account_name])],
            ];

            if ($charges > 0) {
                $lines[] = ['account_id' => LedgerAccounts::id(LedgerAccounts::BANK_CHARGES), 'debit' => $this->transfer_charges, 'description' => __('Bank transfer charges')];
            }

            Ledger::post($this->transfer_date->format('Y-m-d'), __('Bank Transfer #:number', ['number' => $this->transfer_number]), $lines, $this);

            $this->forceFill(['status' => 'completed'])->save();
        });
    }

    protected function casts(): array
    {
        return [
            'transfer_date' => 'date:Y-m-d',
            'transfer_amount' => 'decimal:2',
            'transfer_charges' => 'decimal:2',
        ];
    }
}
