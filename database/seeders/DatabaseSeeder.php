<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RolesSeeder::class,
            MessageTemplateSeeder::class,
            SettingsSeeder::class,
            UserSeeder::class,
            LedgerSeeder::class,
            CustomerSeeder::class,
            VendorSeeder::class,
            WarehouseSeeder::class,
            ProductServiceSeeder::class,
            SalesProposalSeeder::class,
            SalesInvoiceSeeder::class,
            SalesReturnSeeder::class,
            RetainerSeeder::class,
            ContractTypeSeeder::class,
            ContractSeeder::class,
            PurchaseInvoiceSeeder::class,
            PurchaseReturnSeeder::class,
            StockTransferSeeder::class,
            CashEntrySeeder::class,
            BankTransferSeeder::class,
            PaymentSeeder::class,
            GoalSeeder::class,
            BudgetSeeder::class,
            AssetSeeder::class,
            MediaSeeder::class,
        ]);
    }
}
