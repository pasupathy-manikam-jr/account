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
 * Money the vendor owes back (or no longer owed to them), raised by a completed purchase return.
 * draft → approved (posted to the ledger) → partial / applied as vendor payments use it.
 *
 * @property int $id
 * @property string|null $debit_note_number
 * @property Carbon $debit_note_date
 * @property int $vendor_id
 * @property int $invoice_id
 * @property int|null $return_id
 * @property string $reason
 * @property string $subtotal
 * @property string $discount_amount
 * @property string $tax_amount
 * @property string $total_amount
 * @property string $applied_amount
 * @property string $status
 * @property string|null $notes
 * @property int|null $approved_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $vendor
 * @property-read PurchaseInvoice $invoice
 * @property-read PurchaseReturn|null $purchaseReturn
 * @property-read string|null $balance_amount
 */
#[Fillable(['debit_note_date', 'vendor_id', 'invoice_id', 'reason', 'notes'])]
class DebitNote extends Model
{
    public const STATUSES = ['draft', 'approved', 'partial', 'applied'];

    protected $attributes = ['status' => 'draft', 'applied_amount' => '0.00'];

    protected $appends = ['balance_amount'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function vendor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'vendor_id');
    }

    /**
     * @return BelongsTo<PurchaseInvoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(PurchaseInvoice::class, 'invoice_id');
    }

    /**
     * @return BelongsTo<PurchaseReturn, $this>
     */
    public function purchaseReturn(): BelongsTo
    {
        return $this->belongsTo(PurchaseReturn::class, 'return_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * @return HasMany<DebitNoteItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(DebitNoteItem::class);
    }

    /**
     * Debit notes the user may see: everything with manage-any, else their own (client portal).
     *
     * @param  Builder<DebitNote>  $query
     * @return Builder<DebitNote>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->can('manage-any-debit-notes') ? $query : $query->where('vendor_id', $user->id);
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->can('manage-any-debit-notes') || $this->vendor_id === $user->id;
    }

    public function getBalanceAmountAttribute(): ?string
    {
        if (! array_key_exists('total_amount', $this->attributes)) {
            return null;
        }

        return Money::format(Money::toCents($this->total_amount) - Money::toCents($this->applied_amount));
    }

    /**
     * Draft → approved: reduce what is owed to the vendor for the goods sent back.
     *
     * Dr Accounts Payable (total) / Cr Inventory (net of discount) / Cr Tax Receivable (input tax reversed).
     */
    public function approve(User $approver): void
    {
        if ($this->status !== 'draft') {
            throw ValidationException::withMessages(['status' => __('Only draft debit notes can be approved.')]);
        }

        DB::transaction(function () use ($approver) {
            $this->load('vendor:id,name');
            $net = Money::toCents($this->subtotal) - Money::toCents($this->discount_amount);

            $lines = [
                ['account_id' => LedgerAccounts::id(LedgerAccounts::ACCOUNTS_PAYABLE), 'debit' => $this->total_amount, 'description' => __('Debit note for :name', ['name' => $this->vendor->name])],
                ['account_id' => LedgerAccounts::id(LedgerAccounts::INVENTORY), 'credit' => Money::format($net), 'description' => __('Goods returned to vendor')],
            ];

            if (Money::toCents($this->tax_amount) > 0) {
                $lines[] = ['account_id' => LedgerAccounts::id(LedgerAccounts::TAX_RECEIVABLE), 'credit' => $this->tax_amount, 'description' => __('Tax credit from debit note')];
            }

            Ledger::post($this->debit_note_date->format('Y-m-d'), __('Debit Note #:number', ['number' => $this->debit_note_number]), $lines, $this);

            $this->forceFill(['status' => 'approved', 'approved_by' => $approver->id])->save();
        });
    }

    protected function casts(): array
    {
        return [
            'debit_note_date' => 'date:Y-m-d',
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'applied_amount' => 'decimal:2',
        ];
    }
}
