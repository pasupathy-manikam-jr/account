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
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * @property int $id
 * @property string|null $invoice_number
 * @property Carbon $invoice_date
 * @property Carbon $due_date
 * @property int $customer_id
 * @property string $type
 * @property int|null $warehouse_id
 * @property int|null $retainer_id
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
 * @property-read User $customer
 * @property-read Warehouse|null $warehouse
 * @property-read string|null $balance_amount
 * @property-read string|null $display_status
 */
#[Fillable(['invoice_date', 'due_date', 'customer_id', 'type', 'warehouse_id', 'subtotal', 'discount_amount', 'tax_amount', 'total_amount', 'payment_terms', 'notes'])]
class SalesInvoice extends Model
{
    use HasPricedLines;

    public const NUMBER_COLUMN = 'invoice_number';

    public const NUMBER_PREFIX = 'SI';

    public const DATE_COLUMN = 'invoice_date';

    public const STATUSES = ['draft', 'posted', 'partial', 'paid'];

    public const TYPES = ['product', 'service'];

    /** New documents start as drafts in memory too, not only in the database default. */
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
     * @return HasMany<SalesInvoiceItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(SalesInvoiceItem::class, 'invoice_id');
    }

    /**
     * @return MorphMany<JournalEntry, $this>
     */
    public function journalEntries(): MorphMany
    {
        return $this->morphMany(JournalEntry::class, 'reference');
    }

    /**
     * Invoices the user may see: everything with manage-any, else the ones billed to them (client portal).
     *
     * @param  Builder<SalesInvoice>  $query
     * @return Builder<SalesInvoice>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->can('manage-any-sales-invoices') ? $query : $query->where('customer_id', $user->id);
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->can('manage-any-sales-invoices') || $this->customer_id === $user->id;
    }

    /** Null when the invoice was loaded without its amounts (e.g. a column-limited relation). */
    public function getBalanceAmountAttribute(): ?string
    {
        if (! array_key_exists('total_amount', $this->attributes)) {
            return null;
        }

        return Money::format(Money::toCents($this->total_amount) - Money::toCents($this->paid_amount));
    }

    /**
     * Overdue is worked out from the due date: posted or part-paid, with money still owed after it.
     */
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
     * Post a draft: take product stock out of the warehouse and write the ledger entries.
     *
     * Revenue: Dr Accounts Receivable (total) / Cr Sales or Service Revenue (net of discount) / Cr SST Payable (tax).
     * Product invoices also post their cost: Dr Cost of Goods Sold / Cr Inventory at purchase price.
     */
    public function post(): void
    {
        if ($this->status !== 'draft') {
            throw ValidationException::withMessages(['status' => __('Only draft invoices can be posted.')]);
        }

        DB::transaction(function () {
            $this->load('items.item', 'customer:id,name');
            $cost = 0;

            if ($this->type === 'product') {
                foreach ($this->items as $line) {
                    if ($line->item->type === 'service') {
                        continue;
                    }

                    $stock = WarehouseStock::query()->lockForUpdate()
                        ->firstWhere(['item_id' => $line->item_id, 'warehouse_id' => $this->warehouse_id]);

                    if (! $stock || Money::toCents($stock->quantity) < Money::toCents($line->quantity)) {
                        throw ValidationException::withMessages(['status' => __('Not enough stock of :item in this warehouse (:available available).', [
                            'item' => $line->item->name,
                            'available' => rtrim(rtrim($stock->quantity ?? '0', '0'), '.') ?: '0',
                        ])]);
                    }

                    $stock->update(['quantity' => Money::format(Money::toCents($stock->quantity) - Money::toCents($line->quantity))]);
                    $cost += intdiv(Money::toCents($line->quantity) * Money::toCents($line->item->purchase_price) + 50, 100);
                }
            }

            $net = Money::toCents($this->subtotal) - Money::toCents($this->discount_amount);
            $lines = [
                ['account_id' => LedgerAccounts::id(LedgerAccounts::ACCOUNTS_RECEIVABLE), 'debit' => $this->total_amount, 'description' => __('Billed to :name', ['name' => $this->customer->name])],
                ['account_id' => LedgerAccounts::id($this->type === 'service' ? LedgerAccounts::SERVICE_REVENUE : LedgerAccounts::SALES_REVENUE), 'credit' => Money::format($net), 'description' => $this->type === 'service' ? __('Service revenue') : __('Product sales')],
            ];

            if (Money::toCents($this->tax_amount) > 0) {
                $lines[] = ['account_id' => LedgerAccounts::id(LedgerAccounts::SST_PAYABLE), 'credit' => $this->tax_amount, 'description' => __('Sales tax collected')];
            }

            $date = $this->invoice_date->format('Y-m-d');
            Ledger::post($date, __('Sales Invoice #:number', ['number' => $this->invoice_number]), $lines, $this);

            if ($cost > 0) {
                Ledger::post($date, __('Cost of goods sold for Sales Invoice #:number', ['number' => $this->invoice_number]), [
                    ['account_id' => LedgerAccounts::id(LedgerAccounts::COST_OF_GOODS_SOLD), 'debit' => Money::format($cost), 'description' => __('Cost of goods sold')],
                    ['account_id' => LedgerAccounts::id(LedgerAccounts::INVENTORY), 'credit' => Money::format($cost), 'description' => __('Inventory reduction')],
                ], $this);
            }

            $status = 'posted';
            $paid = 0;

            // An invoice converted from a retainer is settled by the deposits already held for it.
            if ($this->retainer_id !== null && ($retainer = Retainer::query()->find($this->retainer_id)) !== null) {
                $paid = min(Money::toCents($retainer->paid_amount), Money::toCents($this->total_amount));

                if ($paid > 0) {
                    Ledger::post($date, __('Retainer deposit applied to Sales Invoice #:number', ['number' => $this->invoice_number]), [
                        ['account_id' => LedgerAccounts::id(LedgerAccounts::CUSTOMER_DEPOSITS), 'debit' => Money::format($paid), 'description' => __('Deposit from retainer :number', ['number' => $retainer->retainer_number])],
                        ['account_id' => LedgerAccounts::id(LedgerAccounts::ACCOUNTS_RECEIVABLE), 'credit' => Money::format($paid), 'description' => __('Settled by retainer deposit')],
                    ], $this);
                    $status = $paid >= Money::toCents($this->total_amount) ? 'paid' : 'partial';
                }
            }

            $this->forceFill(['status' => $status, 'paid_amount' => Money::format($paid)])->save();
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
