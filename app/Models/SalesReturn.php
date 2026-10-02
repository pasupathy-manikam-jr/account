<?php

namespace App\Models;

use App\Support\DocumentTotals;
use App\Support\Money;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Goods a customer sends back against a posted product invoice: draft → approved → completed.
 * Completing restocks the warehouse and raises a draft credit note for the same lines.
 *
 * @property int $id
 * @property string|null $return_number
 * @property Carbon $return_date
 * @property int $customer_id
 * @property int $warehouse_id
 * @property int $original_invoice_id
 * @property string $reason
 * @property string $subtotal
 * @property string $discount_amount
 * @property string $tax_amount
 * @property string $total_amount
 * @property string $status
 * @property string|null $notes
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $customer
 * @property-read Warehouse $warehouse
 * @property-read SalesInvoice $originalInvoice
 * @property-read CreditNote|null $creditNote
 */
#[Fillable(['return_date', 'customer_id', 'warehouse_id', 'original_invoice_id', 'reason', 'notes'])]
class SalesReturn extends Model
{
    public const STATUSES = ['draft', 'approved', 'completed'];

    public const REASONS = ['defective', 'damaged', 'wrong_item', 'excess_quantity', 'other'];

    protected $attributes = ['status' => 'draft'];

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
    public function originalInvoice(): BelongsTo
    {
        return $this->belongsTo(SalesInvoice::class, 'original_invoice_id');
    }

    /**
     * @return HasMany<SalesReturnItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(SalesReturnItem::class, 'return_id');
    }

    /**
     * @return HasOne<CreditNote, $this>
     */
    public function creditNote(): HasOne
    {
        return $this->hasOne(CreditNote::class, 'return_id');
    }

    /**
     * Save the return with lines priced exactly as on the original invoice.
     *
     * @param  array<string, mixed>  $header
     * @param  list<array{original_invoice_item_id: int|string, quantity: string|int|float}>  $lines
     */
    public function saveFromInvoice(array $header, array $lines): void
    {
        $invoiceLines = SalesInvoiceItem::query()->findMany(array_column($lines, 'original_invoice_item_id'))->keyBy('id');

        $lines = array_map(fn (array $line) => [
            'original_invoice_item_id' => (int) $line['original_invoice_item_id'],
            'item_id' => $invoiceLines[$line['original_invoice_item_id']]->item_id,
            'quantity' => $line['quantity'],
            'unit_price' => $invoiceLines[$line['original_invoice_item_id']]->unit_price,
            'discount_percentage' => $invoiceLines[$line['original_invoice_item_id']]->discount_percentage,
            'tax_percentage' => $invoiceLines[$line['original_invoice_item_id']]->tax_percentage,
            'taxes' => $invoiceLines[$line['original_invoice_item_id']]->taxes,
        ], $lines);

        $totals = DocumentTotals::calculate($lines);

        $this->fill($header)->forceFill([
            'subtotal' => $totals['subtotal'],
            'discount_amount' => $totals['discount_amount'],
            'tax_amount' => $totals['tax_amount'],
            'total_amount' => $totals['total_amount'],
        ])->save();

        $this->items()->delete();
        $this->items()->createMany(array_map(fn (array $line, array $amounts) => [...$line, ...$amounts], $lines, $totals['lines']));

        if ($this->return_number === null) {
            $this->forceFill(['return_number' => sprintf('SR-%s-%03d', $this->return_date->format('Y-m'), $this->id)])->save();
        }
    }

    public function approve(): void
    {
        $this->move('draft', 'approved');
    }

    /**
     * Approved → completed: the goods go back into the warehouse and a draft credit note is raised.
     */
    public function complete(): CreditNote
    {
        return DB::transaction(function () {
            $this->move('approved', 'completed');
            $this->load('items.item');

            foreach ($this->items as $line) {
                if ($line->item->type === 'service') {
                    continue;
                }

                $stock = WarehouseStock::query()->lockForUpdate()->firstOrCreate(
                    ['item_id' => $line->item_id, 'warehouse_id' => $this->warehouse_id],
                    ['quantity' => 0],
                );
                $stock->update(['quantity' => Money::format(Money::toCents($stock->quantity) + Money::toCents($line->quantity))]);
            }

            $note = new CreditNote;
            $note->fill([
                'credit_note_date' => $this->return_date->format('Y-m-d'),
                'customer_id' => $this->customer_id,
                'invoice_id' => $this->original_invoice_id,
                'reason' => __('Sales return - :reason', ['reason' => __(str_replace('_', ' ', $this->reason))]),
                'notes' => $this->notes,
            ])->forceFill([
                'return_id' => $this->id,
                'subtotal' => $this->subtotal,
                'discount_amount' => $this->discount_amount,
                'tax_amount' => $this->tax_amount,
                'total_amount' => $this->total_amount,
            ])->save();
            $note->items()->createMany($this->items->map(fn (SalesReturnItem $line) => $line->only([
                'item_id', 'quantity', 'unit_price', 'discount_percentage', 'discount_amount', 'tax_percentage', 'taxes', 'tax_amount', 'total_amount',
            ]))->all());
            $note->forceFill(['credit_note_number' => sprintf('CN-%s-%03d', $note->credit_note_date->format('Y-m'), $note->id)])->save();

            return $note;
        });
    }

    private function move(string $from, string $to): void
    {
        if ($this->status !== $from) {
            throw ValidationException::withMessages(['status' => __('This return is :status and cannot be changed that way.', ['status' => __($this->status)])]);
        }

        $this->forceFill(['status' => $to])->save();
    }

    protected function casts(): array
    {
        return [
            'return_date' => 'date:Y-m-d',
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }
}
