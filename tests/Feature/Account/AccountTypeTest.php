<?php

namespace Tests\Feature\Account;

use App\Models\AccountType;
use App\Models\ChartOfAccount;
use Database\Seeders\LedgerSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountTypeTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return [
            'name' => 'Intangible Assets',
            'code' => 'IA',
            'category' => 'assets',
            'normal_balance' => 'debit',
            'description' => null,
            'is_active' => true,
            ...$overrides,
        ];
    }

    public function test_lists_the_seeded_types(): void
    {
        $this->seed(LedgerSeeder::class);

        $this->actingAs($this->userWithRole())
            ->get(route('account.account-types.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('account/account-types/index')->has('accountTypes', 15));
    }

    public function test_creates_updates_and_deletes_a_type(): void
    {
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('account.account-types.store'), $this->payload())->assertSessionHasNoErrors();
        $type = AccountType::query()->where('code', 'IA')->firstOrFail();
        $this->assertFalse($type->is_system_type);

        $this->actingAs($user)->put(route('account.account-types.update', $type), $this->payload(['name' => 'Intangibles']))->assertSessionHasNoErrors();
        $this->assertSame('Intangibles', $type->fresh()->name);

        $this->actingAs($user)->delete(route('account.account-types.destroy', $type));
        $this->assertModelMissing($type);
    }

    public function test_validates_input(): void
    {
        $this->seed(LedgerSeeder::class);

        $this->actingAs($this->userWithRole())
            ->post(route('account.account-types.store'), $this->payload(['name' => '', 'code' => 'CA', 'category' => 'income', 'normal_balance' => 'both']))
            ->assertSessionHasErrors(['name', 'code', 'category', 'normal_balance']);
    }

    public function test_system_types_and_types_in_use_are_kept(): void
    {
        $this->seed(LedgerSeeder::class);
        $user = $this->userWithRole();
        $system = AccountType::query()->where('code', 'CA')->firstOrFail();

        $this->actingAs($user)->delete(route('account.account-types.destroy', $system));
        $this->assertModelExists($system);

        $custom = AccountType::create($this->payload());
        ChartOfAccount::create(['account_code' => '1900', 'account_name' => 'Goodwill', 'account_type_id' => $custom->id, 'normal_balance' => 'debit']);
        $this->actingAs($user)->delete(route('account.account-types.destroy', $custom));
        $this->assertModelExists($custom);
    }

    public function test_other_roles_cannot_manage_types(): void
    {
        $this->actingAs($this->userWithRole('staff'))->get(route('account.account-types.index'))->assertForbidden();
        $this->actingAs($this->userWithRole('vendor'))->post(route('account.account-types.store'), $this->payload())->assertForbidden();
    }
}
