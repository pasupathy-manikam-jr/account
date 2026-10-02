<?php

namespace App\Models;

use App\Models\Concerns\HasPricedLines;
use App\Support\Money;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * An advance billing agreement: quoted like a proposal (draft → sent → accepted/rejected), paid in advance
 * through retainer payments (→ partial/paid), and finally converted into an invoice the deposits settle.
 *
 * @property int $id
 * @property string|null $retainer_number
 * @property Carbon $retainer_date
 * @property Carbon $due_date
 * @property int $customer_id
 * @property int $warehouse_id
 * @property string $subtotal
 * @property string $discount_amount
 * @property string $tax_amount
 * @property string $total_amount
 * @property string $paid_amount
 * @property string $status
 * @property int|null $invoice_id
 * @property string|null $payment_terms
 * @property string|null $notes
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $customer
 * @property-read Warehouse $warehouse
 * @property-read SalesInvoice|null $invoice
 * @property-read string|null $balance_amount
 * @property-read string|null $display_status
 */
#[Fillable(['retainer_date', 'due_date', 'customer_id', 'warehouse_id', 'subtotal', 'discount_amount', 'tax_amount', 'total_amount', 'payment_terms', 'notes'])]
class Retainer extends Model
{
    use HasPricedLines;

    public const NUMBER_COLUMN = 'retainer_number';

    public const NUMBER_PREFIX = 'RET';

    public const DATE_COLUMN = 'retainer_date';

    public const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'partial', 'paid'];

    /** Retainers that can still take a deposit. */
    public const PAYABLE = ['sent', 'accepted', 'partial'];

    /** New retainers start as drafts in memory too, not only in the database default. */
    protected $attributes = ['status' => 'draft', 'paid_amount' => '0.00'];

    protected $appends = ['balance_amount', 'display_status'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /**
     * @return BelongsTo<SalesInvoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(SalesInvoice::class);
    }

    /**
     * @return HasMany<RetainerItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(RetainerItem::class);
    }

    /**
     * @return HasMany<RetainerPaymentAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(RetainerPaymentAllocation::class);
    }

    /**
     * @param  Builder<Retainer>  $query
     * @return Builder<Retainer>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->can('manage-any-retainer') ? $query : $query->where('customer_id', $user->id);
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->can('manage-any-retainer') || $this->customer_id === $user->id;
    }

    public function getBalanceAmountAttribute(): ?string
    {
        if (! array_key_exists('total_amount', $this->attributes)) {
            return null;
        }

        return Money::format(Money::toCents($this->total_amount) - Money::toCents($this->paid_amount));
    }

    /**
     * Overdue is worked out from the due date: still awaiting a decision or money after it.
     */
    public function getDisplayStatusAttribute(): ?string
    {
        if (! array_key_exists('status', $this->attributes) || ! array_key_exists('due_date', $this->attributes)) {
            return null;
        }

        return in_array($this->status, ['draft', 'sent', 'accepted', 'partial'], true) && $this->due_date->isBefore(today())
            ? 'overdue'
            : $this->status;
    }

    /**
     * Add a cleared deposit (or take a cancelled one back) and move between accepted / partial / paid.
     */
    public function addPayment(int $cents): void
    {
        $paid = Money::toCents($this->paid_amount) + $cents;
        $status = match (true) {
            $paid >= Money::toCents($this->total_amount) => 'paid',
            $paid > 0 => 'partial',
            default => 'accepted',
        };

        $this->forceFill(['paid_amount' => Money::format($paid), 'status' => $status])->save();
    }

    protected function casts(): array
    {
        return [
            'retainer_date' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
        ];
    }
}
