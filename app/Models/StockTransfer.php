<?php

namespace App\Models;

use App\Support\Money;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Stock moved from one warehouse to another. Creating it moves the stock; deleting it moves it back.
 *
 * @property int $id
 * @property int $from_warehouse_id
 * @property int $to_warehouse_id
 * @property int $item_id
 * @property string $quantity
 * @property Carbon $date
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Warehouse $fromWarehouse
 * @property-read Warehouse $toWarehouse
 * @property-read Item $item
 */
#[Fillable(['from_warehouse_id', 'to_warehouse_id', 'item_id', 'quantity', 'date'])]
class StockTransfer extends Model
{
    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function fromWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'from_warehouse_id');
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function toWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'to_warehouse_id');
    }

    /**
     * @return BelongsTo<Item, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    /**
     * Record the transfer and move the stock, refusing to take more than the source holds.
     *
     * @param  array<string, mixed>  $data
     */
    public static function move(array $data, ?int $userId): self
    {
        return DB::transaction(function () use ($data, $userId) {
            $transfer = new self($data);
            $transfer->forceFill(['created_by' => $userId])->save();
            self::shift($transfer->item_id, $transfer->from_warehouse_id, $transfer->to_warehouse_id, $transfer->quantity);

            return $transfer;
        });
    }

    /**
     * Undo the transfer: the stock goes back, as long as the destination still holds it.
     */
    public function reverse(): void
    {
        DB::transaction(function () {
            self::shift($this->item_id, $this->to_warehouse_id, $this->from_warehouse_id, $this->quantity);
            $this->delete();
        });
    }

    private static function shift(int $itemId, int $fromId, int $toId, string $quantity): void
    {
        $cents = Money::toCents($quantity);
        $from = WarehouseStock::query()->lockForUpdate()->firstWhere(['item_id' => $itemId, 'warehouse_id' => $fromId]);

        if (! $from || Money::toCents($from->quantity) < $cents) {
            throw ValidationException::withMessages(['quantity' => __('Only :available in stock at that warehouse.', [
                'available' => rtrim(rtrim($from->quantity ?? '0', '0'), '.') ?: '0',
            ])]);
        }

        $to = WarehouseStock::query()->lockForUpdate()->firstOrCreate(['item_id' => $itemId, 'warehouse_id' => $toId], ['quantity' => 0]);
        $from->update(['quantity' => Money::format(Money::toCents($from->quantity) - $cents)]);
        $to->update(['quantity' => Money::format(Money::toCents($to->quantity) + $cents)]);
    }

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'date' => 'date:Y-m-d',
        ];
    }
}
