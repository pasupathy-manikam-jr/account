<?php

namespace Tests\Feature\Sales;

use App\Models\DebitNote;
use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\JournalEntryItem;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseReturn;
use App\Models\Tax;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Database\Seeders\LedgerSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseReturnTest extends TestCase
{
    use RefreshDatabase;

    private User $vendor;

    private Warehouse $warehouse;

    private Item $chair;

    private PurchaseInvoice $invoice;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesSeeder::class, LedgerSeeder::class]);

        $this->vendor = User::factory()->create(['type' => 'vendor'])->assignRole('vendor');
        $this->warehouse = Warehouse::create(['name' => 'Penang Hub', 'is_active' => true]);
        $this->chair = Item::create([
            'name' => 'Office Chair', 'sku' => 'CHAIR-1', 'type' => 'product', 'is_active' => true,
            'category_id' => ItemCategory::create(['name' => 'Furniture', 'color' => '#10b981'])->id,
            'unit_id' => Unit::create(['unit_name' => 'Piece'])->id,
            'sale_price' => '250.00', 'purchase_price' => '120.00',
        ]);
        $this->chair->taxes()->attach(Tax::create(['tax_name' => 'Sales Tax 10%', 'rate' => '10.00']));
        WarehouseStock::create(['item_id' => $this->chair->id, 'warehouse_id' => $this->warehouse->id, 'quantity' => 10]);

        $this->invoice = new PurchaseInvoice;
        $this->invoice->saveWithLines([
            'invoice_date' => '2026-10-01', 'due_date' => '2026-10-31',
            'vendor_id' => $this->vendor->id, 'warehouse_id' => $this->warehouse->id,
        ], [['item_id' => $this->chair->id, 'quantity' => 4, 'unit_price' => '250.00', 'discount_percentage' => 10]]);
        $this->invoice->post();
    }

    private function payload(string $quantity = '2', array $overrides = []): array
    {
        return [
            'original_invoice_id' => $this->invoice->id,
            'return_date' => '2026-10-05',
            'warehouse_id' => $this->warehouse->id,
            'reason' => 'defective',
            'notes' => 'Wobbly legs.',
            'items' => [['original_invoice_item_id' => $this->invoice->items()->value('id'), 'quantity' => $quantity]],
            ...$overrides,
        ];
    }

    public function test_creates_a_return_priced_as_on_the_invoice(): void
    {
        $this->actingAs($this->userWithRole())->post(route('purchase-returns.store'), $this->payload())->assertSessionHasNoErrors();

        $return = PurchaseReturn::query()->with('items')->sole();
        // 2 × 250 = 500; −10% = 450; SST 10% = 45; total 495.
        $this->assertSame('495.00', $return->total_amount);
        $this->assertSame('45.00', $return->tax_amount);
        $this->assertSame('draft', $return->status);
        $this->assertSame($this->vendor->id, $return->vendor_id);
        $this->assertSame(sprintf('PR-2026-10-%03d', $return->id), $return->return_number);
    }

    public function test_cannot_return_more_than_is_left_on_the_invoice(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('purchase-returns.store'), $this->payload('3'))->assertSessionHasNoErrors();

        $this->actingAs($user)->post(route('purchase-returns.store'), $this->payload('2'))->assertSessionHasErrors('items.0.quantity');
        $this->actingAs($user)->post(route('purchase-returns.store'), $this->payload('1', ['return_date' => '2026-09-01']))->assertSessionHasErrors('return_date');
        $this->actingAs($user)->post(route('purchase-returns.store'), $this->payload('1', ['reason' => 'changed_mind', 'items' => []]))->assertSessionHasErrors(['reason', 'items']);

        $this->assertDatabaseCount('purchase_returns', 1);
    }

    public function test_completing_takes_stock_out_and_the_debit_note_reduces_the_payable(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('purchase-returns.store'), $this->payload());
        $return = PurchaseReturn::query()->sole();

        // Must be approved before it can be completed.
        $this->actingAs($user)->put(route('purchase-returns.complete', $return))->assertSessionHasErrors('status');
        $this->actingAs($user)->put(route('purchase-returns.approve', $return));
        $this->actingAs($user)->put(route('purchase-returns.complete', $return))->assertSessionHasNoErrors();

        $this->assertSame('completed', $return->fresh()->status);
        $this->assertSame('12.00', WarehouseStock::query()->sole()->quantity); // 10 + 4 bought − 2 sent back

        $note = DebitNote::query()->with('items')->sole();
        $this->assertSame('draft', $note->status);
        $this->assertSame('495.00', $note->total_amount);
        $this->assertSame('495.00', $note->balance_amount);
        $this->assertCount(1, $note->items);

        $this->actingAs($user)->put(route('account.debit-notes.approve', $note))->assertSessionHasNoErrors();

        $postings = JournalEntryItem::query()
            ->whereHas('journalEntry', fn ($q) => $q->whereMorphedTo('reference', $note))
            ->with('account:id,account_code')->get()
            ->mapWithKeys(fn ($line) => [$line->account->account_code => [$line->debit_amount, $line->credit_amount]])
            ->all();
        $this->assertSame([
            '2000' => ['495.00', '0.00'],
            '1200' => ['0.00', '450.00'],
            '1500' => ['0.00', '45.00'],
        ], $postings);
        $this->assertSame('approved', $note->fresh()->status);

        // Approving twice does nothing more.
        $this->actingAs($user)->put(route('account.debit-notes.approve', $note))->assertSessionHasErrors('status');
        $this->actingAs($user)->delete(route('account.debit-notes.destroy', $note));
        $this->assertModelExists($note);
    }

    public function test_only_draft_returns_can_be_deleted(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('purchase-returns.store'), $this->payload());
        $return = PurchaseReturn::query()->sole();
        $return->approve();

        $this->actingAs($user)->delete(route('purchase-returns.destroy', $return));
        $this->assertModelExists($return);
    }

    public function test_vendors_see_their_own_returns_and_debit_notes_only(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('purchase-returns.store'), $this->payload());
        $return = PurchaseReturn::query()->sole();
        $return->approve();
        $note = $return->complete();

        $this->actingAs($this->vendor)->get(route('purchase-returns.index'))->assertInertia(fn ($page) => $page->has('returns.data', 1));
        $this->actingAs($this->vendor)->get(route('account.debit-notes.show', $note))->assertOk();

        $stranger = User::factory()->create(['type' => 'vendor'])->assignRole('vendor');
        $this->actingAs($stranger)->get(route('purchase-returns.index'))->assertInertia(fn ($page) => $page->has('returns.data', 0));
        $this->actingAs($stranger)->get(route('purchase-returns.show', $return))->assertNotFound();
        $this->actingAs($stranger)->get(route('account.debit-notes.show', $note))->assertNotFound();
        $this->actingAs($this->vendor)->put(route('account.debit-notes.approve', $note))->assertForbidden();
        $this->actingAs($this->userWithRole('client'))->get(route('purchase-returns.index'))->assertForbidden();
    }

    public function test_renders_the_pages(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('purchase-returns.store'), $this->payload());
        $return = PurchaseReturn::query()->sole();
        $return->approve();
        $note = $return->complete();

        $this->actingAs($user)->get(route('purchase-returns.create'))->assertOk()->assertInertia(fn ($page) => $page->component('purchase-returns/form')->has('invoices', 1)->where('invoices.0.items.0.returnable', '2.00'));
        $this->actingAs($user)->get(route('purchase-returns.show', $return))->assertOk()->assertInertia(fn ($page) => $page->component('purchase-returns/show'));
        $this->actingAs($user)->get(route('account.debit-notes.index'))->assertOk()->assertInertia(fn ($page) => $page->component('account/debit-notes/index')->where('counts.draft', 1));
        $this->actingAs($user)->get(route('account.debit-notes.show', $note))->assertOk();
    }
}
