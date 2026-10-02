<?php

namespace Tests\Feature;

use Database\Seeders\RolesSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('login'));
    }

    public function test_authenticated_users_can_visit_the_dashboard()
    {
        $user = $this->userWithRole();
        $this->actingAs($user);

        $response = $this->followingRedirects()->get(route('dashboard'));
        $response->assertOk();
    }

    public function test_company_lands_on_the_account_dashboard_and_portal_users_get_a_welcome_page()
    {
        $this->seed([RolesSeeder::class, UserSeeder::class]);

        $this->actingAs($this->userWithRole())->get(route('dashboard'))->assertRedirect(route('account.dashboard'));

        $this->actingAs($this->userWithRole())->get(route('account.dashboard'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('account/dashboard')
                ->where('stats.total_clients', 25)
                ->where('stats.total_vendors', 15)
                ->has('monthlyCustomerPayments', 6)
                ->has('monthlyVendorPayments', 6));

        $this->actingAs($this->userWithRole('vendor'))->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('dashboard'));
        $this->actingAs($this->userWithRole('staff'))->get(route('account.dashboard'))->assertForbidden();
    }
}
