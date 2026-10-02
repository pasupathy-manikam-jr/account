<?php

namespace Tests\Feature\Account;

use App\Models\Customer;
use App\Models\User;
use Database\Seeders\CustomerSeeder;
use Database\Seeders\RolesSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerTest extends TestCase
{
    use RefreshDatabase;

    private function client(): User
    {
        return User::factory()->create(['type' => 'client']);
    }

    private function payload(array $overrides = []): array
    {
        $address = [
            'name' => 'Ibu Pejabat',
            'address_line_1' => 'No. 12, Jalan Ampang',
            'address_line_2' => null,
            'city' => 'Kuala Lumpur',
            'state' => 'Wilayah Persekutuan Kuala Lumpur',
            'country' => 'Malaysia',
            'zip_code' => '50450',
        ];

        return [
            'user_id' => array_key_exists('user_id', $overrides) ? null : $this->client()->id,
            'company_name' => 'Syarikat Ujian Sdn Bhd',
            'contact_person_name' => 'Encik Ahmad',
            'contact_person_email' => 'ahmad@example.com',
            'contact_person_mobile' => '+60123456789',
            'tax_number' => 'W10-1234-56789012',
            'payment_terms' => 'Net 30',
            'billing_address' => $address,
            'shipping_address' => $address,
            'same_as_billing' => true,
            'notes' => null,
            ...$overrides,
        ];
    }

    public function test_lists_and_searches_customers(): void
    {
        $this->seed([RolesSeeder::class, UserSeeder::class, CustomerSeeder::class]);

        $this->actingAs($this->userWithRole())
            ->get(route('account.customers.index', ['per_page' => 100]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('account/customers/index')->has('customers.data', 25)->where('customers.data.0.customer_code', 'CUST-0001'));

        $this->actingAs($this->userWithRole())
            ->get(route('account.customers.index', ['search' => 'Ariffin Construction']))
            ->assertInertia(fn ($page) => $page->has('customers.data', 1)->where('customers.data.0.user.email', 'kamarul.ariffin@example.com'));
    }

    public function test_create_page_offers_only_unassigned_client_users(): void
    {
        $taken = $this->client();
        $free = $this->client();
        User::factory()->create(['type' => 'vendor']);
        Customer::create($this->payload(['user_id' => $taken->id]));

        $this->actingAs($this->userWithRole())
            ->get(route('account.customers.create'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('account/customers/create')->where('users', fn ($users) => collect($users)->pluck('id')->all() === [$free->id]));
    }

    public function test_creates_updates_and_deletes_a_customer(): void
    {
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('account.customers.store'), $this->payload())
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('account.customers.index'));
        $customer = Customer::query()->where('company_name', 'Syarikat Ujian Sdn Bhd')->firstOrFail();
        $this->assertSame(sprintf('CUST-%04d', $customer->id), $customer->customer_code);
        $this->assertSame($user->id, $customer->created_by);
        $this->assertNull($customer->shipping_address);

        $this->actingAs($user)->get(route('account.customers.edit', $customer))->assertOk();

        $shipping = ['name' => null, 'address_line_1' => 'Lot 5, Kawasan Perindustrian Klang', 'address_line_2' => null, 'city' => 'Klang', 'state' => 'Selangor', 'country' => 'Malaysia', 'zip_code' => '41000'];
        $this->actingAs($user)->put(route('account.customers.update', $customer), $this->payload(['user_id' => $customer->user_id, 'same_as_billing' => false, 'shipping_address' => $shipping]))
            ->assertSessionHasNoErrors();
        $this->assertSame('Klang', $customer->fresh()->shipping_address['city']);
        $this->assertFalse($customer->fresh()->same_as_billing);

        $this->actingAs($user)->delete(route('account.customers.destroy', $customer));
        $this->assertModelMissing($customer);
    }

    public function test_validates_input(): void
    {
        $user = $this->userWithRole();
        $vendor = User::factory()->create(['type' => 'vendor']);

        $this->actingAs($user)
            ->post(route('account.customers.store'), $this->payload([
                'user_id' => $vendor->id,
                'company_name' => '',
                'contact_person_email' => 'not-an-email',
                'contact_person_mobile' => '0123456789',
                'billing_address' => ['address_line_1' => '', 'city' => '', 'country' => ''],
                'same_as_billing' => false,
                'shipping_address' => ['address_line_1' => ''],
            ]))
            ->assertSessionHasErrors(['user_id', 'company_name', 'contact_person_email', 'contact_person_mobile', 'billing_address.address_line_1', 'billing_address.city', 'billing_address.country', 'shipping_address.address_line_1']);

        $existing = Customer::create($this->payload());
        $this->actingAs($user)
            ->post(route('account.customers.store'), $this->payload(['user_id' => $existing->user_id]))
            ->assertSessionHasErrors('user_id');
    }

    public function test_own_scope_only_reaches_the_users_own_customers(): void
    {
        $this->seed(RolesSeeder::class);
        $mine = Customer::create($this->payload());
        $theirs = Customer::create($this->payload(['company_name' => 'Lain Sdn Bhd']));

        $staff = User::factory()->create(['type' => 'staff']);
        $staff->givePermissionTo(['manage-customers', 'manage-own-customers', 'edit-customers']);
        $mine->forceFill(['created_by' => $staff->id])->save();

        $this->actingAs($staff)->get(route('account.customers.index'))
            ->assertInertia(fn ($page) => $page->has('customers.data', 1)->where('customers.data.0.id', $mine->id));
        $this->actingAs($staff)->get(route('account.customers.edit', $mine))->assertOk();
        $this->actingAs($staff)->get(route('account.customers.edit', $theirs))->assertNotFound();
    }

    public function test_other_roles_cannot_manage_customers(): void
    {
        $customer = Customer::create($this->payload());

        $this->actingAs($this->userWithRole('vendor'))->get(route('account.customers.index'))->assertForbidden();
        $this->actingAs($this->userWithRole('client'))->get(route('account.customers.create'))->assertForbidden();
        $this->actingAs($this->userWithRole('staff'))->delete(route('account.customers.destroy', $customer))->assertForbidden();
        $this->assertModelExists($customer);
    }
}
