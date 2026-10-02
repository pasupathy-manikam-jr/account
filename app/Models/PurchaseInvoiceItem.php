<?php

namespace App\Models;

use App\Support\Money;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $invoice_id
 * @property int $item_id
 * @property string $quantity
 * @property string $unit_price
 * @property string $discount_percentage
 * @property string $discount_amount
 * @property string $tax_percentage
 * @property list<array{name: string, rate: string}>|null $taxes
 * @property string $tax_amount
 * @property string $total_amount
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Item $item
 */
#[Fillable(['item_id', 'quantity', 'unit_price', 'discount_percentage', 'discount_amount', 'tax_percentage', 'taxes', 'tax_amount', 'total_amount'])]
class PurchaseInvoiceItem extends Model
{
    /**
     * @return BelongsTo<Item, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    /**
     * @return HasMany<PurchaseReturnItem, $this>
     */
    public function returnItems(): HasMany
    {
        return $this->hasMany(PurchaseReturnItem::class, 'original_invoice_item_id');
    }

    /**
     * How much of this line can still come back: sold minus what every return already claims.
     */
    public function returnableQuantity(): string
    {
        return Money::format(Money::toCents($this->quantity) - Money::toCents((string) $this->returnItems()->sum('quantity')));
    }

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'discount_percentage' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_percentage' => 'decimal:2',
            'taxes' => 'array',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }
}
