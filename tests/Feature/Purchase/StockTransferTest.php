<?php

namespace Tests\Feature\Purchase;

use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\StockTransfer;
use App\Models\Unit;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockTransferTest extends TestCase
{
    use RefreshDatabase;

    private Warehouse $penang;

    private Warehouse $johor;

    private Item $item;

    protected function setUp(): void
    {
        parent::setUp();
        $this->penang = Warehouse::create(['name' => 'Penang Hub', 'is_active' => true]);
        $this->johor = Warehouse::create(['name' => 'Johor Bahru Store', 'is_active' => true]);
        $this->item = Item::create([
            'name' => 'Coffee', 'sku' => 'COF-1', 'type' => 'product', 'is_active' => true,
            'category_id' => ItemCategory::create(['name' => 'Food', 'color' => '#10b981'])->id,
            'unit_id' => Unit::create(['unit_name' => 'Kg'])->id,
            'sale_price' => '15.99', 'purchase_price' => '8.00',
        ]);
        WarehouseStock::create(['item_id' => $this->item->id, 'warehouse_id' => $this->penang->id, 'quantity' => 50]);
    }

    private function stock(Warehouse $warehouse): ?string
    {
        return WarehouseStock::query()->where(['item_id' => $this->item->id, 'warehouse_id' => $warehouse->id])->value('quantity');
    }

    private function payload(array $overrides = []): array
    {
        return ['from_warehouse_id' => $this->penang->id, 'to_warehouse_id' => $this->johor->id, 'item_id' => $this->item->id, 'quantity' => 20, 'date' => '2026-10-01', ...$overrides];
    }

    public function test_moves_stock_and_moves_it_back_when_deleted(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('transfers.store'), $this->payload())->assertSessionHasNoErrors();

        $this->assertSame('30.00', $this->stock($this->penang));
        $this->assertSame('20.00', $this->stock($this->johor));

        $this->actingAs($user)->delete(route('transfers.destroy', StockTransfer::query()->sole()));
        $this->assertSame('50.00', $this->stock($this->penang));
        $this->assertSame('0.00', $this->stock($this->johor));
        $this->assertDatabaseCount('stock_transfers', 0);
    }

    public function test_cannot_move_more_than_the_source_holds_or_to_itself(): void
    {
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('transfers.store'), $this->payload(['quantity' => 51]))->assertSessionHasErrors('quantity');
        $this->actingAs($user)->post(route('transfers.store'), $this->payload(['to_warehouse_id' => $this->penang->id]))->assertSessionHasErrors('to_warehouse_id');
        $this->assertSame('50.00', $this->stock($this->penang));
        $this->assertDatabaseCount('stock_transfers', 0);
    }

    public function test_cannot_undo_once_the_destination_has_used_the_stock(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('transfers.store'), $this->payload());
        WarehouseStock::query()->where('warehouse_id', $this->johor->id)->update(['quantity' => 5]);

        $this->actingAs($user)->delete(route('transfers.destroy', StockTransfer::query()->sole()))->assertSessionHasErrors('quantity');
        $this->assertDatabaseCount('stock_transfers', 1);
    }

    public function test_lists_transfers_and_guards_access(): void
    {
        StockTransfer::move($this->payload(), null);

        $this->actingAs($this->userWithRole())->get(route('transfers.index'))->assertOk()
            ->assertInertia(fn ($page) => $page->component('transfers/index')->has('transfers.data', 1));
        $this->actingAs($this->userWithRole('staff'))->get(route('transfers.index'))->assertForbidden();
    }
}
