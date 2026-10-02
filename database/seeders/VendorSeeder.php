<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Vendor;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class VendorSeeder extends Seeder
{
    /**
     * One vendor per demo vendor login (database/demo/vendors.json, matched by email).
     * Run UserSeeder first.
     */
    public function run(): void
    {
        /** @var list<array<string, mixed>> $rows */
        $rows = File::json(database_path('demo/vendors.json'), JSON_THROW_ON_ERROR);
        $users = User::query()->where('type', 'vendor')->pluck('id', 'email');

        foreach ($rows as $row) {
            $userId = $users[$row['email']] ?? null;

            if (! $userId) {
                continue;
            }

            unset($row['email']);
            $vendor = Vendor::query()->firstOrNew(['user_id' => $userId]);
            $vendor->fill($row)->save();

            // Model events are off under DatabaseSeeder, so set the code Vendor::booted() would.
            if (! $vendor->vendor_code) {
                $vendor->forceFill(['vendor_code' => sprintf('VEND-%04d', $vendor->id)])->save();
            }
        }
    }
}
