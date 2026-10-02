<?php

namespace Tests\Feature\Account;

use App\Models\User;
use App\Models\Vendor;
use Database\Seeders\RolesSeeder;
use Database\Seeders\UserSeeder;
use Database\Seeders\VendorSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VendorTest extends TestCase
{
    use RefreshDatabase;

    private function vendorUser(): User
    {
        return User::factory()->create(['type' => 'vendor']);
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
            'user_id' => array_key_exists('user_id', $overrides) ? null : $this->vendorUser()->id,
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

    public function test_lists_and_searches_vendors(): void
    {
        $this->seed([RolesSeeder::class, UserSeeder::class, VendorSeeder::class]);

        $this->actingAs($this->userWithRole())
            ->get(route('account.vendors.index', ['per_page' => 100]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('account/vendors/index')->has('vendors.data', 15)->where('vendors.data.0.vendor_code', 'VEND-0001'));

        $this->actingAs($this->userWithRole())
            ->get(route('account.vendors.index', ['search' => 'Chan Office Supplies']))
            ->assertInertia(fn ($page) => $page->has('vendors.data', 1)->where('vendors.data.0.user.email', 'kokleong.chan@example.com'));
    }

    public function test_create_page_offers_only_unassigned_vendor_users(): void
    {
        $taken = $this->vendorUser();
        $free = $this->vendorUser();
        User::factory()->create(['type' => 'client']);
        Vendor::create($this->payload(['user_id' => $taken->id]));

        $this->actingAs($this->userWithRole())
            ->get(route('account.vendors.create'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('account/vendors/create')->where('users', fn ($users) => collect($users)->pluck('id')->all() === [$free->id]));
    }

    public function test_creates_updates_and_deletes_a_vendor(): void
    {
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('account.vendors.store'), $this->payload())
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('account.vendors.index'));
        $vendor = Vendor::query()->where('company_name', 'Syarikat Ujian Sdn Bhd')->firstOrFail();
        $this->assertSame(sprintf('VEND-%04d', $vendor->id), $vendor->vendor_code);
        $this->assertSame($user->id, $vendor->created_by);
        $this->assertNull($vendor->shipping_address);

        $this->actingAs($user)->get(route('account.vendors.edit', $vendor))->assertOk();

        $shipping = ['name' => null, 'address_line_1' => 'Lot 5, Kawasan Perindustrian Klang', 'address_line_2' => null, 'city' => 'Klang', 'state' => 'Selangor', 'country' => 'Malaysia', 'zip_code' => '41000'];
        $this->actingAs($user)->put(route('account.vendors.update', $vendor), $this->payload(['user_id' => $vendor->user_id, 'same_as_billing' => false, 'shipping_address' => $shipping]))
            ->assertSessionHasNoErrors();
        $this->assertSame('Klang', $vendor->fresh()->shipping_address['city']);
        $this->assertFalse($vendor->fresh()->same_as_billing);

        $this->actingAs($user)->delete(route('account.vendors.destroy', $vendor));
        $this->assertModelMissing($vendor);
    }

    public function test_validates_input(): void
    {
        $user = $this->userWithRole();
        $vendor = User::factory()->create(['type' => 'client']);

        $this->actingAs($user)
            ->post(route('account.vendors.store'), $this->payload([
                'user_id' => $vendor->id,
                'company_name' => '',
                'contact_person_email' => 'not-an-email',
                'contact_person_mobile' => '0123456789',
                'billing_address' => ['address_line_1' => '', 'city' => '', 'country' => ''],
                'same_as_billing' => false,
                'shipping_address' => ['address_line_1' => ''],
            ]))
            ->assertSessionHasErrors(['user_id', 'company_name', 'contact_person_email', 'contact_person_mobile', 'billing_address.address_line_1', 'billing_address.city', 'billing_address.country', 'shipping_address.address_line_1']);

        $existing = Vendor::create($this->payload());
        $this->actingAs($user)
            ->post(route('account.vendors.store'), $this->payload(['user_id' => $existing->user_id]))
            ->assertSessionHasErrors('user_id');
    }

    public function test_own_scope_only_reaches_the_users_own_vendors(): void
    {
        $this->seed(RolesSeeder::class);
        $mine = Vendor::create($this->payload());
        $theirs = Vendor::create($this->payload(['company_name' => 'Lain Sdn Bhd']));

        $staff = User::factory()->create(['type' => 'staff']);
        $staff->givePermissionTo(['manage-vendors', 'manage-own-vendors', 'edit-vendors']);
        $mine->forceFill(['created_by' => $staff->id])->save();

        $this->actingAs($staff)->get(route('account.vendors.index'))
            ->assertInertia(fn ($page) => $page->has('vendors.data', 1)->where('vendors.data.0.id', $mine->id));
        $this->actingAs($staff)->get(route('account.vendors.edit', $mine))->assertOk();
        $this->actingAs($staff)->get(route('account.vendors.edit', $theirs))->assertNotFound();
    }

    public function test_other_roles_cannot_manage_vendors(): void
    {
        $vendor = Vendor::create($this->payload());

        $this->actingAs($this->userWithRole('vendor'))->get(route('account.vendors.index'))->assertForbidden();
        $this->actingAs($this->userWithRole('vendor'))->get(route('account.vendors.create'))->assertForbidden();
        $this->actingAs($this->userWithRole('staff'))->delete(route('account.vendors.destroy', $vendor))->assertForbidden();
        $this->assertModelExists($vendor);
    }
}
