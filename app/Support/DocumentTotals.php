<?php

namespace App\Support;

/**
 * Line and document totals for sales and purchase documents (proposals, invoices, returns, retainers).
 *
 * Per line: gross = qty × unit price; discount = gross × discount %; tax = (gross − discount) × tax %;
 * total = gross − discount + tax. The document sums each column. All maths runs in integer cents,
 * rounding half-up per line, so the lines always add up to the document totals.
 */
class DocumentTotals
{
    /**
     * @param  list<array{quantity: string|int|float, unit_price: string|int|float, discount_percentage?: string|int|float|null, tax_percentage?: string|int|float|null}>  $lines
     * @return array{lines: list<array{discount_amount: string, tax_amount: string, total_amount: string}>, subtotal: string, discount_amount: string, tax_amount: string, total_amount: string}
     */
    public static function calculate(array $lines): array
    {
        $out = [];
        $subtotal = $discount = $tax = 0;

        foreach ($lines as $line) {
            // Quantity in hundredths × price in cents, back to cents with half-up rounding.
            $gross = intdiv(Money::toCents($line['quantity']) * Money::toCents($line['unit_price']) + 50, 100);
            $lineDiscount = Money::percentOf($gross, $line['discount_percentage'] ?? 0);
            $lineTax = Money::percentOf($gross - $lineDiscount, $line['tax_percentage'] ?? 0);

            $subtotal += $gross;
            $discount += $lineDiscount;
            $tax += $lineTax;
            $out[] = [
                'discount_amount' => Money::format($lineDiscount),
                'tax_amount' => Money::format($lineTax),
                'total_amount' => Money::format($gross - $lineDiscount + $lineTax),
            ];
        }

        return [
            'lines' => $out,
            'subtotal' => Money::format($subtotal),
            'discount_amount' => Money::format($discount),
            'tax_amount' => Money::format($tax),
            'total_amount' => Money::format($subtotal - $discount + $tax),
        ];
    }
}
