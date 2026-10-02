<?php

namespace App\Models;

use App\Models\Concerns\HasPricedLines;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string|null $proposal_number
 * @property Carbon $proposal_date
 * @property Carbon $due_date
 * @property int $customer_id
 * @property int $warehouse_id
 * @property string $subtotal
 * @property string $discount_amount
 * @property string $tax_amount
 * @property string $total_amount
 * @property string $status
 * @property int|null $invoice_id
 * @property string|null $payment_terms
 * @property string|null $notes
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $customer
 * @property-read Warehouse $warehouse
 * @property-read string|null $display_status
 */
#[Fillable(['proposal_date', 'due_date', 'customer_id', 'warehouse_id', 'subtotal', 'discount_amount', 'tax_amount', 'total_amount', 'payment_terms', 'notes'])]
class SalesProposal extends Model
{
    use HasPricedLines;

    public const NUMBER_COLUMN = 'proposal_number';

    public const NUMBER_PREFIX = 'SP';

    public const DATE_COLUMN = 'proposal_date';

    public const STATUSES = ['draft', 'sent', 'accepted', 'rejected'];

    /** New documents start as drafts in memory too, not only in the database default. */
    protected $attributes = ['status' => 'draft'];

    protected $appends = ['display_status'];

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
     * @return HasMany<SalesProposalItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(SalesProposalItem::class, 'proposal_id');
    }

    /**
     * Proposals the user may see: everything with manage-any, else the ones addressed to them (client portal).
     *
     * @param  Builder<SalesProposal>  $query
     * @return Builder<SalesProposal>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->can('manage-any-sales-proposals') ? $query : $query->where('customer_id', $user->id);
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->can('manage-any-sales-proposals') || $this->customer_id === $user->id;
    }

    /**
     * Overdue is worked out from the due date, never stored: a draft or sent proposal past its due date.
     */
    public function getDisplayStatusAttribute(): ?string
    {
        if (! array_key_exists('status', $this->attributes) || ! array_key_exists('due_date', $this->attributes)) {
            return null;
        }

        return in_array($this->status, ['draft', 'sent'], true) && $this->due_date->isBefore(today())
            ? 'overdue'
            : $this->status;
    }

    protected function casts(): array
    {
        return [
            'proposal_date' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }
}
