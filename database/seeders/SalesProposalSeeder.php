<?php

namespace Database\Seeders;

use App\Models\Item;
use App\Models\SalesProposal;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class SalesProposalSeeder extends Seeder
{
    /**
     * The demo's proposals (database/demo/sales_proposals.json) for our clients and items.
     * Runs after users, customers, items and warehouses; skipped once proposals exist.
     */
    public function run(): void
    {
        if (SalesProposal::query()->exists()) {
            return;
        }

        /** @var list<array{proposal_date: string, due_date: string, customer: string, warehouse: int, status: string, payment_terms: string|null, notes: string|null, items: list<array{item: string, quantity: int, unit_price: string, discount_percentage: string}>}> $rows */
        $rows = File::json(database_path('demo/sales_proposals.json'), JSON_THROW_ON_ERROR);
        $customers = User::query()->where('type', 'client')->pluck('id', 'email');
        $warehouses = Warehouse::query()->orderBy('id')->pluck('id')->all();
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

            $proposal = new SalesProposal;
            $proposal->forceFill(['status' => $row['status'], 'created_by' => $creator]);
            $proposal->saveWithLines([
                'proposal_date' => $row['proposal_date'],
                'due_date' => $row['due_date'],
                'customer_id' => $customers[$row['customer']],
                'warehouse_id' => $warehouses[$row['warehouse'] % count($warehouses)],
                'payment_terms' => $row['payment_terms'],
                'notes' => $row['notes'],
            ], $lines);
        }
    }
}
