<?php

namespace Database\Seeders;

use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class WarehouseSeeder extends Seeder
{
    /**
     * Malaysian warehouses (database/demo/warehouses.json).
     */
    public function run(): void
    {
        /** @var list<array<string, mixed>> $rows */
        $rows = File::json(database_path('demo/warehouses.json'), JSON_THROW_ON_ERROR);

        foreach ($rows as $row) {
            Warehouse::query()->updateOrCreate(['name' => $row['name']], $row);
        }
    }
}
