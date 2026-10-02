<?php

namespace Tests\Feature\Sales;

use App\Models\BankAccount;
use App\Models\ChartOfAccount;
use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\Retainer;
use App\Models\RetainerPayment;
use App\Models\SalesInvoice;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Database\Seeders\LedgerSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RetainerTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    private Warehouse $warehouse;

    private Item $item;

    private BankAccount $bank;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesSeeder::class, LedgerSeeder::class]);

        $this->client = User::factory()->create(['type' => 'client'])->assignRole('client');
        $this->warehouse = Warehouse::create(['name' => 'Ipoh Store', 'is_active' => true]);
        $this->item = Item::create([
            'name' => 'Server Rack', 'sku' => 'RACK-1', 'type' => 'product', 'is_active' => true,
            'category_id' => ItemCategory::create(['name' => 'IT', 'color' => '#10b981'])->id,
            'unit_id' => Unit::create(['unit_name' => 'Unit'])->id,
            'sale_price' => '1000.00', 'purchase_price' => '600.00',
        ]);
        WarehouseStock::create(['item_id' => $this->item->id, 'warehouse_id' => $this->warehouse->id, 'quantity' => 5]);
        $this->bank = BankAccount::query()->where('account_type', 'checking')->where('is_active', true)->firstOrFail();
    }

    private function retainer(string $status = 'accepted'): Retainer
    {
        $retainer = new Retainer;
        $retainer->forceFill(['status' => $status]);
        $retainer->saveWithLines([
            'retainer_date' => '2026-10-01', 'due_date' => '2026-10-31',
            'customer_id' => $this->client->id, 'warehouse_id' => $this->warehouse->id,
        ], [['item_id' => $this->item->id, 'quantity' => 2, 'unit_price' => '1000.00', 'discount_percentage' => 0]]);

        return $retainer;
    }

    private function pay(Retainer $retainer, string $amount): RetainerPayment
    {
        $this->actingAs($this->userWithRole())->post(route('retainer-payments.store'), [
            'payment_date' => '2026-10-02',
            'customer_id' => $this->client->id,
            'bank_account_id' => $this->bank->id,
            'payment_amount' => $amount,
            'reference_number' => 'FPX-123',
            'allocations' => [['retainer_id' => $retainer->id, 'allocated_amount' => $amount]],
        ])->assertSessionHasNoErrors();

        return RetainerPayment::query()->latest('id')->firstOrFail();
    }

    private function balance(string $code): string
    {
        return ChartOfAccount::query()->withTotals()->where('account_code', $code)->sole()->currentBalance();
    }

    public function test_a_retainer_is_sent_then_accepted_like_a_proposal(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('retainers.store'), [
            'retainer_date' => '2026-10-01', 'due_date' => '2026-10-31', 'customer_id' => $this->client->id, 'warehouse_id' => $this->warehouse->id,
            'items' => [['item_id' => $this->item->id, 'quantity' => 2, 'unit_price' => '1000.00']],
        ])->assertSessionHasNoErrors();
        $retainer = Retainer::query()->sole();
        $this->assertSame(sprintf('RET-2026-10-%03d', $retainer->id), $retainer->retainer_number);
        $this->assertSame('2000.00', $retainer->balance_amount);

        $this->actingAs($user)->put(route('retainers.send', $retainer));
        $this->actingAs($this->client)->put(route('retainers.accept', $retainer));
        $this->assertSame('accepted', $retainer->fresh()->status);
    }

    public function test_clearing_a_payment_banks_the_deposit_and_credits_the_retainer(): void
    {
        $retainer = $this->retainer();
        $payment = $this->pay($retainer, '800.00');

        // Nothing moves until the money is confirmed in the bank.
        $this->assertSame('pending', $payment->status);
        $this->assertSame('0.00', $retainer->fresh()->paid_amount);

        $this->actingAs($this->userWithRole())->put(route('retainer-payments.clear', $payment))->assertSessionHasNoErrors();

        $retainer->refresh();
        $this->assertSame('cleared', $payment->fresh()->status);
        $this->assertSame('800.00', $retainer->paid_amount);
        $this->assertSame('1200.00', $retainer->balance_amount);
        $this->assertSame('partial', $retainer->status);
        $this->assertSame('800.00', $this->balance('2350'));
        $this->assertSame(
            number_format((float) $this->bank->opening_balance + 800, 2, '.', ''),
            $this->balance($this->bank->glAccount->account_code),
        );

        $this->pay($retainer, '1200.00')->clear();
        $this->assertSame('paid', $retainer->fresh()->status);
    }

    public function test_allocations_must_match_the_payment_and_fit_the_balance(): void
    {
        $retainer = $this->retainer();
        $draft = $this->retainer('draft');
        $base = [
            'payment_date' => '2026-10-02', 'customer_id' => $this->client->id, 'bank_account_id' => $this->bank->id,
        ];
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('retainer-payments.store'), [...$base, 'payment_amount' => '500',
            'allocations' => [['retainer_id' => $retainer->id, 'allocated_amount' => '400']]])->assertSessionHasErrors('allocations');
        $this->actingAs($user)->post(route('retainer-payments.store'), [...$base, 'payment_amount' => '2500',
            'allocations' => [['retainer_id' => $retainer->id, 'allocated_amount' => '2500']]])->assertSessionHasErrors('allocations.0.allocated_amount');
        $this->actingAs($user)->post(route('retainer-payments.store'), [...$base, 'payment_amount' => '100',
            'allocations' => [['retainer_id' => $draft->id, 'allocated_amount' => '100']]])->assertSessionHasErrors('allocations.0.retainer_id');

        $this->assertDatabaseCount('retainer_payments', 0);
    }

    public function test_a_cancelled_payment_records_nothing(): void
    {
        $retainer = $this->retainer();
        $payment = $this->pay($retainer, '500.00');

        $this->actingAs($this->userWithRole())->put(route('retainer-payments.cancel', $payment));

        $this->assertSame('cancelled', $payment->fresh()->status);
        $this->assertSame('0.00', $retainer->fresh()->paid_amount);
        $this->assertDatabaseCount('journal_entries', 0);
        $this->actingAs($this->userWithRole())->put(route('retainer-payments.clear', $payment))->assertSessionHasErrors('status');
    }

    public function test_the_converted_invoice_is_settled_by_the_deposit_when_posted(): void
    {
        $retainer = $this->retainer();
        $this->pay($retainer, '800.00')->clear();

        $this->actingAs($this->userWithRole())->post(route('retainers.convert', $retainer))->assertRedirect();
        $invoice = SalesInvoice::query()->sole();
        $this->assertSame($retainer->id, $invoice->retainer_id);
        $this->assertSame($invoice->id, $retainer->fresh()->invoice_id);

        $invoice->post();
        $invoice->refresh();

        $this->assertSame('partial', $invoice->status);
        $this->assertSame('800.00', $invoice->paid_amount);
        $this->assertSame('1200.00', $invoice->balance_amount);
        // The deposit liability is used up, and only the unpaid part is still receivable.
        $this->assertSame('0.00', $this->balance('2350'));
        $this->assertSame('1200.00', $this->balance('1100'));

        // Converting twice does nothing.
        $this->actingAs($this->userWithRole())->post(route('retainers.convert', $retainer));
        $this->assertDatabaseCount('sales_invoices', 1);
    }

    public function test_duplicates_into_a_new_draft(): void
    {
        $retainer = $this->retainer('paid');

        $this->actingAs($this->userWithRole())->post(route('retainers.duplicate', $retainer))->assertRedirect();

        $copy = Retainer::query()->latest('id')->firstOrFail();
        $this->assertNotSame($retainer->id, $copy->id);
        $this->assertSame('draft', $copy->status);
        $this->assertSame('0.00', $copy->paid_amount);
        $this->assertSame($retainer->total_amount, $copy->total_amount);
    }

    public function test_clients_see_their_own_retainers_and_payments_only(): void
    {
        $retainer = $this->retainer();
        $payment = $this->pay($retainer, '100.00');
        $stranger = User::factory()->create(['type' => 'client'])->assignRole('client');

        $this->actingAs($this->client)->get(route('retainers.index'))->assertInertia(fn ($page) => $page->has('retainers.data', 1));
        $this->actingAs($this->client)->get(route('retainer-payments.show', $payment))->assertOk();
        $this->actingAs($stranger)->get(route('retainers.show', $retainer))->assertNotFound();
        $this->actingAs($stranger)->get(route('retainer-payments.show', $payment))->assertNotFound();
        $this->actingAs($this->client)->put(route('retainer-payments.clear', $payment))->assertForbidden();
        $this->actingAs($this->client)->post(route('retainers.duplicate', $retainer))->assertForbidden();
        $this->actingAs($this->userWithRole('vendor'))->get(route('retainers.index'))->assertForbidden();
    }

    public function test_renders_the_pages(): void
    {
        $retainer = $this->retainer();
        $payment = $this->pay($retainer, '100.00');
        $user = $this->userWithRole();

        foreach (['retainers.index', 'retainers.create', 'retainer-payments.index', 'retainer-payments.create'] as $name) {
            $this->actingAs($user)->get(route($name))->assertOk();
        }
        $this->actingAs($user)->get(route('retainers.show', $retainer))->assertOk()->assertInertia(fn ($page) => $page->component('retainers/show'));
        $this->actingAs($user)->get(route('retainers.pdf', $retainer))->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->actingAs($user)->get(route('retainer-payments.show', $payment))->assertOk()->assertInertia(fn ($page) => $page->component('retainer-payments/show'));
    }
}
