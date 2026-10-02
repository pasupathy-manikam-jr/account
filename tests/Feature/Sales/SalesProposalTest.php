<?php

namespace Tests\Feature\Sales;

use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\SalesProposal;
use App\Models\Tax;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SalesProposalTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    private Warehouse $warehouse;

    private Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesSeeder::class);

        $this->client = User::factory()->create(['type' => 'client'])->assignRole('client');
        $this->warehouse = Warehouse::create(['name' => 'Shah Alam Hub', 'is_active' => true]);
        $this->item = Item::create([
            'name' => 'Ink Cartridge',
            'sku' => 'INK-001',
            'type' => 'product',
            'category_id' => ItemCategory::create(['name' => 'Stationery', 'color' => '#10b981'])->id,
            'unit_id' => Unit::create(['unit_name' => 'Piece'])->id,
            'sale_price' => '25.99',
            'purchase_price' => '12.00',
            'is_active' => true,
        ]);
        $this->item->taxes()->attach([
            Tax::create(['tax_name' => 'Sales Tax 10%', 'rate' => '10.00'])->id,
            Tax::create(['tax_name' => 'Service Tax 8%', 'rate' => '8.00'])->id,
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return [
            'proposal_date' => '2026-10-01',
            'due_date' => '2026-10-31',
            'customer_id' => $this->client->id,
            'warehouse_id' => $this->warehouse->id,
            'payment_terms' => 'Net 30',
            'notes' => 'Quarterly restock.',
            'items' => [['item_id' => $this->item->id, 'quantity' => 10, 'unit_price' => '25.99', 'discount_percentage' => 10]],
            ...$overrides,
        ];
    }

    private function proposal(string $status = 'draft'): SalesProposal
    {
        $proposal = new SalesProposal;
        $proposal->forceFill(['status' => $status]);
        $proposal->saveWithLines(collect($this->payload())->except('items')->all(), $this->payload()['items']);

        return $proposal;
    }

    public function test_creates_a_proposal_priced_on_the_server(): void
    {
        $this->actingAs($this->userWithRole())
            ->post(route('sales-proposals.store'), $this->payload([
                // Whatever the browser claims about tax or totals is ignored.
                'items' => [['item_id' => $this->item->id, 'quantity' => 10, 'unit_price' => '25.99', 'discount_percentage' => 10, 'tax_percentage' => 0, 'total_amount' => 1]],
            ]))
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $proposal = SalesProposal::query()->with('items')->sole();
        // 10 × 25.99 = 259.90; −10% = 25.99; taxable 233.91 × 18% = 42.10; total 276.01.
        $this->assertSame('259.90', $proposal->subtotal);
        $this->assertSame('25.99', $proposal->discount_amount);
        $this->assertSame('42.10', $proposal->tax_amount);
        $this->assertSame('276.01', $proposal->total_amount);
        $this->assertSame('18.00', $proposal->items[0]->tax_percentage);
        $this->assertSame(['Sales Tax 10%', 'Service Tax 8%'], array_column($proposal->items[0]->taxes ?? [], 'name'));
        $this->assertSame(sprintf('SP-2026-10-%03d', $proposal->id), $proposal->proposal_number);
        $this->assertSame('draft', $proposal->status);
    }

    public function test_validates_header_and_lines(): void
    {
        $staff = User::factory()->create(['type' => 'staff']);

        $this->actingAs($this->userWithRole())
            ->post(route('sales-proposals.store'), $this->payload([
                'due_date' => '2026-09-01',
                'customer_id' => $staff->id,
                'items' => [['item_id' => 999, 'quantity' => 0, 'unit_price' => '-1', 'discount_percentage' => 150]],
            ]))
            ->assertSessionHasErrors(['due_date', 'customer_id', 'items.0.item_id', 'items.0.quantity', 'items.0.unit_price', 'items.0.discount_percentage']);

        $this->actingAs($this->userWithRole())
            ->post(route('sales-proposals.store'), $this->payload(['items' => []]))
            ->assertSessionHasErrors('items');

        $this->assertDatabaseCount('sales_proposals', 0);
    }

    public function test_lists_and_shows_proposals_with_overdue_worked_out_from_the_due_date(): void
    {
        $proposal = $this->proposal('sent');
        $proposal->update(['due_date' => today()->subDay()]);

        $this->actingAs($this->userWithRole())
            ->get(route('sales-proposals.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('sales-proposals/index')
                ->where('proposals.data.0.display_status', 'overdue'));

        $this->actingAs($this->userWithRole())
            ->get(route('sales-proposals.show', $proposal))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('sales-proposals/show')->has('proposal.items', 1));
    }

    public function test_only_drafts_can_be_edited_or_deleted(): void
    {
        $user = $this->userWithRole();
        $draft = $this->proposal();

        $this->actingAs($user)->put(route('sales-proposals.update', $draft), $this->payload(['notes' => 'Changed']))->assertSessionHasNoErrors();
        $this->assertSame('Changed', $draft->fresh()->notes);

        $sent = $this->proposal('sent');
        $this->actingAs($user)->put(route('sales-proposals.update', $sent), $this->payload(['notes' => 'Changed']));
        $this->assertSame('Quarterly restock.', $sent->fresh()->notes);
        $this->actingAs($user)->delete(route('sales-proposals.destroy', $sent));
        $this->assertModelExists($sent);

        $this->actingAs($user)->delete(route('sales-proposals.destroy', $draft));
        $this->assertModelMissing($draft);
    }

    public function test_moves_through_send_then_accept_or_reject(): void
    {
        $user = $this->userWithRole();
        $proposal = $this->proposal();

        // A draft can't be accepted before it is sent.
        $this->actingAs($user)->put(route('sales-proposals.accept', $proposal));
        $this->assertSame('draft', $proposal->fresh()->status);

        $this->actingAs($user)->put(route('sales-proposals.send', $proposal));
        $this->assertSame('sent', $proposal->fresh()->status);

        // The client it was sent to accepts it from their portal.
        $this->actingAs($this->client)->put(route('sales-proposals.accept', $proposal));
        $this->assertSame('accepted', $proposal->fresh()->status);

        $other = $this->proposal('sent');
        $this->actingAs($user)->put(route('sales-proposals.reject', $other));
        $this->assertSame('rejected', $other->fresh()->status);
    }

    public function test_clients_only_see_their_own_proposals(): void
    {
        $mine = $this->proposal('sent');
        $otherClient = User::factory()->create(['type' => 'client'])->assignRole('client');
        $theirs = $this->proposal('sent');
        $theirs->update(['customer_id' => $otherClient->id]);

        $this->actingAs($this->client)
            ->get(route('sales-proposals.index'))
            ->assertInertia(fn ($page) => $page->has('proposals.data', 1)->where('proposals.data.0.id', $mine->id));

        $this->actingAs($this->client)->get(route('sales-proposals.show', $theirs))->assertNotFound();
        $this->actingAs($this->client)->put(route('sales-proposals.accept', $theirs))->assertNotFound();
        $this->actingAs($this->client)->get(route('sales-proposals.create'))->assertForbidden();
        $this->actingAs($this->client)->put(route('sales-proposals.send', $mine))->assertForbidden();
    }

    public function test_downloads_a_pdf(): void
    {
        $proposal = $this->proposal('sent');

        $response = $this->actingAs($this->userWithRole())->get(route('sales-proposals.pdf', $proposal));

        $response->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->assertStringContainsString($proposal->proposal_number, (string) $response->headers->get('content-disposition'));
    }

    public function test_items_on_a_proposal_cannot_be_deleted(): void
    {
        $this->proposal();

        $this->actingAs($this->userWithRole())->delete(route('product-service.items.destroy', $this->item));

        $this->assertModelExists($this->item);
    }

    public function test_vendors_and_staff_cannot_reach_proposals(): void
    {
        $this->actingAs($this->userWithRole('vendor'))->get(route('sales-proposals.index'))->assertForbidden();
        $this->actingAs($this->userWithRole('staff'))->post(route('sales-proposals.store'), $this->payload())->assertForbidden();
    }
}
