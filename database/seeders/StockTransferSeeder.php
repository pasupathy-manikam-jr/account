<?php

namespace Database\Seeders;

use App\Models\Item;
use App\Models\StockTransfer;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use App\Support\Money;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class StockTransferSeeder extends Seeder
{
    /**
     * The demo's transfers (database/demo/transfers.json) between our warehouses, through StockTransfer::move()
     * so stock stays consistent; a transfer the source can't cover is skipped. Skipped once transfers exist.
     */
    public function run(): void
    {
        if (StockTransfer::query()->exists()) {
            return;
        }

        /** @var list<array{from: int, to: int, item: string, quantity: string, date: string}> $rows */
        $rows = File::json(database_path('demo/transfers.json'), JSON_THROW_ON_ERROR);
        $warehouses = Warehouse::query()->where('is_active', true)->orderBy('id')->pluck('id')->all();
        $items = Item::query()->pluck('id', 'name');
        $creator = User::query()->where('email', 'admin@example.com')->value('id');

        if (count($warehouses) < 2) {
            return;
        }

        foreach ($rows as $row) {
            $from = $warehouses[$row['from'] % count($warehouses)];
            $to = $warehouses[$row['to'] % count($warehouses)];
            $item = $items[$row['item']] ?? null;
            $held = WarehouseStock::query()->where(['item_id' => $item, 'warehouse_id' => $from])->value('quantity');

            if ($item === null || $from === $to || Money::toCents($held ?? '0') < Money::toCents($row['quantity'])) {
                continue;
            }

            StockTransfer::move(['from_warehouse_id' => $from, 'to_warehouse_id' => $to, 'item_id' => $item, 'quantity' => $row['quantity'], 'date' => $row['date']], $creator);
        }
    }
}
