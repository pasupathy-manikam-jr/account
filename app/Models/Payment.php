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
 * A customer payment (money in against sales invoices) or a vendor payment (money out against bills),
 * pending → cleared or cancelled. Allocations to invoices must equal the cash plus any credit/debit notes
 * applied. Clearing posts the cash (customer: Dr bank / Cr Receivable; vendor: Dr Payable / Cr bank) and
 * settles each document; notes need no entry here because approving them already moved Receivable/Payable.
 *
 * @property int $id
 * @property string $kind
 * @property string|null $payment_number
 * @property Carbon $payment_date
 * @property int $party_id
 * @property int $bank_account_id
 * @property string $payment_amount
 * @property string|null $reference_number
 * @property string $status
 * @property string|null $notes
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $party
 * @property-read BankAccount $bankAccount
 */
#[Fillable(['payment_date', 'party_id', 'bank_account_id', 'payment_amount', 'reference_number', 'notes'])]
class Payment extends Model
{
    public const STATUSES = ['pending', 'cleared', 'cancelled'];

    /** What each kind settles, which notes it can apply, and its permission/number naming. */
    public const KINDS = [
        'customer' => ['prefix' => 'CP', 'invoice' => SalesInvoice::class, 'note' => CreditNote::class, 'party_type' => 'client', 'party_column' => 'customer_id', 'permission' => 'customer-payments'],
        'vendor' => ['prefix' => 'VP', 'invoice' => PurchaseInvoice::class, 'note' => DebitNote::class, 'party_type' => 'vendor', 'party_column' => 'vendor_id', 'permission' => 'vendor-payments'],
    ];

    protected $attributes = ['status' => 'pending'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function party(): BelongsTo
    {
        return $this->belongsTo(User::class, 'party_id');
    }

    /**
     * @return BelongsTo<BankAccount, $this>
     */
    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    /**
     * @return HasMany<PaymentAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }

    /**
     * @return HasMany<PaymentNoteApplication, $this>
     */
    public function noteApplications(): HasMany
    {
        return $this->hasMany(PaymentNoteApplication::class);
    }

    /**
     * @param  Builder<Payment>  $query
     * @return Builder<Payment>
     */
    public function scopeVisibleTo(Builder $query, User $user, string $kind): Builder
    {
        return $user->can('manage-any-'.self::KINDS[$kind]['permission']) ? $query : $query->where('party_id', $user->id);
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->can('manage-any-'.self::KINDS[$this->kind]['permission']) || $this->party_id === $user->id;
    }

    public function assignNumber(): void
    {
        $this->forceFill(['payment_number' => sprintf('%s-%s-%03d', self::KINDS[$this->kind]['prefix'], $this->payment_date->format('Y-m'), $this->id)])->save();
    }

    /**
     * Pending → cleared: post the cash and settle every allocated invoice and applied note.
     */
    public function clear(): void
    {
        $this->expectPending();

        DB::transaction(function () {
            $this->load('allocations', 'noteApplications', 'bankAccount', 'party:id,name');

            foreach ($this->noteApplications as $application) {
                /** @var CreditNote|DebitNote $note */
                $note = $application->note()->lockForUpdate()->firstOrFail();
                $applied = Money::toCents($note->applied_amount) + Money::toCents($application->applied_amount);

                if (! in_array($note->status, ['approved', 'partial'], true) || $applied > Money::toCents($note->total_amount)) {
                    throw ValidationException::withMessages(['status' => __('A note applied to this payment no longer has that much credit left.')]);
                }

                $note->forceFill([
                    'applied_amount' => Money::format($applied),
                    'status' => $applied >= Money::toCents($note->total_amount) ? 'applied' : 'partial',
                ])->save();
            }

            foreach ($this->allocations as $allocation) {
                /** @var SalesInvoice|PurchaseInvoice $invoice */
                $invoice = $allocation->invoice()->lockForUpdate()->firstOrFail();
                $paid = Money::toCents($invoice->paid_amount) + Money::toCents($allocation->allocated_amount);

                if (! in_array($invoice->status, ['posted', 'partial'], true) || $paid > Money::toCents($invoice->total_amount)) {
                    throw ValidationException::withMessages(['status' => __('Invoice :number no longer has that much left to pay.', ['number' => $invoice->invoice_number])]);
                }

                $invoice->forceFill([
                    'paid_amount' => Money::format($paid),
                    'status' => $paid >= Money::toCents($invoice->total_amount) ? 'paid' : 'partial',
                ])->save();
            }

            if (Money::toCents($this->payment_amount) > 0) {
                $customer = $this->kind === 'customer';
                $bank = $this->bankAccount->gl_account_id;
                $other = LedgerAccounts::id($customer ? LedgerAccounts::ACCOUNTS_RECEIVABLE : LedgerAccounts::ACCOUNTS_PAYABLE);
                $title = $customer
                    ? __('Customer Payment #:number', ['number' => $this->payment_number])
                    : __('Vendor Payment #:number', ['number' => $this->payment_number]);

                Ledger::post($this->payment_date->format('Y-m-d'), $title, [
                    ['account_id' => $customer ? $bank : $other, 'debit' => $this->payment_amount, 'description' => $customer ? __('Payment received from :name', ['name' => $this->party->name]) : __('Payment to :name', ['name' => $this->party->name])],
                    ['account_id' => $customer ? $other : $bank, 'credit' => $this->payment_amount, 'description' => $customer ? __('Payment from customer') : __('Payment from :name', ['name' => $this->bankAccount->account_name])],
                ], $this);
            }

            $this->forceFill(['status' => 'cleared'])->save();
        });
    }

    public function cancel(): void
    {
        $this->expectPending();
        $this->forceFill(['status' => 'cancelled'])->save();
    }

    private function expectPending(): void
    {
        if ($this->status !== 'pending') {
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
