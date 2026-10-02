<?php

namespace Tests\Feature\ProductService;

use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\Tax;
use App\Models\Unit;
use Database\Seeders\ProductServiceSeeder;
use Database\Seeders\WarehouseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SetupTest extends TestCase
{
    use RefreshDatabase;

    public function test_lists_the_seeded_setup_records(): void
    {
        $this->seed([WarehouseSeeder::class, ProductServiceSeeder::class]);
        $user = $this->userWithRole();

        $this->actingAs($user)->get(route('product-service.item-categories.index'))
            ->assertOk()->assertInertia(fn ($page) => $page->component('product-service/item-categories/index')->has('categories', 10));
        $this->actingAs($user)->get(route('product-service.taxes.index'))
            ->assertOk()->assertInertia(fn ($page) => $page->component('product-service/taxes/index')->has('taxes', 4));
        $this->actingAs($user)->get(route('product-service.units.index'))
            ->assertOk()->assertInertia(fn ($page) => $page->component('product-service/units/index')->has('units', 48));
    }

    public function test_creates_updates_and_deletes_each_setup_record(): void
    {
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('product-service.item-categories.store'), ['name' => 'Kuih', 'color' => '#aa3300'])->assertSessionHasNoErrors();
        $category = ItemCategory::query()->where('name', 'Kuih')->firstOrFail();
        $this->actingAs($user)->put(route('product-service.item-categories.update', $category), ['name' => 'Kuih Muih', 'color' => '#aa3300'])->assertSessionHasNoErrors();
        $this->assertSame('Kuih Muih', $category->fresh()->name);
        $this->actingAs($user)->delete(route('product-service.item-categories.destroy', $category));
        $this->assertModelMissing($category);

        $this->actingAs($user)->post(route('product-service.taxes.store'), ['tax_name' => 'Sales Tax 10%', 'rate' => '10'])->assertSessionHasNoErrors();
        $tax = Tax::query()->firstOrFail();
        $this->assertSame('10.00', $tax->rate);
        $this->actingAs($user)->put(route('product-service.taxes.update', $tax), ['tax_name' => 'Sales Tax 10%', 'rate' => '5.5'])->assertSessionHasNoErrors();
        $this->assertSame('5.50', $tax->fresh()->rate);
        $this->actingAs($user)->delete(route('product-service.taxes.destroy', $tax));
        $this->assertModelMissing($tax);

        $this->actingAs($user)->post(route('product-service.units.store'), ['unit_name' => 'Kotak'])->assertSessionHasNoErrors();
        $unit = Unit::query()->firstOrFail();
        $this->actingAs($user)->delete(route('product-service.units.destroy', $unit));
        $this->assertModelMissing($unit);
    }

    public function test_validates_input(): void
    {
        $user = $this->userWithRole();
        ItemCategory::create(['name' => 'Kuih', 'color' => '#aa3300']);

        $this->actingAs($user)->post(route('product-service.item-categories.store'), ['name' => 'Kuih', 'color' => 'red'])
            ->assertSessionHasErrors(['name', 'color']);
        $this->actingAs($user)->post(route('product-service.taxes.store'), ['tax_name' => '', 'rate' => '120'])
            ->assertSessionHasErrors(['tax_name', 'rate']);
        $this->actingAs($user)->post(route('product-service.units.store'), ['unit_name' => ''])
            ->assertSessionHasErrors('unit_name');
    }

    public function test_records_used_by_items_are_kept(): void
    {
        $this->seed([WarehouseSeeder::class, ProductServiceSeeder::class]);
        $user = $this->userWithRole();
        $item = Item::query()->with(['category', 'unit', 'taxes'])->whereHas('taxes')->firstOrFail();

        $this->actingAs($user)->delete(route('product-service.item-categories.destroy', $item->category));
        $this->actingAs($user)->delete(route('product-service.units.destroy', $item->unit));
        $this->actingAs($user)->delete(route('product-service.taxes.destroy', $item->taxes->first()));

        $this->assertModelExists($item->category);
        $this->assertModelExists($item->unit);
        $this->assertModelExists($item->taxes->first());
    }

    public function test_other_roles_cannot_manage_setup(): void
    {
        $this->actingAs($this->userWithRole('staff'))->get(route('product-service.taxes.index'))->assertForbidden();
        $this->actingAs($this->userWithRole('vendor'))->post(route('product-service.units.store'), ['unit_name' => 'Box'])->assertForbidden();
    }
}
