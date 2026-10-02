<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $debit_note_id
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
class DebitNoteItem extends Model
{
    /**
     * @return BelongsTo<Item, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
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
