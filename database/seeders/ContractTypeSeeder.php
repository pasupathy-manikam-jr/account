<?php

namespace Database\Seeders;

use App\Models\ContractType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class ContractTypeSeeder extends Seeder
{
    /**
     * The demo's contract types (database/demo/contract_types.json).
     */
    public function run(): void
    {
        /** @var list<array{name: string, is_active: bool}> $rows */
        $rows = File::json(database_path('demo/contract_types.json'), JSON_THROW_ON_ERROR);

        foreach ($rows as $row) {
            ContractType::query()->updateOrCreate(['name' => $row['name']], $row);
        }
    }
}
