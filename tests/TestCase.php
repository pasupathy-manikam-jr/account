<?php

namespace Tests;

use App\Models\User;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Page tests check props, not compiled assets, so they don't depend on a fresh `npm run build`.
        $this->withoutVite();
    }

    /**
     * Create a user holding one of the seeded roles (company, staff, client, vendor).
     */
    protected function userWithRole(string $role = 'company'): User
    {
        $this->seed(RolesSeeder::class);

        return User::factory()->create(['type' => $role])->assignRole($role);
    }

    protected function skipUnlessFortifyHas(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }
}
