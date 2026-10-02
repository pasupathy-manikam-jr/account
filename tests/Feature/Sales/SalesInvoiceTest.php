<?php

namespace Tests\Feature\Sales;

use App\Models\ChartOfAccount;
use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\JournalEntryItem;
use App\Models\SalesInvoice;
use App\Models\SalesProposal;
use App\Models\Tax;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Database\Seeders\LedgerSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SalesInvoiceTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    private Warehouse $warehouse;

    private Item $product;

    private Item $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesSeeder::class, LedgerSeeder::class]);

        $this->client = User::factory()->create(['type' => 'client'])->assignRole('client');
        $this->warehouse = Warehouse::create(['name' => 'Shah Alam Hub', 'is_active' => true]);
        $category = ItemCategory::create(['name' => 'General', 'color' => '#10b981']);
        $unit = Unit::create(['unit_name' => 'Piece']);
        $sst = Tax::create(['tax_name' => 'Sales Tax 10%', 'rate' => '10.00']);

        $this->product = Item::create(['name' => 'Office Chair', 'sku' => 'CHAIR-1', 'type' => 'product', 'category_id' => $category->id, 'unit_id' => $unit->id, 'sale_price' => '250.00', 'purchase_price' => '120.00', 'is_active' => true]);
        $this->product->taxes()->attach($sst);
        WarehouseStock::create(['item_id' => $this->product->id, 'warehouse_id' => $this->warehouse->id, 'quantity' => 10]);

        $this->service = Item::create(['name' => 'Installation', 'sku' => 'SVC-1', 'type' => 'service', 'category_id' => $category->id, 'unit_id' => $unit->id, 'sale_price' => '80.00', 'purchase_price' => '0', 'is_active' => true]);
    }

    private function payload(array $overrides = []): array
    {
        return [
            'type' => 'product',
            'invoice_date' => '2026-10-01',
            'due_date' => '2026-10-31',
            'customer_id' => $this->client->id,
            'warehouse_id' => $this->warehouse->id,
            'payment_terms' => 'Net 30',
            'notes' => null,
            'items' => [['item_id' => $this->product->id, 'quantity' => 4, 'unit_price' => '250.00', 'discount_percentage' => 0]],
            ...$overrides,
        ];
    }

    private function invoice(array $overrides = []): SalesInvoice
    {
        $data = $this->payload($overrides);
        $invoice = new SalesInvoice;
        $invoice->saveWithLines(collect($data)->except('items')->all(), $data['items']);

        return $invoice;
    }

    /**
     * @return array<string, array{debit: string, credit: string}>
     */
    private function postings(SalesInvoice $invoice): array
    {
        return JournalEntryItem::query()
            ->whereHas('journalEntry', fn ($q) => $q->whereMorphedTo('reference', $invoice))
            ->with('account:id,account_code')
            ->get()
            ->mapWithKeys(fn (JournalEntryItem $line) => [$line->account->account_code => ['debit' => $line->debit_amount, 'credit' => $line->credit_amount]])
            ->all();
    }

    public function test_creates_a_draft_invoice(): void
    {
        $this->actingAs($this->userWithRole())->post(route('sales-invoices.store'), $this->payload())->assertSessionHasNoErrors();

        $invoice = SalesInvoice::query()->sole();
        $this->assertSame('draft', $invoice->status);
        $this->assertSame('1100.00', $invoice->total_amount);
        $this->assertSame('1100.00', $invoice->balance_amount);
        $this->assertSame(sprintf('SI-2026-10-%03d', $invoice->id), $invoice->invoice_number);
    }

    public function test_product_and_service_invoices_only_take_matching_items(): void
    {
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('sales-invoices.store'), $this->payload([
            'items' => [['item_id' => $this->service->id, 'quantity' => 1, 'unit_price' => '80']],
        ]))->assertSessionHasErrors('items.0.item_id');

        $this->actingAs($user)->post(route('sales-invoices.store'), $this->payload([
            'type' => 'service',
            'items' => [['item_id' => $this->product->id, 'quantity' => 1, 'unit_price' => '250']],
        ]))->assertSessionHasErrors(['items.0.item_id', 'warehouse_id']);

        $this->actingAs($user)->post(route('sales-invoices.store'), $this->payload(['warehouse_id' => null]))->assertSessionHasErrors('warehouse_id');

        $this->assertDatabaseCount('sales_invoices', 0);
    }

    public function test_posting_a_product_invoice_writes_revenue_and_cost_and_takes_stock(): void
    {
        $invoice = $this->invoice(['items' => [['item_id' => $this->product->id, 'quantity' => 4, 'unit_price' => '250.00', 'discount_percentage' => 10]]]);

        $this->actingAs($this->userWithRole())->put(route('sales-invoices.post', $invoice))->assertSessionHasNoErrors();

        // 4 × 250 = 1000; −10% = 900; SST 10% = 90; total 990. Cost 4 × 120 = 480.
        $this->assertSame([
            '1100' => ['debit' => '990.00', 'credit' => '0.00'],
            '4100' => ['debit' => '0.00', 'credit' => '900.00'],
            '2210' => ['debit' => '0.00', 'credit' => '90.00'],
            '5100' => ['debit' => '480.00', 'credit' => '0.00'],
            '1200' => ['debit' => '0.00', 'credit' => '480.00'],
        ], $this->postings($invoice));
        $this->assertSame('posted', $invoice->fresh()->status);
        $this->assertSame('6.00', WarehouseStock::query()->sole()->quantity);
        $this->assertSame('990.00', ChartOfAccount::query()->withTotals()->where('account_code', '1100')->sole()->currentBalance());
    }

    public function test_posting_a_service_invoice_credits_service_revenue_without_stock(): void
    {
        $invoice = $this->invoice([
            'type' => 'service',
            'warehouse_id' => null,
            'items' => [['item_id' => $this->service->id, 'quantity' => 2, 'unit_price' => '80.00']],
        ]);

        $invoice->post();

        $this->assertSame([
            '1100' => ['debit' => '160.00', 'credit' => '0.00'],
            '4200' => ['debit' => '0.00', 'credit' => '160.00'],
        ], $this->postings($invoice));
        $this->assertSame('10.00', WarehouseStock::query()->sole()->quantity);
    }

    public function test_cannot_post_without_enough_stock_or_twice(): void
    {
        $user = $this->userWithRole();
        $short = $this->invoice(['items' => [['item_id' => $this->product->id, 'quantity' => 11, 'unit_price' => '250.00']]]);

        $this->actingAs($user)->put(route('sales-invoices.post', $short))->assertSessionHasErrors('status');
        $this->assertSame('draft', $short->fresh()->status);
        $this->assertDatabaseCount('journal_entries', 0);
        $this->assertSame('10.00', WarehouseStock::query()->sole()->quantity);

        $invoice = $this->invoice();
        $invoice->post();
        $this->actingAs($user)->put(route('sales-invoices.post', $invoice))->assertSessionHasErrors('status');
        $this->assertDatabaseCount('journal_entries', 2);
    }

    public function test_posted_invoices_are_locked(): void
    {
        $user = $this->userWithRole();
        $invoice = $this->invoice();
        $invoice->post();

        $this->actingAs($user)->put(route('sales-invoices.update', $invoice), $this->payload(['notes' => 'Changed']));
        $this->actingAs($user)->delete(route('sales-invoices.destroy', $invoice));

        $this->assertModelExists($invoice);
        $this->assertNull($invoice->fresh()->notes);
    }

    public function test_an_accepted_proposal_converts_once_into_a_draft_invoice(): void
    {
        $user = $this->userWithRole();
        $proposal = new SalesProposal;
        $proposal->forceFill(['status' => 'sent']);
        $proposal->saveWithLines([
            'proposal_date' => '2026-10-01', 'due_date' => '2026-10-15', 'customer_id' => $this->client->id, 'warehouse_id' => $this->warehouse->id,
        ], [['item_id' => $this->product->id, 'quantity' => 2, 'unit_price' => '240.00', 'discount_percentage' => 0]]);

        $this->actingAs($user)->post(route('sales-proposals.convert', $proposal));
        $this->assertDatabaseCount('sales_invoices', 0);

        $proposal->forceFill(['status' => 'accepted'])->save();
        $this->actingAs($user)->post(route('sales-proposals.convert', $proposal))->assertRedirect();
        $this->actingAs($user)->post(route('sales-proposals.convert', $proposal));

        $invoice = SalesInvoice::query()->with('items')->sole();
        $this->assertSame($invoice->id, $proposal->fresh()->invoice_id);
        $this->assertSame('draft', $invoice->status);
        $this->assertSame($proposal->total_amount, $invoice->total_amount);
        $this->assertSame('240.00', $invoice->items[0]->unit_price);

        // The proposal list shows the converted invoice's balance.
        $invoice->forceFill(['status' => 'partial', 'paid_amount' => '100.00'])->save();
        $this->actingAs($user)->get(route('sales-proposals.index'))
            ->assertInertia(fn ($page) => $page->where('proposals.data.0.invoice.balance_amount', number_format((float) $invoice->total_amount - 100, 2, '.', '')));
    }

    public function test_clients_see_and_download_only_their_own_invoices(): void
    {
        $mine = $this->invoice();
        $other = User::factory()->create(['type' => 'client'])->assignRole('client');
        $theirs = $this->invoice(['customer_id' => $other->id]);

        $this->actingAs($this->client)->get(route('sales-invoices.index'))
            ->assertInertia(fn ($page) => $page->has('invoices.data', 1)->where('invoices.data.0.id', $mine->id));
        $this->actingAs($this->client)->get(route('sales-invoices.show', $theirs))->assertNotFound();
        $this->actingAs($this->client)->get(route('sales-invoices.pdf', $mine))->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->actingAs($this->client)->put(route('sales-invoices.post', $mine))->assertForbidden();
        $this->actingAs($this->userWithRole('vendor'))->get(route('sales-invoices.index'))->assertForbidden();
    }

    public function test_renders_the_pages(): void
    {
        $invoice = $this->invoice();
        $user = $this->userWithRole();

        $this->actingAs($user)->get(route('sales-invoices.index'))->assertOk()->assertInertia(fn ($page) => $page->component('sales-invoices/index'));
        $this->actingAs($user)->get(route('sales-invoices.create'))->assertOk()->assertInertia(fn ($page) => $page->component('sales-invoices/form'));
        $this->actingAs($user)->get(route('sales-invoices.show', $invoice))->assertOk()->assertInertia(fn ($page) => $page->component('sales-invoices/show')->where('invoice.balance_amount', '1100.00'));
    }
}
