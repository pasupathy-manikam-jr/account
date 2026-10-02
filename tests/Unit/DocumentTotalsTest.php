<?php

namespace Tests\Unit;

use App\Support\DocumentTotals;
use PHPUnit\Framework\TestCase;

class DocumentTotalsTest extends TestCase
{
    public function test_matches_the_demo_proposal(): void
    {
        // SP-2026-02-001 in the demo: 10 × 25.99 with 18% + 12% tax = 337.87.
        $totals = DocumentTotals::calculate([['quantity' => 10, 'unit_price' => '25.99', 'tax_percentage' => '30.00']]);

        $this->assertSame('259.90', $totals['subtotal']);
        $this->assertSame('77.97', $totals['tax_amount']);
        $this->assertSame('337.87', $totals['total_amount']);
    }

    public function test_discounts_apply_before_tax_and_lines_add_up(): void
    {
        $totals = DocumentTotals::calculate([
            ['quantity' => '2.5', 'unit_price' => '19.99', 'discount_percentage' => '10', 'tax_percentage' => '8'],
            ['quantity' => 3, 'unit_price' => '0.33', 'tax_percentage' => '6'],
        ]);

        // 2.5 × 19.99 = 49.975 → 49.98; −10% = 5.00 (4.998); taxable 44.98 × 8% = 3.60 (3.5984).
        $this->assertSame(['discount_amount' => '5.00', 'tax_amount' => '3.60', 'total_amount' => '48.58'], $totals['lines'][0]);
        // 3 × 0.33 = 0.99 × 6% = 0.06 (0.0594).
        $this->assertSame(['discount_amount' => '0.00', 'tax_amount' => '0.06', 'total_amount' => '1.05'], $totals['lines'][1]);

        $this->assertSame('50.97', $totals['subtotal']);
        $this->assertSame('5.00', $totals['discount_amount']);
        $this->assertSame('3.66', $totals['tax_amount']);
        $this->assertSame('49.63', $totals['total_amount']);
        $this->assertSame('49.63', number_format(array_sum(array_map('floatval', array_column($totals['lines'], 'total_amount'))), 2, '.', ''));
    }
}
