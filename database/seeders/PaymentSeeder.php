<?php

namespace Database\Seeders;

use App\Models\BankAccount;
use App\Models\Payment;
use App\Models\PurchaseInvoice;
use App\Models\SalesInvoice;
use App\Models\User;
use App\Support\Money;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class PaymentSeeder extends Seeder
{
    /**
     * The demo's customer and vendor payments (database/demo/payments.json) against our seeded invoices and
     * bills, capped at what is still owed. Cleared ones go through Payment::clear(), so invoices become
     * partial/paid and the bank and ledger move for real. Skipped once payments exist.
     */
    public function run(): void
    {
        if (Payment::query()->exists()) {
            return;
        }

        /** @var list<array{kind: string, date: string, bank: int, reference_number: string|null, notes: string|null, status: string, allocations: list<array{invoice: int, amount: string}>}> $rows */
        $rows = File::json(database_path('demo/payments.json'), JSON_THROW_ON_ERROR);
        $documents = [
            'customer' => SalesInvoice::query()->orderBy('id')->get()->values(),
            'vendor' => PurchaseInvoice::query()->orderBy('id')->get()->values(),
        ];
        $banks = BankAccount::query()->where('is_active', true)->whereIn('account_type', BankAccount::CASH_TYPES)->orderBy('id')->pluck('id')->all();
        $creator = User::query()->where('email', 'admin@example.com')->value('id');

        foreach ($rows as $row) {
            $allocations = [];
            $party = null;
            $date = null;

            foreach ($row['allocations'] as $allocation) {
                /** @var SalesInvoice|PurchaseInvoice|null $invoice */
                $invoice = $documents[$row['kind']][$allocation['invoice']] ?? null;
                $invoice?->refresh();

                if (! $invoice || ! in_array($invoice->status, ['posted', 'partial'], true)) {
                    continue;
                }

                $owner = $row['kind'] === 'customer' ? $invoice->getAttribute('customer_id') : $invoice->getAttribute('vendor_id');
                $amount = min(Money::toCents($allocation['amount']), Money::toCents((string) $invoice->balance_amount));

                if ($amount > 0 && ($party === null || $party === $owner)) {
                    $party = $owner;
                    // Paid a little after the invoice, so payments spread across the months like real ones.
                    $date ??= min($invoice->invoice_date->copy()->addDays(10), today())->format('Y-m-d');
                    $allocations[] = ['invoice_type' => $invoice->getMorphClass(), 'invoice_id' => $invoice->id, 'allocated_amount' => Money::format($amount)];
                }
            }

            if ($allocations === [] || $banks === []) {
                continue;
            }

            $payment = new Payment([
                'payment_date' => $date,
                'party_id' => $party,
                'bank_account_id' => $banks[$row['bank'] % count($banks)],
                'payment_amount' => Money::format(array_sum(array_map(fn ($a) => Money::toCents($a['allocated_amount']), $allocations))),
                'reference_number' => $row['reference_number'],
                'notes' => $row['notes'],
            ]);
            $payment->forceFill(['kind' => $row['kind'], 'created_by' => $creator])->save();
            $payment->allocations()->createMany($allocations);
            $payment->assignNumber();

            if ($row['status'] === 'cleared') {
                $payment->clear();
            }
        }
    }
}
