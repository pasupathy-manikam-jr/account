<?php

namespace Tests\Feature\Account;

use App\Models\BankAccount;
use App\Models\ChartOfAccount;
use App\Models\CreditNote;
use App\Models\DebitNote;
use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\Payment;
use App\Models\PurchaseInvoice;
use App\Models\SalesInvoice;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Database\Seeders\LedgerSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    private User $vendor;

    private BankAccount $bank;

    private Warehouse $warehouse;

    private Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesSeeder::class, LedgerSeeder::class]);

        $this->client = User::factory()->create(['type' => 'client'])->assignRole('client');
        $this->vendor = User::factory()->create(['type' => 'vendor'])->assignRole('vendor');
        $this->bank = BankAccount::query()->where('account_type', 'checking')->where('is_active', true)->firstOrFail();
        $this->warehouse = Warehouse::create(['name' => 'Penang Hub', 'is_active' => true]);
        $this->item = Item::create([
            'name' => 'Desk', 'sku' => 'DESK-1', 'type' => 'product', 'is_active' => true,
            'category_id' => ItemCategory::create(['name' => 'Furniture', 'color' => '#10b981'])->id,
            'unit_id' => Unit::create(['unit_name' => 'Piece'])->id,
            'sale_price' => '500.00', 'purchase_price' => '300.00',
        ]);
        WarehouseStock::create(['item_id' => $this->item->id, 'warehouse_id' => $this->warehouse->id, 'quantity' => 100]);
    }

    private function salesInvoice(int $quantity = 2): SalesInvoice
    {
        $invoice = new SalesInvoice;
        $invoice->saveWithLines(['type' => 'product', 'invoice_date' => '2026-10-01', 'due_date' => '2026-10-31', 'customer_id' => $this->client->id, 'warehouse_id' => $this->warehouse->id],
            [['item_id' => $this->item->id, 'quantity' => $quantity, 'unit_price' => '500.00']]);
        $invoice->post();

        return $invoice->fresh();
    }

    private function balance(string $code): string
    {
        return ChartOfAccount::query()->withTotals()->where('account_code', $code)->sole()->currentBalance();
    }

    private function approvedCreditNote(SalesInvoice $invoice, string $amount): CreditNote
    {
        $note = new CreditNote(['credit_note_date' => '2026-10-02', 'customer_id' => $this->client->id, 'invoice_id' => $invoice->id, 'reason' => 'Goodwill']);
        $note->forceFill(['subtotal' => $amount, 'total_amount' => $amount, 'credit_note_number' => 'CN-TEST-1'])->save();
        $note->items()->create(['item_id' => $this->item->id, 'quantity' => 1, 'unit_price' => $amount, 'total_amount' => $amount]);
        $note->approve($this->userWithRole());

        return $note;
    }

    public function test_a_customer_payment_with_a_credit_note_settles_the_invoice(): void
    {
        $invoice = $this->salesInvoice(); // 1000.00 owed
        $note = $this->approvedCreditNote($invoice, '200.00');
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('account.customer-payments.store'), [
            'payment_date' => '2026-10-05', 'party_id' => $this->client->id, 'bank_account_id' => $this->bank->id, 'payment_amount' => '800.00',
            'allocations' => [['invoice_id' => $invoice->id, 'amount' => '1000.00']],
            'applications' => [['note_id' => $note->id, 'amount' => '200.00']],
        ])->assertSessionHasNoErrors();
        $payment = Payment::query()->sole();
        $this->assertSame(sprintf('CP-2026-10-%03d', $payment->id), $payment->payment_number);

        // Nothing moves until it clears.
        $this->assertSame('posted', $invoice->fresh()->status);

        $this->actingAs($user)->put(route('account.customer-payments.clear', $payment))->assertSessionHasNoErrors();

        $invoice->refresh();
        $this->assertSame('paid', $invoice->status);
        $this->assertSame('0.00', $invoice->balance_amount);
        $this->assertSame('applied', $note->fresh()->status);
        // Receivable: +1000 invoice − 200 credit note − 800 cash = 0.
        $this->assertSame('0.00', $this->balance('1100'));
        $this->assertSame(
            number_format((float) $this->bank->opening_balance + 800, 2, '.', ''),
            ChartOfAccount::query()->withTotals()->findOrFail($this->bank->gl_account_id)->currentBalance(),
        );
    }

    public function test_a_part_payment_leaves_the_invoice_partial(): void
    {
        $invoice = $this->salesInvoice();
        $payment = new Payment(['payment_date' => '2026-10-05', 'party_id' => $this->client->id, 'bank_account_id' => $this->bank->id, 'payment_amount' => '400.00']);
        $payment->forceFill(['kind' => 'customer'])->save();
        $payment->allocations()->create(['invoice_type' => $invoice->getMorphClass(), 'invoice_id' => $invoice->id, 'allocated_amount' => '400.00']);
        $payment->assignNumber();
        $payment->clear();

        $invoice->refresh();
        $this->assertSame('partial', $invoice->status);
        $this->assertSame('600.00', $invoice->balance_amount);
    }

    public function test_the_month_strip_narrows_the_list_and_its_tab_counts(): void
    {
        foreach (['2026-09-28', '2026-10-05', '2026-10-20'] as $date) {
            $payment = new Payment(['payment_date' => $date, 'party_id' => $this->client->id, 'bank_account_id' => $this->bank->id, 'payment_amount' => '50.00']);
            $payment->forceFill(['kind' => 'customer'])->save();
        }

        $this->actingAs($this->userWithRole())->get(route('account.customer-payments.index', ['month' => '2026-10']))
            ->assertInertia(fn ($page) => $page->has('payments.data', 2)->where('counts.all', 2)->where('filters.month', '2026-10'));
        // Anything that isn't YYYY-MM is ignored.
        $this->get(route('account.customer-payments.index', ['month' => '2026-13']))->assertInertia(fn ($page) => $page->has('payments.data', 3));
    }

    public function test_a_vendor_payment_with_a_debit_note_settles_the_bill(): void
    {
        $bill = new PurchaseInvoice;
        $bill->saveWithLines(['invoice_date' => '2026-10-01', 'due_date' => '2026-10-31', 'vendor_id' => $this->vendor->id, 'warehouse_id' => $this->warehouse->id],
            [['item_id' => $this->item->id, 'quantity' => 3, 'unit_price' => '300.00']]);
        $bill->post();
        $note = new DebitNote(['debit_note_date' => '2026-10-02', 'vendor_id' => $this->vendor->id, 'invoice_id' => $bill->id, 'reason' => 'Damaged']);
        $note->forceFill(['subtotal' => '300.00', 'total_amount' => '300.00', 'debit_note_number' => 'DN-TEST-1'])->save();
        $note->approve($this->userWithRole());

        $this->actingAs($this->userWithRole())->post(route('account.vendor-payments.store'), [
            'payment_date' => '2026-10-05', 'party_id' => $this->vendor->id, 'bank_account_id' => $this->bank->id, 'payment_amount' => '600.00',
            'allocations' => [['invoice_id' => $bill->id, 'amount' => '900.00']],
            'applications' => [['note_id' => $note->id, 'amount' => '300.00']],
        ])->assertSessionHasNoErrors();
        Payment::query()->sole()->clear();

        $this->assertSame('paid', $bill->fresh()->status);
        $this->assertSame('applied', $note->fresh()->status);
        // Payable: +900 bill − 300 debit note − 600 cash = 0.
        $this->assertSame('0.00', $this->balance('2000'));
    }

    public function test_allocations_must_match_and_fit(): void
    {
        $invoice = $this->salesInvoice();
        $user = $this->userWithRole();
        $base = ['payment_date' => '2026-10-05', 'party_id' => $this->client->id, 'bank_account_id' => $this->bank->id];

        $this->actingAs($user)->post(route('account.customer-payments.store'), [...$base, 'payment_amount' => '500',
            'allocations' => [['invoice_id' => $invoice->id, 'amount' => '400']]])->assertSessionHasErrors('allocations');
        $this->actingAs($user)->post(route('account.customer-payments.store'), [...$base, 'payment_amount' => '1500',
            'allocations' => [['invoice_id' => $invoice->id, 'amount' => '1500']]])->assertSessionHasErrors('allocations.0.amount');
        $this->actingAs($user)->post(route('account.customer-payments.store'), [...$base, 'party_id' => $this->vendor->id, 'payment_amount' => '100',
            'allocations' => [['invoice_id' => $invoice->id, 'amount' => '100']]])->assertSessionHasErrors(['party_id', 'allocations.0.invoice_id']);

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_cancelled_payments_change_nothing_and_clients_see_only_theirs(): void
    {
        $invoice = $this->salesInvoice();
        $this->actingAs($this->userWithRole())->post(route('account.customer-payments.store'), [
            'payment_date' => '2026-10-05', 'party_id' => $this->client->id, 'bank_account_id' => $this->bank->id, 'payment_amount' => '1000',
            'allocations' => [['invoice_id' => $invoice->id, 'amount' => '1000']],
        ]);
        $payment = Payment::query()->sole();
        $this->actingAs($this->userWithRole())->put(route('account.customer-payments.cancel', $payment));

        $this->assertSame('cancelled', $payment->fresh()->status);
        $this->assertSame('posted', $invoice->fresh()->status);

        $this->actingAs($this->client)->get(route('account.customer-payments.index'))->assertInertia(fn ($page) => $page->has('payments.data', 1));
        $stranger = User::factory()->create(['type' => 'client'])->assignRole('client');
        $this->actingAs($stranger)->get(route('account.customer-payments.show', $payment))->assertNotFound();
        $this->actingAs($this->client)->put(route('account.customer-payments.clear', $payment))->assertForbidden();
        // A vendor-payment URL never serves a customer payment.
        $this->actingAs($this->userWithRole())->get(route('account.vendor-payments.show', $payment))->assertNotFound();
    }

    public function test_renders_the_pages(): void
    {
        $this->salesInvoice();
        $user = $this->userWithRole();

        foreach (['account.customer-payments.index', 'account.customer-payments.create', 'account.vendor-payments.index', 'account.vendor-payments.create'] as $name) {
            $this->actingAs($user)->get(route($name))->assertOk();
        }
        $this->actingAs($user)->get(route('account.customer-payments.create'))->assertInertia(fn ($page) => $page->component('account/payments/form')->has('invoices', 1));
    }
}
