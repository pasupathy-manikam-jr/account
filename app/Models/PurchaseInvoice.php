<?php

namespace App\Models;

use App\Models\Concerns\HasPricedLines;
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
 * A vendor's bill for stock received into a warehouse: draft → posted → partial / paid.
 *
 * @property int $id
 * @property string|null $invoice_number
 * @property Carbon $invoice_date
 * @property Carbon $due_date
 * @property int $vendor_id
 * @property int $warehouse_id
 * @property string $subtotal
 * @property string $discount_amount
 * @property string $tax_amount
 * @property string $total_amount
 * @property string $paid_amount
 * @property string $status
 * @property string|null $payment_terms
 * @property string|null $notes
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $vendor
 * @property-read Warehouse $warehouse
 * @property-read string|null $balance_amount
 * @property-read string|null $display_status
 */
#[Fillable(['invoice_date', 'due_date', 'vendor_id', 'warehouse_id', 'subtotal', 'discount_amount', 'tax_amount', 'total_amount', 'payment_terms', 'notes'])]
class PurchaseInvoice extends Model
{
    use HasPricedLines;

    public const NUMBER_COLUMN = 'invoice_number';

    public const NUMBER_PREFIX = 'PI';

    public const DATE_COLUMN = 'invoice_date';

    public const STATUSES = ['draft', 'posted', 'partial', 'paid'];

    /** New bills start as drafts in memory too, not only in the database default. */
    protected $attributes = ['status' => 'draft', 'paid_amount' => '0.00'];

    protected $appends = ['balance_amount', 'display_status'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function vendor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'vendor_id');
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /**
     * @return HasMany<PurchaseInvoiceItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(PurchaseInvoiceItem::class, 'invoice_id');
    }

    /**
     * Bills the user may see: everything with manage-any, else the ones they issued (vendor portal).
     *
     * @param  Builder<PurchaseInvoice>  $query
     * @return Builder<PurchaseInvoice>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->can('manage-any-purchase-invoices') ? $query : $query->where('vendor_id', $user->id);
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->can('manage-any-purchase-invoices') || $this->vendor_id === $user->id;
    }

    public function getBalanceAmountAttribute(): ?string
    {
        if (! array_key_exists('total_amount', $this->attributes)) {
            return null;
        }

        return Money::format(Money::toCents($this->total_amount) - Money::toCents($this->paid_amount));
    }

    public function getDisplayStatusAttribute(): ?string
    {
        if (! array_key_exists('status', $this->attributes) || ! array_key_exists('due_date', $this->attributes)) {
            return null;
        }

        return in_array($this->status, ['posted', 'partial'], true) && $this->due_date->isBefore(today())
            ? 'overdue'
            : $this->status;
    }

    /**
     * Post a draft: receive the goods into the warehouse and record what is owed.
     *
     * Dr Inventory (net of discount) / Dr Tax Receivable (input tax) / Cr Accounts Payable (total).
     */
    public function post(): void
    {
        if ($this->status !== 'draft') {
            throw ValidationException::withMessages(['status' => __('Only draft invoices can be posted.')]);
        }

        DB::transaction(function () {
            $this->load('items', 'vendor:id,name');

            foreach ($this->items as $line) {
                $stock = WarehouseStock::query()->lockForUpdate()->firstOrCreate(
                    ['item_id' => $line->item_id, 'warehouse_id' => $this->warehouse_id],
                    ['quantity' => 0],
                );
                $stock->update(['quantity' => Money::format(Money::toCents($stock->quantity) + Money::toCents($line->quantity))]);
            }

            $net = Money::toCents($this->subtotal) - Money::toCents($this->discount_amount);
            $lines = [
                ['account_id' => LedgerAccounts::id(LedgerAccounts::INVENTORY), 'debit' => Money::format($net), 'description' => __('Purchase from :name', ['name' => $this->vendor->name])],
                ['account_id' => LedgerAccounts::id(LedgerAccounts::ACCOUNTS_PAYABLE), 'credit' => $this->total_amount, 'description' => __('Owed to :name', ['name' => $this->vendor->name])],
            ];

            if (Money::toCents($this->tax_amount) > 0) {
                $lines[] = ['account_id' => LedgerAccounts::id(LedgerAccounts::TAX_RECEIVABLE), 'debit' => $this->tax_amount, 'description' => __('Purchase tax paid')];
            }

            Ledger::post($this->invoice_date->format('Y-m-d'), __('Purchase Invoice #:number', ['number' => $this->invoice_number]), $lines, $this);

            $this->forceFill(['status' => 'posted'])->save();
        });
    }

    protected function casts(): array
    {
        return [
            'invoice_date' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
        ];
    }
}
