<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class CustomerSeeder extends Seeder
{
    /**
     * One customer per demo client login (database/demo/customers.json, matched by email).
     * Run UserSeeder first.
     */
    public function run(): void
    {
        /** @var list<array<string, mixed>> $rows */
        $rows = File::json(database_path('demo/customers.json'), JSON_THROW_ON_ERROR);
        $users = User::query()->where('type', 'client')->pluck('id', 'email');

        foreach ($rows as $row) {
            $userId = $users[$row['email']] ?? null;

            if (! $userId) {
                continue;
            }

            unset($row['email']);
            $customer = Customer::query()->firstOrNew(['user_id' => $userId]);
            $customer->fill($row)->save();

            // Model events are off under DatabaseSeeder, so set the code Customer::booted() would.
            if (! $customer->customer_code) {
                $customer->forceFill(['customer_code' => sprintf('CUST-%04d', $customer->id)])->save();
            }
        }
    }
}
