<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ModuleAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_can_open_every_module_page(): void
    {
        $user = $this->userWithRole('company');

        $modules = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => collect($route->gatherMiddleware())->contains(fn ($m) => str_starts_with($m, 'permission:')))
            ->filter(fn ($route) => in_array('GET', $route->methods()) && ! str_contains($route->uri(), '{'));

        $this->assertGreaterThan(50, $modules->count());

        foreach ($modules as $route) {
            $this->actingAs($user)->followingRedirects()->get('/'.$route->uri())->assertOk();
        }
    }

    public function test_portal_roles_only_reach_their_own_modules(): void
    {
        $vendor = $this->userWithRole('vendor');
        $this->actingAs($vendor)->get(route('purchase-invoices.index'))->assertOk();
        $this->actingAs($vendor)->get(route('account.customers.index'))->assertForbidden();

        $client = $this->userWithRole('client');
        $this->actingAs($client)->get(route('sales-invoices.index'))->assertOk();
        $this->actingAs($client)->get(route('purchase-invoices.index'))->assertForbidden();
    }

    public function test_shares_the_users_permissions_with_the_page(): void
    {
        $this->actingAs($this->userWithRole('vendor'))
            ->get(route('dashboard'))
            ->assertInertia(fn ($page) => $page
                ->where('auth.permissions', fn ($permissions) => collect($permissions)->contains('manage-purchase-invoices')
                    && ! collect($permissions)->contains('manage-customers')));
    }

    public function test_guests_are_sent_to_login(): void
    {
        $this->get(route('account.customers.index'))->assertRedirect(route('login'));
    }
}
