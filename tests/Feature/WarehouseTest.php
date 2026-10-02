<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\Warehouse;
use Database\Seeders\ProductServiceSeeder;
use Database\Seeders\WarehouseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WarehouseTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return [
            'name' => 'Seremban Store',
            'address' => 'Lot 3, Jalan Senawang 2',
            'city' => 'Seremban',
            'zip_code' => '70450',
            'phone' => '+6066771234',
            'email' => 'seremban@example.com',
            'is_active' => true,
            ...$overrides,
        ];
    }

    public function test_lists_and_filters_warehouses(): void
    {
        $this->seed(WarehouseSeeder::class);

        $this->actingAs($this->userWithRole())
            ->get(route('warehouses.index', ['status' => 'inactive']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('warehouses/index')->has('warehouses.data', 1));
    }

    public function test_creates_updates_and_deletes_a_warehouse(): void
    {
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('warehouses.store'), $this->payload())->assertSessionHasNoErrors();
        $warehouse = Warehouse::query()->where('name', 'Seremban Store')->firstOrFail();

        $this->actingAs($user)->put(route('warehouses.update', $warehouse), $this->payload(['is_active' => false]))->assertSessionHasNoErrors();
        $this->assertFalse($warehouse->fresh()->is_active);

        $this->actingAs($user)->delete(route('warehouses.destroy', $warehouse));
        $this->assertModelMissing($warehouse);
    }

    public function test_validates_input(): void
    {
        $this->seed(WarehouseSeeder::class);

        $this->actingAs($this->userWithRole())
            ->post(route('warehouses.store'), $this->payload(['name' => 'Penang Logistics Hub', 'email' => 'not-an-email']))
            ->assertSessionHasErrors(['name', 'email']);
    }

    public function test_warehouses_holding_stock_are_kept(): void
    {
        $this->seed([WarehouseSeeder::class, ProductServiceSeeder::class]);
        $warehouse = Item::query()->where('type', 'product')->firstOrFail()->stocks()->firstOrFail()->warehouse;

        $this->actingAs($this->userWithRole())->delete(route('warehouses.destroy', $warehouse));
        $this->assertModelExists($warehouse);
    }

    public function test_other_roles_cannot_manage_warehouses(): void
    {
        $this->actingAs($this->userWithRole('vendor'))->get(route('warehouses.index'))->assertForbidden();
        $this->actingAs($this->userWithRole('staff'))->post(route('warehouses.store'), $this->payload())->assertForbidden();
    }
}
