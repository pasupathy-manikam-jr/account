<?php

namespace App\Models\Concerns;

use App\Models\Item;
use App\Models\Tax;
use App\Support\DocumentTotals;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;

/**
 * Sales and purchase documents (proposals, invoices…) whose lines are priced from items.
 *
 * The using model defines items() (a HasMany of its line model), plus NUMBER_COLUMN, NUMBER_PREFIX and DATE_COLUMN for
 * its document number (e.g. SP-2026-10-001, set from the id after the first save).
 */
trait HasPricedLines
{
    /**
     * Save the header with these lines, pricing each line with the item's own taxes (never the client's figures).
     *
     * @param  array<string, mixed>  $header
     * @param  list<array{item_id: int|string, quantity: string|int|float, unit_price: string|int|float, discount_percentage?: string|int|float|null}>  $lines
     */
    public function saveWithLines(array $header, array $lines): void
    {
        $items = Item::query()->with('taxes:id,tax_name,rate')->findMany(array_column($lines, 'item_id'))->keyBy('id');

        $lines = array_map(function (array $line) use ($items) {
            $taxes = $items[$line['item_id']]->taxes->map(fn (Tax $tax) => ['name' => $tax->tax_name, 'rate' => $tax->rate])->values()->all();

            return [
                'item_id' => (int) $line['item_id'],
                'quantity' => $line['quantity'],
                'unit_price' => $line['unit_price'],
                'discount_percentage' => $line['discount_percentage'] ?? 0,
                'tax_percentage' => Money::format(array_sum(array_map(fn (array $t) => Money::toCents($t['rate']), $taxes))),
                'taxes' => $taxes,
            ];
        }, $lines);

        $totals = DocumentTotals::calculate($lines);

        $this->fill([
            ...$header,
            'subtotal' => $totals['subtotal'],
            'discount_amount' => $totals['discount_amount'],
            'tax_amount' => $totals['tax_amount'],
            'total_amount' => $totals['total_amount'],
        ])->save();

        $this->items()->delete();
        $this->items()->createMany(array_map(fn (array $line, array $amounts) => [...$line, ...$amounts], $lines, $totals['lines']));

        if ($this->getAttribute(static::NUMBER_COLUMN) === null) {
            $this->forceFill([static::NUMBER_COLUMN => sprintf('%s-%s-%03d', static::NUMBER_PREFIX, $this->getAttribute(static::DATE_COLUMN)->format('Y-m'), $this->getKey())])->save();
        }
    }
}
