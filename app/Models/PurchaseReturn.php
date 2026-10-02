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
 * Goods sent back to a vendor against a posted purchase invoice: draft → approved → completed.
 * Completing takes the goods out of the warehouse and raises a draft debit note for the same lines.
 *
 * @property int $id
 * @property string|null $return_number
 * @property Carbon $return_date
 * @property int $vendor_id
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
 * @property-read User $vendor
 * @property-read Warehouse $warehouse
 * @property-read PurchaseInvoice $originalInvoice
 * @property-read DebitNote|null $debitNote
 */
#[Fillable(['return_date', 'vendor_id', 'warehouse_id', 'original_invoice_id', 'reason', 'notes'])]
class PurchaseReturn extends Model
{
    public const STATUSES = ['draft', 'approved', 'completed'];

    public const REASONS = ['defective', 'damaged', 'wrong_item', 'excess_quantity', 'other'];

    protected $attributes = ['status' => 'draft'];

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
     * @return BelongsTo<PurchaseInvoice, $this>
     */
    public function originalInvoice(): BelongsTo
    {
        return $this->belongsTo(PurchaseInvoice::class, 'original_invoice_id');
    }

    /**
     * @return HasMany<PurchaseReturnItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(PurchaseReturnItem::class, 'return_id');
    }

    /**
     * @return HasOne<DebitNote, $this>
     */
    public function debitNote(): HasOne
    {
        return $this->hasOne(DebitNote::class, 'return_id');
    }

    /**
     * Save the return with lines priced exactly as on the original invoice.
     *
     * @param  array<string, mixed>  $header
     * @param  list<array{original_invoice_item_id: int|string, quantity: string|int|float}>  $lines
     */
    public function saveFromInvoice(array $header, array $lines): void
    {
        $invoiceLines = PurchaseInvoiceItem::query()->findMany(array_column($lines, 'original_invoice_item_id'))->keyBy('id');

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
            $this->forceFill(['return_number' => sprintf('PR-%s-%03d', $this->return_date->format('Y-m'), $this->id)])->save();
        }
    }

    public function approve(): void
    {
        $this->move('draft', 'approved');
    }

    /**
     * Approved → completed: the goods leave the warehouse and a draft debit note is raised.
     */
    public function complete(): DebitNote
    {
        return DB::transaction(function () {
            $this->move('approved', 'completed');
            $this->load('items.item');

            foreach ($this->items as $line) {
                $stock = WarehouseStock::query()->lockForUpdate()
                    ->firstWhere(['item_id' => $line->item_id, 'warehouse_id' => $this->warehouse_id]);

                if (! $stock || Money::toCents($stock->quantity) < Money::toCents($line->quantity)) {
                    throw ValidationException::withMessages(['status' => __('Not enough stock of :item in this warehouse to send back.', ['item' => $line->item->name])]);
                }

                $stock->update(['quantity' => Money::format(Money::toCents($stock->quantity) - Money::toCents($line->quantity))]);
            }

            $note = new DebitNote;
            $note->fill([
                'debit_note_date' => $this->return_date->format('Y-m-d'),
                'vendor_id' => $this->vendor_id,
                'invoice_id' => $this->original_invoice_id,
                'reason' => __('Purchase return - :reason', ['reason' => __(str_replace('_', ' ', $this->reason))]),
                'notes' => $this->notes,
            ])->forceFill([
                'return_id' => $this->id,
                'subtotal' => $this->subtotal,
                'discount_amount' => $this->discount_amount,
                'tax_amount' => $this->tax_amount,
                'total_amount' => $this->total_amount,
            ])->save();
            $note->items()->createMany($this->items->map(fn (PurchaseReturnItem $line) => $line->only([
                'item_id', 'quantity', 'unit_price', 'discount_percentage', 'discount_amount', 'tax_percentage', 'taxes', 'tax_amount', 'total_amount',
            ]))->all());
            $note->forceFill(['debit_note_number' => sprintf('DN-%s-%03d', $note->debit_note_date->format('Y-m'), $note->id)])->save();

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
