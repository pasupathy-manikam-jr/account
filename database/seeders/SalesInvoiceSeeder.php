<?php

namespace Database\Seeders;

use App\Models\Item;
use App\Models\SalesInvoice;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class SalesInvoiceSeeder extends Seeder
{
    /**
     * The demo's invoices (database/demo/sales_invoices.json) for our clients and items. Posted ones go
     * through SalesInvoice::post(), so their journal entries and stock movements are real.
     * Runs after items, warehouses and the chart of accounts; skipped once invoices exist.
     */
    public function run(): void
    {
        if (SalesInvoice::query()->exists()) {
            return;
        }

        /** @var list<array{invoice_date: string, due_date: string, customer: string, type: string, warehouse: int, status: string, payment_terms: string|null, notes: string|null, items: list<array{item: string, quantity: int, unit_price: string, discount_percentage: string}>}> $rows */
        $rows = File::json(database_path('demo/sales_invoices.json'), JSON_THROW_ON_ERROR);
        $customers = User::query()->where('type', 'client')->pluck('id', 'email');
        $warehouses = Warehouse::query()->where('is_active', true)->orderBy('id')->pluck('id')->all();
        $items = Item::query()->pluck('id', 'name');
        $creator = User::query()->where('email', 'admin@example.com')->value('id');

        foreach ($rows as $row) {
            $lines = array_values(array_filter(array_map(fn (array $line) => isset($items[$line['item']]) ? [
                'item_id' => $items[$line['item']],
                'quantity' => $line['quantity'],
                'unit_price' => $line['unit_price'],
                'discount_percentage' => $line['discount_percentage'],
            ] : null, $row['items'])));

            if (! isset($customers[$row['customer']]) || $lines === [] || $warehouses === []) {
                continue;
            }

            $invoice = new SalesInvoice;
            $invoice->forceFill(['created_by' => $creator]);
            $invoice->saveWithLines([
                'type' => $row['type'],
                'invoice_date' => $row['invoice_date'],
                'due_date' => $row['due_date'],
                'customer_id' => $customers[$row['customer']],
                'warehouse_id' => $row['type'] === 'product' ? $warehouses[$row['warehouse'] % count($warehouses)] : null,
                'payment_terms' => $row['payment_terms'],
                'notes' => $row['notes'],
            ], $lines);

            if ($row['status'] === 'posted') {
                $invoice->post();
            }
        }
    }
}
