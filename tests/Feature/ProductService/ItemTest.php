<?php

namespace Tests\Feature\ProductService;

use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\Tax;
use App\Models\Unit;
use App\Models\Warehouse;
use Database\Seeders\ProductServiceSeeder;
use Database\Seeders\WarehouseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ItemTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([WarehouseSeeder::class, ProductServiceSeeder::class]);
    }

    private function payload(array $overrides = []): array
    {
        $warehouses = Warehouse::query()->where('is_active', true)->orderBy('id')->limit(2)->pluck('id');

        return [
            'type' => 'product',
            'name' => 'Kopi Tongkat Ali',
            'sku' => 'FOOD-PROD-901',
            'category_id' => ItemCategory::query()->value('id'),
            'unit_id' => Unit::query()->where('unit_name', 'Pack')->value('id'),
            'tax_ids' => [Tax::query()->where('tax_name', 'Sales Tax 10%')->value('id')],
            'sale_price' => '18.90',
            'purchase_price' => '9.50',
            'description' => 'Premix coffee',
            'long_description' => null,
            'is_active' => true,
            'stocks' => [
                ['warehouse_id' => $warehouses[0], 'quantity' => '40'],
                ['warehouse_id' => $warehouses[1], 'quantity' => '12.5'],
            ],
            ...$overrides,
        ];
    }

    public function test_lists_items_with_stock_totals_and_filters(): void
    {
        $item = Item::query()->where('type', 'product')->withSum('stocks as total', 'quantity')->firstOrFail();

        $this->actingAs($this->userWithRole())
            ->get(route('product-service.items.index', ['search' => $item->sku]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('product-service/items/index')
                ->has('items.data', 1)
                ->where('items.data.0.total_quantity', $item->total));

        $this->actingAs($this->userWithRole())
            ->get(route('product-service.items.index', ['type' => 'service', 'per_page' => 100]))
            ->assertInertia(fn ($page) => $page->where('items.total', Item::query()->where('type', 'service')->count()));
    }

    public function test_creates_an_item_with_taxes_stock_and_image(): void
    {
        Storage::fake('public');

        $this->actingAs($this->userWithRole())
            ->post(route('product-service.items.store'), $this->payload(['image' => UploadedFile::fake()->create('kopi.png', 20, 'image/png')]))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('product-service.items.index'));

        $item = Item::query()->where('sku', 'FOOD-PROD-901')->firstOrFail();
        $this->assertCount(1, $item->taxes);
        $this->assertSame(['40.00', '12.50'], $item->stocks()->orderBy('warehouse_id')->pluck('quantity')->all());
        Storage::disk('public')->assertExists($item->image);
    }

    public function test_switching_to_a_service_drops_its_stock(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('product-service.items.store'), $this->payload());
        $item = Item::query()->where('sku', 'FOOD-PROD-901')->firstOrFail();

        $this->actingAs($user)->put(route('product-service.items.update', $item), $this->payload(['type' => 'service', 'tax_ids' => []]))
            ->assertSessionHasNoErrors();

        $this->assertSame('service', $item->fresh()->type);
        $this->assertCount(0, $item->stocks()->get());
        $this->assertCount(0, $item->taxes()->get());
    }

    public function test_editing_keeps_stock_held_in_a_deactivated_warehouse(): void
    {
        $user = $this->userWithRole();
        $this->actingAs($user)->post(route('product-service.items.store'), $this->payload());
        $item = Item::query()->where('sku', 'FOOD-PROD-901')->firstOrFail();
        $closed = Warehouse::query()->where('is_active', false)->firstOrFail();
        $item->stocks()->create(['warehouse_id' => $closed->id, 'quantity' => 7]);

        // The edit form only lists active warehouses, so the closed one isn't submitted.
        $this->actingAs($user)->put(route('product-service.items.update', $item), $this->payload())->assertSessionHasNoErrors();

        $this->assertSame('7.00', $item->stocks()->where('warehouse_id', $closed->id)->value('quantity'));
    }

    public function test_validates_input(): void
    {
        $taken = Item::query()->value('sku');

        $this->actingAs($this->userWithRole())
            ->post(route('product-service.items.store'), $this->payload([
                'type' => 'bundle', 'name' => '', 'sku' => $taken, 'category_id' => 999, 'unit_id' => null,
                'sale_price' => '-1', 'purchase_price' => '1.234', 'tax_ids' => [999],
                'stocks' => [['warehouse_id' => 999, 'quantity' => '-3']],
            ]))
            ->assertSessionHasErrors(['type', 'name', 'sku', 'category_id', 'unit_id', 'sale_price', 'purchase_price', 'tax_ids.0', 'stocks.0.warehouse_id', 'stocks.0.quantity']);
    }

    public function test_shows_an_item_and_adds_stock_to_a_warehouse(): void
    {
        $user = $this->userWithRole();
        $item = Item::query()->where('type', 'product')->firstOrFail();
        $stock = $item->stocks()->firstOrFail();

        $this->actingAs($user)->get(route('product-service.items.show', $item))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('product-service/items/show')->where('item.sku', $item->sku));

        $this->actingAs($user)->post(route('product-service.items.stock', $item), ['warehouse_id' => $stock->warehouse_id, 'quantity' => '2.5'])
            ->assertSessionHasNoErrors();
        $this->assertSame(number_format((float) $stock->quantity + 2.5, 2, '.', ''), $stock->fresh()->quantity);

        $this->actingAs($user)->post(route('product-service.items.stock', $item), ['warehouse_id' => $stock->warehouse_id, 'quantity' => '0'])
            ->assertSessionHasErrors('quantity');
    }

    public function test_deletes_an_item_with_its_stock(): void
    {
        $item = Item::query()->where('type', 'product')->firstOrFail();

        $this->actingAs($this->userWithRole())->delete(route('product-service.items.destroy', $item));

        $this->assertModelMissing($item);
        $this->assertDatabaseMissing('warehouse_stocks', ['item_id' => $item->id]);
    }

    public function test_other_roles_cannot_manage_items(): void
    {
        $this->actingAs($this->userWithRole('client'))->get(route('product-service.items.index'))->assertForbidden();
        $this->actingAs($this->userWithRole('staff'))->post(route('product-service.items.store'), $this->payload())->assertForbidden();
    }
}
