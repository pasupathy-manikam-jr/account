<?php

namespace Database\Seeders;

use App\Models\BankAccount;
use App\Models\Item;
use App\Models\Retainer;
use App\Models\RetainerPayment;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Money;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class RetainerSeeder extends Seeder
{
    /**
     * The demo's retainers and retainer payments (database/demo/retainers.json). Cleared payments go through
     * RetainerPayment::clear(), so deposits reach the ledger and partial statuses come from real money.
     * Skipped once retainers exist.
     */
    public function run(): void
    {
        if (Retainer::query()->exists()) {
            return;
        }

        /** @var array{retainers: list<array<string, mixed>>, payments: list<array<string, mixed>>} $data */
        $data = File::json(database_path('demo/retainers.json'), JSON_THROW_ON_ERROR);
        $customers = User::query()->where('type', 'client')->pluck('id', 'email');
        $warehouses = Warehouse::query()->where('is_active', true)->orderBy('id')->pluck('id')->all();
        $items = Item::query()->pluck('id', 'name');
        $bank = BankAccount::query()->where('is_active', true)->whereIn('account_type', BankAccount::CASH_TYPES)->orderBy('id')->first();
        $creator = User::query()->where('email', 'admin@example.com')->value('id');
        $created = [];

        foreach ($data['retainers'] as $n => $row) {
            $lines = array_values(array_filter(array_map(fn (array $line) => isset($items[$line['item']]) ? [
                'item_id' => $items[$line['item']],
                'quantity' => $line['quantity'],
                'unit_price' => $line['unit_price'],
                'discount_percentage' => $line['discount_percentage'],
            ] : null, $row['items'])));

            if (! isset($customers[$row['customer']]) || $lines === [] || $warehouses === []) {
                continue;
            }

            $retainer = new Retainer;
            $retainer->forceFill(['status' => $row['status'], 'created_by' => $creator]);
            $retainer->saveWithLines([
                'retainer_date' => $row['retainer_date'],
                'due_date' => $row['due_date'],
                'customer_id' => $customers[$row['customer']],
                'warehouse_id' => $warehouses[$row['warehouse'] % count($warehouses)],
                'payment_terms' => $row['payment_terms'],
                'notes' => $row['notes'],
            ], $lines);
            $created[$n] = $retainer;
        }

        if ($bank === null) {
            return;
        }

        foreach ($data['payments'] as $row) {
            // A payment goes to one customer's payable retainers, and never beyond what they still owe.
            $allocations = [];
            $customer = null;

            foreach ($row['allocations'] as $allocation) {
                $retainer = $created[$allocation['retainer']] ?? null;

                if (! $retainer || ! in_array($retainer->status, Retainer::PAYABLE, true) || ($customer && $customer !== $retainer->customer_id)) {
                    continue;
                }

                $amount = min(Money::toCents($allocation['amount']), Money::toCents((string) $retainer->fresh()?->balance_amount));

                if ($amount > 0) {
                    $customer = $retainer->customer_id;
                    $allocations[] = ['retainer_id' => $retainer->id, 'allocated_amount' => Money::format($amount)];
                }
            }

            if ($allocations === []) {
                continue;
            }

            $payment = new RetainerPayment;
            $payment->fill([
                'payment_date' => $row['payment_date'],
                'customer_id' => $customer,
                'bank_account_id' => $bank->id,
                'payment_amount' => Money::format(array_sum(array_map(fn ($a) => Money::toCents($a['allocated_amount']), $allocations))),
                'reference_number' => $row['reference_number'],
                'notes' => $row['notes'],
            ])->forceFill(['created_by' => $creator])->save();
            $payment->allocations()->createMany($allocations);
            $payment->forceFill(['payment_number' => sprintf('RP-%s-%03d', $payment->payment_date->format('Y-m'), $payment->id)])->save();

            if ($row['status'] === 'cleared') {
                $payment->clear();
            }
        }
    }
}
