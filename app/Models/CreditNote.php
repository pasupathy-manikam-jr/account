<?php

namespace App\Models;

use App\Models\Concerns\IssuesEInvoices;
use App\Support\Ledger;
use App\Support\LedgerAccounts;
use App\Support\Money;
use EInvoiceSdk\Contracts\EInvoiceable;
use EInvoiceSdk\Enums\DocumentType;
use EInvoiceSdk\Enums\Status;
use EInvoiceSdk\Models\EInvoiceDocument;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Money owed back to a customer, raised by a completed sales return.
 * draft → approved (posted to the ledger) → partial / applied as customer payments use it.
 *
 * @property int $id
 * @property string|null $credit_note_number
 * @property Carbon $credit_note_date
 * @property int $customer_id
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
 * @property-read User $customer
 * @property-read SalesInvoice $invoice
 * @property-read SalesReturn|null $salesReturn
 * @property-read string|null $balance_amount
 */
#[Fillable(['credit_note_date', 'customer_id', 'invoice_id', 'reason', 'notes'])]
class CreditNote extends Model implements EInvoiceable
{
    use IssuesEInvoices;

    public const STATUSES = ['draft', 'approved', 'partial', 'applied'];

    protected $attributes = ['status' => 'draft', 'applied_amount' => '0.00'];

    protected $appends = ['balance_amount'];

    /** Approved credit notes can go to LHDN once their invoice is a valid e-invoice. */
    public function canSubmitEInvoice(): bool
    {
        return $this->status !== 'draft';
    }

    protected function einvoiceType(): DocumentType
    {
        return DocumentType::CreditNote;
    }

    protected function einvoiceNumber(): string
    {
        return (string) $this->credit_note_number;
    }

    protected function einvoiceOriginal(): ?EInvoiceDocument
    {
        return $this->invoice->einvoiceDocuments()->where('status', Status::Valid)->latest('id')->first();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    /**
     * @return BelongsTo<SalesInvoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(SalesInvoice::class, 'invoice_id');
    }

    /**
     * @return BelongsTo<SalesReturn, $this>
     */
    public function salesReturn(): BelongsTo
    {
        return $this->belongsTo(SalesReturn::class, 'return_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * @return HasMany<CreditNoteItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(CreditNoteItem::class);
    }

    /**
     * Credit notes the user may see: everything with manage-any, else their own (client portal).
     *
     * @param  Builder<CreditNote>  $query
     * @return Builder<CreditNote>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->can('manage-any-credit-notes') ? $query : $query->where('customer_id', $user->id);
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->can('manage-any-credit-notes') || $this->customer_id === $user->id;
    }

    public function getBalanceAmountAttribute(): ?string
    {
        if (! array_key_exists('total_amount', $this->attributes)) {
            return null;
        }

        return Money::format(Money::toCents($this->total_amount) - Money::toCents($this->applied_amount));
    }

    /**
     * Draft → approved: reverse the sale in the ledger.
     *
     * Dr Sales or Service Revenue (net) / Dr SST Payable (tax) / Cr Accounts Receivable (total), and for goods
     * that came back: Dr Inventory / Cr Cost of Goods Sold at purchase price.
     */
    public function approve(User $approver): void
    {
        if ($this->status !== 'draft') {
            throw ValidationException::withMessages(['status' => __('Only draft credit notes can be approved.')]);
        }

        DB::transaction(function () use ($approver) {
            $this->load('items.item', 'invoice:id,type', 'customer:id,name');
            $date = $this->credit_note_date->format('Y-m-d');
            $net = Money::toCents($this->subtotal) - Money::toCents($this->discount_amount);

            $lines = [
                ['account_id' => LedgerAccounts::id($this->invoice->type === 'service' ? LedgerAccounts::SERVICE_REVENUE : LedgerAccounts::SALES_REVENUE), 'debit' => Money::format($net), 'description' => __('Credit note adjustment')],
                ['account_id' => LedgerAccounts::id(LedgerAccounts::ACCOUNTS_RECEIVABLE), 'credit' => $this->total_amount, 'description' => __('Credit note for :name', ['name' => $this->customer->name])],
            ];

            if (Money::toCents($this->tax_amount) > 0) {
                $lines[] = ['account_id' => LedgerAccounts::id(LedgerAccounts::SST_PAYABLE), 'debit' => $this->tax_amount, 'description' => __('Tax reduction from credit note')];
            }

            Ledger::post($date, __('Credit Note #:number', ['number' => $this->credit_note_number]), $lines, $this);

            $cost = $this->items->sum(fn (CreditNoteItem $line) => $line->item->type === 'service'
                ? 0
                : intdiv(Money::toCents($line->quantity) * Money::toCents($line->item->purchase_price) + 50, 100));

            if ($cost > 0) {
                Ledger::post($date, __('Cost of goods sold reversal for Credit Note #:number', ['number' => $this->credit_note_number]), [
                    ['account_id' => LedgerAccounts::id(LedgerAccounts::INVENTORY), 'debit' => Money::format($cost), 'description' => __('Inventory returned')],
                    ['account_id' => LedgerAccounts::id(LedgerAccounts::COST_OF_GOODS_SOLD), 'credit' => Money::format($cost), 'description' => __('Cost of goods sold reversal')],
                ], $this);
            }

            $this->forceFill(['status' => 'approved', 'approved_by' => $approver->id])->save();
        });
    }

    protected function casts(): array
    {
        return [
            'credit_note_date' => 'date:Y-m-d',
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'applied_amount' => 'decimal:2',
        ];
    }
}
