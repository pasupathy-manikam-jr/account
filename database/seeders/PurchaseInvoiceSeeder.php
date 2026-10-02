<?php

namespace Database\Seeders;

use App\Models\Item;
use App\Models\PurchaseInvoice;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class PurchaseInvoiceSeeder extends Seeder
{
    /**
     * The demo's bills (database/demo/purchase_invoices.json) from our vendors. Posted ones go through
     * PurchaseInvoice::post(), so the stock received and the payables are real. Skipped once bills exist.
     */
    public function run(): void
    {
        if (PurchaseInvoice::query()->exists()) {
            return;
        }

        /** @var list<array{invoice_date: string, due_date: string, vendor: string, warehouse: int, status: string, payment_terms: string|null, notes: string|null, items: list<array{item: string, quantity: int, unit_price: string, discount_percentage: string}>}> $rows */
        $rows = File::json(database_path('demo/purchase_invoices.json'), JSON_THROW_ON_ERROR);
        $vendors = User::query()->where('type', 'vendor')->pluck('id', 'email');
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

            if (! isset($vendors[$row['vendor']]) || $lines === [] || $warehouses === []) {
                continue;
            }

            $invoice = new PurchaseInvoice;
            $invoice->forceFill(['created_by' => $creator]);
            $invoice->saveWithLines([
                'invoice_date' => $row['invoice_date'],
                'due_date' => $row['due_date'],
                'vendor_id' => $vendors[$row['vendor']],
                'warehouse_id' => $warehouses[$row['warehouse'] % count($warehouses)],
                'payment_terms' => $row['payment_terms'],
                'notes' => $row['notes'],
            ], $lines);

            if ($row['status'] === 'posted') {
                $invoice->post();
            }
        }
    }
}
