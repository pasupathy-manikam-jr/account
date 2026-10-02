<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeds_demo_users_who_can_log_in(): void
    {
        $this->seed();
        $this->seed(); // idempotent

        $this->assertSame(52, User::query()->count());

        $admin = User::query()->where('email', 'admin@example.com')->firstOrFail();
        $this->assertSame('company', $admin->type);
        $this->assertTrue($admin->hasRole('company'));
        $this->assertTrue(User::query()->where('email', 'kokleong.chan@example.com')->firstOrFail()->hasRole('vendor'));
        $this->assertTrue(Hash::check('Zx123456', $admin->password));

        $this->post(route('login.store'), ['email' => 'admin@example.com', 'password' => 'Zx123456'])
            ->assertRedirect(route('dashboard'));
    }
}
