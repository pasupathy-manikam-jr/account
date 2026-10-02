<?php

namespace Tests\Feature\Purchase;

use App\Models\ChartOfAccount;
use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\PurchaseInvoice;
use App\Models\Tax;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Database\Seeders\LedgerSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseInvoiceTest extends TestCase
{
    use RefreshDatabase;

    private User $vendor;

    private Warehouse $warehouse;

    private Item $paper;

    private Item $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesSeeder::class, LedgerSeeder::class]);

        $this->vendor = User::factory()->create(['type' => 'vendor'])->assignRole('vendor');
        $this->warehouse = Warehouse::create(['name' => 'Shah Alam Hub', 'is_active' => true]);
        $category = ItemCategory::create(['name' => 'Stationery', 'color' => '#10b981']);
        $unit = Unit::create(['unit_name' => 'Box']);
        $this->paper = Item::create(['name' => 'A4 Paper', 'sku' => 'A4-1', 'type' => 'product', 'category_id' => $category->id, 'unit_id' => $unit->id, 'sale_price' => '25.00', 'purchase_price' => '15.00', 'is_active' => true]);
        $this->paper->taxes()->attach(Tax::create(['tax_name' => 'Sales Tax 10%', 'rate' => '10.00']));
        $this->service = Item::create(['name' => 'Delivery', 'sku' => 'DLV-1', 'type' => 'service', 'category_id' => $category->id, 'unit_id' => $unit->id, 'sale_price' => '50.00', 'purchase_price' => '0', 'is_active' => true]);
    }

    private function payload(array $overrides = []): array
    {
        return [
            'invoice_date' => '2026-10-01',
            'due_date' => '2026-10-31',
            'vendor_id' => $this->vendor->id,
            'warehouse_id' => $this->warehouse->id,
            'payment_terms' => 'Net 30',
            'notes' => null,
            'items' => [['item_id' => $this->paper->id, 'quantity' => 100, 'unit_price' => '15.00', 'discount_percentage' => 0]],
            ...$overrides,
        ];
    }

    private function bill(): PurchaseInvoice
    {
        $data = $this->payload();
        $bill = new PurchaseInvoice;
        $bill->saveWithLines(collect($data)->except('items')->all(), $data['items']);

        return $bill;
    }

    private function balance(string $code): string
    {
        return ChartOfAccount::query()->withTotals()->where('account_code', $code)->sole()->currentBalance();
    }

    public function test_creates_a_draft_bill(): void
    {
        $this->actingAs($this->userWithRole())->post(route('purchase-invoices.store'), $this->payload())->assertSessionHasNoErrors();

        $bill = PurchaseInvoice::query()->sole();
        $this->assertSame('draft', $bill->status);
        $this->assertSame('1650.00', $bill->total_amount);
        $this->assertSame(sprintf('PI-2026-10-%03d', $bill->id), $bill->invoice_number);
    }

    public function test_bills_take_stock_items_from_vendors_only(): void
    {
        $client = User::factory()->create(['type' => 'client']);

        $this->actingAs($this->userWithRole())->post(route('purchase-invoices.store'), $this->payload([
            'vendor_id' => $client->id,
            'warehouse_id' => null,
            'items' => [['item_id' => $this->service->id, 'quantity' => 1, 'unit_price' => '50']],
        ]))->assertSessionHasErrors(['vendor_id', 'warehouse_id', 'items.0.item_id']);
    }

    public function test_posting_receives_stock_and_records_the_payable(): void
    {
        $bill = $this->bill();

        $this->actingAs($this->userWithRole())->put(route('purchase-invoices.post', $bill))->assertSessionHasNoErrors();

        $this->assertSame('posted', $bill->fresh()->status);
        $this->assertSame('100.00', WarehouseStock::query()->sole()->quantity);
        $this->assertSame('1500.00', $this->balance('1200'));
        $this->assertSame('150.00', $this->balance('1500'));
        $this->assertSame('1650.00', $this->balance('2000'));

        // Posted bills are locked.
        $this->actingAs($this->userWithRole())->put(route('purchase-invoices.post', $bill))->assertSessionHasErrors('status');
        $this->actingAs($this->userWithRole())->delete(route('purchase-invoices.destroy', $bill));
        $this->assertModelExists($bill);
    }

    public function test_vendors_see_their_own_bills_only(): void
    {
        $mine = $this->bill();
        $other = User::factory()->create(['type' => 'vendor'])->assignRole('vendor');

        $this->actingAs($this->vendor)->get(route('purchase-invoices.index'))->assertInertia(fn ($page) => $page->has('invoices.data', 1));
        $this->actingAs($this->vendor)->get(route('purchase-invoices.pdf', $mine))->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->actingAs($other)->get(route('purchase-invoices.show', $mine))->assertNotFound();
        $this->actingAs($this->vendor)->post(route('purchase-invoices.store'), $this->payload())->assertForbidden();
        $this->actingAs($this->userWithRole('client'))->get(route('purchase-invoices.index'))->assertForbidden();
    }

    public function test_filters_by_warehouse_and_invoice_date_range(): void
    {
        $september = $this->bill();
        $september->forceFill(['invoice_date' => '2026-09-10'])->save();
        $other = Warehouse::create(['name' => 'Penang Store', 'is_active' => true]);
        $october = $this->bill();
        $october->forceFill(['warehouse_id' => $other->id])->save();
        $this->actingAs($this->userWithRole());

        $this->get(route('purchase-invoices.index', ['warehouse_id' => $other->id]))
            ->assertInertia(fn ($page) => $page->has('invoices.data', 1)->where('invoices.data.0.id', $october->id)->has('warehouses', 2));
        $this->get(route('purchase-invoices.index', ['date_from' => '2026-09-01', 'date_to' => '2026-09-30']))
            ->assertInertia(fn ($page) => $page->has('invoices.data', 1)->where('invoices.data.0.id', $september->id));
        $this->get(route('purchase-invoices.index', ['date_from' => '2026-10-01', 'date_to' => '2026-09-01']))->assertSessionHasErrors('date_to');
    }

    public function test_renders_the_pages(): void
    {
        $bill = $this->bill();
        $user = $this->userWithRole();

        $this->actingAs($user)->get(route('purchase-invoices.index'))->assertOk();
        $this->actingAs($user)->get(route('purchase-invoices.create'))->assertOk()->assertInertia(fn ($page) => $page->component('purchase-invoices/form')->where('items.0.sale_price', '15.00'));
        $this->actingAs($user)->get(route('purchase-invoices.edit', $bill))->assertOk();
        $this->actingAs($user)->get(route('purchase-invoices.show', $bill))->assertOk()->assertInertia(fn ($page) => $page->component('purchase-invoices/show'));
        $this->actingAs($user)->get(route('purchase-invoices.pdf', $bill))->assertOk();
    }
}
