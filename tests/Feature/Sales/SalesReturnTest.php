<?php

namespace Tests\Feature\Sales;

use App\Models\CreditNote;
use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\JournalEntryItem;
use App\Models\SalesInvoice;
use App\Models\SalesReturn;
use App\Models\Tax;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Database\Seeders\LedgerSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SalesReturnTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    private Warehouse $warehouse;

    private Item $chair;

    private SalesInvoice $invoice;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesSeeder::class, LedgerSeeder::class]);

        $this->client = User::factory()->create(['type' => 'client'])->assignRole('client');
        $this->warehouse = Warehouse::create(['name' => 'Penang Hub', 'is_active' => true]);
        $this->chair = Item::create([
            'name' => 'Office Chair', 'sku' => 'CHAIR-1', 'type' => 'product', 'is_active' => true,
            'category_id' => ItemCategory::create(['name' => 'Furniture', 'color' => '#10b981'])->id,
            'unit_id' => Unit::create(['unit_name' => 'Piece'])->id,
            'sale_price' => '250.00', 'purchase_price' => '120.00',
        ]);
        $this->chair->taxes()->attach(Tax::create(['tax_name' => 'Sales Tax 10%', 'rate' => '10.00']));
        WarehouseStock::create(['item_id' => $this->chair->id, 'warehouse_id' => $this->warehouse->id, 'quantity' => 10]);

        $this->invoice = new SalesInvoice;
        $this->invoice->saveWithLines([
            'type' => 'product', 'invoice_date' => '2026-10-01', 'due_date' => '2026-10-31',
            'customer_id' => $this->client->id, 'warehouse_id' => $this->warehouse->id,
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
        $this->actingAs($this->userWithRole())->post(route('sales-returns.store'), $this->payload())->assertSessionHasNoErrors();

        $return = SalesReturn::query()->with('items')->sole();
        // 2 × 250 = 500; −10% = 450; SST 10% = 45; total 495.
        $this->assertSame('495.00', $return->total_amount);
        $this->assertSame('45.00', $return->tax_amount);
        $this->assertSame('draft', $return->status);
        $this->assertSame($this->client->id, $return->customer_id);
        $this->assertSame(sprintf('SR-2026-10-%03d', $return->id), $return->return_number);
    }

    public function test_cannot_return_more_than_is_left_on_the_invoice(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('sales-returns.store'), $this->payload('3'))->assertSessionHasNoErrors();

        $this->actingAs($user)->post(route('sales-returns.store'), $this->payload('2'))->assertSessionHasErrors('items.0.quantity');
        $this->actingAs($user)->post(route('sales-returns.store'), $this->payload('1', ['return_date' => '2026-09-01']))->assertSessionHasErrors('return_date');
        $this->actingAs($user)->post(route('sales-returns.store'), $this->payload('1', ['reason' => 'changed_mind', 'items' => []]))->assertSessionHasErrors(['reason', 'items']);

        $this->assertDatabaseCount('sales_returns', 1);
    }

    public function test_completing_restocks_and_the_credit_note_reverses_the_sale(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('sales-returns.store'), $this->payload());
        $return = SalesReturn::query()->sole();

        // Must be approved before it can be completed.
        $this->actingAs($user)->put(route('sales-returns.complete', $return))->assertSessionHasErrors('status');
        $this->actingAs($user)->put(route('sales-returns.approve', $return));
        $this->actingAs($user)->put(route('sales-returns.complete', $return))->assertSessionHasNoErrors();

        $this->assertSame('completed', $return->fresh()->status);
        $this->assertSame('8.00', WarehouseStock::query()->sole()->quantity); // 10 − 4 sold + 2 back

        $note = CreditNote::query()->with('items')->sole();
        $this->assertSame('draft', $note->status);
        $this->assertSame('495.00', $note->total_amount);
        $this->assertSame('495.00', $note->balance_amount);
        $this->assertCount(1, $note->items);

        $this->actingAs($user)->put(route('account.credit-notes.approve', $note))->assertSessionHasNoErrors();

        $postings = JournalEntryItem::query()
            ->whereHas('journalEntry', fn ($q) => $q->whereMorphedTo('reference', $note))
            ->with('account:id,account_code')->get()
            ->mapWithKeys(fn ($line) => [$line->account->account_code => [$line->debit_amount, $line->credit_amount]])
            ->all();
        $this->assertSame([
            '4100' => ['450.00', '0.00'],
            '1100' => ['0.00', '495.00'],
            '2210' => ['45.00', '0.00'],
            '1200' => ['240.00', '0.00'],
            '5100' => ['0.00', '240.00'],
        ], $postings);
        $this->assertSame('approved', $note->fresh()->status);

        // Approving twice does nothing more.
        $this->actingAs($user)->put(route('account.credit-notes.approve', $note))->assertSessionHasErrors('status');
        $this->actingAs($user)->delete(route('account.credit-notes.destroy', $note));
        $this->assertModelExists($note);
    }

    public function test_only_draft_returns_can_be_deleted(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('sales-returns.store'), $this->payload());
        $return = SalesReturn::query()->sole();
        $return->approve();

        $this->actingAs($user)->delete(route('sales-returns.destroy', $return));
        $this->assertModelExists($return);
    }

    public function test_clients_see_their_own_returns_and_credit_notes_only(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('sales-returns.store'), $this->payload());
        $return = SalesReturn::query()->sole();
        $return->approve();
        $note = $return->complete();

        $this->actingAs($this->client)->get(route('sales-returns.index'))->assertInertia(fn ($page) => $page->has('returns.data', 1));
        $this->actingAs($this->client)->get(route('account.credit-notes.show', $note))->assertOk();

        $stranger = User::factory()->create(['type' => 'client'])->assignRole('client');
        $this->actingAs($stranger)->get(route('sales-returns.index'))->assertInertia(fn ($page) => $page->has('returns.data', 0));
        $this->actingAs($stranger)->get(route('sales-returns.show', $return))->assertNotFound();
        $this->actingAs($stranger)->get(route('account.credit-notes.show', $note))->assertNotFound();
        $this->actingAs($this->client)->put(route('account.credit-notes.approve', $note))->assertForbidden();
        $this->actingAs($this->userWithRole('vendor'))->get(route('sales-returns.index'))->assertForbidden();
    }

    public function test_renders_the_pages(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('sales-returns.store'), $this->payload());
        $return = SalesReturn::query()->sole();
        $return->approve();
        $note = $return->complete();

        $this->actingAs($user)->get(route('sales-returns.create'))->assertOk()->assertInertia(fn ($page) => $page->component('sales-returns/form')->has('invoices', 1)->where('invoices.0.items.0.returnable', '2.00'));
        $this->actingAs($user)->get(route('sales-returns.show', $return))->assertOk()->assertInertia(fn ($page) => $page->component('sales-returns/show'));
        $this->actingAs($user)->get(route('account.credit-notes.index'))->assertOk()->assertInertia(fn ($page) => $page->component('account/credit-notes/index')->where('counts.draft', 1));
        $this->actingAs($user)->get(route('account.credit-notes.show', $note))->assertOk();
    }
}
