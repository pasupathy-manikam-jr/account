<?php

namespace Database\Seeders;

use App\Models\SalesInvoice;
use App\Models\SalesReturn;
use App\Models\User;
use App\Support\Money;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class SalesReturnSeeder extends Seeder
{
    /**
     * The demo's returns (database/demo/sales_returns.json) against our seeded invoices, run through the
     * real approve → complete → credit note steps so stock and the ledger stay consistent.
     * A return the demo already credited counts as completed. Skipped once returns exist.
     */
    public function run(): void
    {
        if (SalesReturn::query()->exists()) {
            return;
        }

        /** @var list<array{invoice: int, return_date: string, reason: string, status: string, notes: string|null, credit_note: string|null, items: list<array{item: string, quantity: int}>}> $rows */
        $rows = File::json(database_path('demo/sales_returns.json'), JSON_THROW_ON_ERROR);
        $invoices = SalesInvoice::query()->orderBy('id')->with('items.item:id,name')->get()->values();
        $admin = User::query()->where('email', 'admin@example.com')->first();

        foreach ($rows as $row) {
            $invoice = $invoices[$row['invoice']] ?? null;

            if (! $invoice || $invoice->type !== 'product' || $invoice->status === 'draft') {
                continue;
            }

            $lines = [];

            foreach ($row['items'] as $wanted) {
                $line = $invoice->items->first(fn ($l) => $l->item->name === $wanted['item']);
                $quantity = $line ? min(Money::toCents($line->returnableQuantity()), $wanted['quantity'] * 100) : 0;

                if ($quantity > 0) {
                    $lines[] = ['original_invoice_item_id' => $line->id, 'quantity' => Money::format($quantity)];
                }
            }

            if ($lines === []) {
                continue;
            }

            $return = new SalesReturn;
            $return->forceFill(['created_by' => $admin?->id]);
            $return->saveFromInvoice([
                'return_date' => max($row['return_date'], $invoice->invoice_date->format('Y-m-d')),
                'customer_id' => $invoice->customer_id,
                'warehouse_id' => $invoice->warehouse_id,
                'original_invoice_id' => $invoice->id,
                'reason' => $row['reason'],
                'notes' => $row['notes'],
            ], $lines);

            $status = $row['credit_note'] !== null ? 'completed' : $row['status'];

            if ($status !== 'draft') {
                $return->approve();
            }

            if ($status === 'completed') {
                $note = $return->complete();

                if ($row['credit_note'] !== 'draft' && $admin) {
                    $note->approve($admin);
                }
            }
        }
    }
}
