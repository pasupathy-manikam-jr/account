<?php

namespace Tests\Feature;

use App\Models\Contract;
use App\Models\ContractType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContractTypeTest extends TestCase
{
    use RefreshDatabase;

    public function test_lists_creates_updates_and_deletes_types(): void
    {
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('contract-types.store'), ['name' => 'Cleaning Services', 'is_active' => true])->assertSessionHasNoErrors();
        $type = ContractType::query()->sole();

        $this->actingAs($user)->get(route('contract-types.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('contract-types/index')->where('contractTypes.data.0.contracts_count', 0));

        $this->actingAs($user)->put(route('contract-types.update', $type), ['name' => 'Cleaning Contract', 'is_active' => false])->assertSessionHasNoErrors();
        $this->assertSame('Cleaning Contract', $type->fresh()->name);
        $this->assertFalse($type->fresh()->is_active);

        $this->actingAs($user)->delete(route('contract-types.destroy', $type));
        $this->assertModelMissing($type);
    }

    public function test_validates_and_keeps_types_in_use(): void
    {
        $user = $this->userWithRole();
        $type = ContractType::create(['name' => 'NDA']);

        $this->actingAs($user)->post(route('contract-types.store'), ['name' => 'NDA'])->assertSessionHasErrors('name');
        $this->actingAs($user)->post(route('contract-types.store'), ['name' => ''])->assertSessionHasErrors('name');

        Contract::create([
            'subject' => 'Mutual NDA', 'value' => 0, 'start_date' => '2026-10-01', 'end_date' => '2027-10-01',
            'type_id' => $type->id, 'user_id' => User::factory()->create(['type' => 'client'])->id,
        ]);
        $this->actingAs($user)->delete(route('contract-types.destroy', $type));
        $this->assertModelExists($type);
    }

    public function test_lists_each_types_contract_numbers_and_searches_by_them(): void
    {
        $user = $this->userWithRole();
        $nda = ContractType::create(['name' => 'NDA']);
        ContractType::create(['name' => 'Hosting']);
        $contract = Contract::create([
            'subject' => 'Mutual NDA', 'value' => 0, 'start_date' => '2026-10-01', 'end_date' => '2027-10-01',
            'type_id' => $nda->id, 'user_id' => User::factory()->create(['type' => 'client'])->id,
        ]);
        $contract->forceFill(['contract_number' => $number = 'CON0042'])->save();

        $this->actingAs($user)->get(route('contract-types.index', ['search' => $number]))
            ->assertInertia(fn ($page) => $page->has('contractTypes.data', 1)
                ->where('contractTypes.data.0.name', 'NDA')
                ->where('contractTypes.data.0.contracts.0.contract_number', $number));
    }

    public function test_only_the_company_manages_types(): void
    {
        $this->actingAs($this->userWithRole('client'))->get(route('contract-types.index'))->assertForbidden();
        $this->actingAs($this->userWithRole('staff'))->post(route('contract-types.store'), ['name' => 'X'])->assertForbidden();
    }
}
