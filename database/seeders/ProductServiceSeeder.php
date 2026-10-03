<?php

namespace Database\Seeders;

use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\Tax;
use App\Models\Unit;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class ProductServiceSeeder extends Seeder
{
    /**
     * Item categories, SST taxes, units and the demo items with stock in each active warehouse
     * (database/demo/*.json). Run WarehouseSeeder first.
     */
    public function run(): void
    {
        /** @var list<array{name: string, color: string}> $categories */
        $categories = File::json(database_path('demo/item_categories.json'), JSON_THROW_ON_ERROR);
        foreach ($categories as $row) {
            ItemCategory::query()->updateOrCreate(['name' => $row['name']], $row);
        }

        /** @var list<string> $units */
        $units = File::json(database_path('demo/units.json'), JSON_THROW_ON_ERROR);
        foreach ($units as $name) {
            Unit::query()->firstOrCreate(['unit_name' => $name]);
        }

        /** @var list<array{tax_name: string, rate: string, type_code: string}> $taxes */
        $taxes = File::json(database_path('demo/taxes.json'), JSON_THROW_ON_ERROR);
        foreach ($taxes as $row) {
            Tax::query()->updateOrCreate(['tax_name' => $row['tax_name']], $row);
        }

        $categoryIds = ItemCategory::query()->pluck('id', 'name');
        $unitIds = Unit::query()->pluck('id', 'unit_name');
        $taxIds = Tax::query()->pluck('id', 'tax_name');
        $warehouseIds = Warehouse::query()->where('is_active', true)->orderBy('id')->pluck('id');

        /** @var list<array{name: string, sku: string, type: string, category: string, unit: string, sale_price: string, purchase_price: string, taxes: list<string>, description: string|null}> $items */
        $items = File::json(database_path('demo/items.json'), JSON_THROW_ON_ERROR);

        foreach ($items as $row) {
            $item = Item::query()->updateOrCreate(['sku' => $row['sku']], [
                'name' => $row['name'],
                'type' => $row['type'],
                'category_id' => $categoryIds[$row['category']],
                'unit_id' => $unitIds[$row['unit']],
                'sale_price' => $row['sale_price'],
                'purchase_price' => $row['purchase_price'],
                'description' => $row['description'],
            ]);
            $item->taxes()->sync($taxIds->only($row['taxes'])->values());

            if (in_array($item->type, Item::STOCKED_TYPES, true)) {
                foreach ($warehouseIds as $warehouseId) {
                    // Stable, varied quantities so reseeding never changes them.
                    $item->stocks()->updateOrCreate(['warehouse_id' => $warehouseId], ['quantity' => crc32($row['sku'].$warehouseId) % 150 + 5]);
                }
            }
        }
    }
}
