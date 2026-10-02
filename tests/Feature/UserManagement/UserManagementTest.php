<?php

namespace Tests\Feature\UserManagement;

use App\Models\User;
use App\Support\PermissionGroups;
use Database\Seeders\MessageTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Event;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_custom_roles_are_created_edited_and_given_to_staff(): void
    {
        $this->actingAs($admin = $this->userWithRole());

        $this->post(route('roles.store'), ['name' => 'Finance Clerk', 'permissions' => ['manage-revenues']])->assertSessionHasErrors('name');
        $this->post(route('roles.store'), ['name' => 'staff', 'permissions' => ['manage-revenues']])->assertSessionHasErrors('name');
        $this->post(route('roles.store'), ['name' => 'finance-clerk', 'permissions' => []])->assertSessionHasErrors('permissions');
        $this->post(route('roles.store'), ['name' => 'finance-clerk', 'permissions' => ['manage-revenues', 'create-revenues']])->assertRedirect(route('roles.index'));
        $role = Role::findByName('finance-clerk');
        $this->assertSame(['create-revenues', 'manage-revenues'], $role->permissions()->orderBy('name')->pluck('name')->all());

        // The owner role is locked; built-in roles keep their name.
        $this->get(route('roles.edit', Role::findByName('company')))->assertRedirect();
        $staff = Role::findByName('staff');
        $this->put(route('roles.update', $staff), ['name' => 'staff', 'permissions' => ['manage-revenues']])->assertSessionHasNoErrors();
        $this->assertSame(['manage-revenues'], $staff->permissions()->pluck('name')->all());
        $this->delete(route('roles.destroy', $staff));
        $this->assertNotNull(Role::findByName('staff'));

        $this->post(route('users.store'), ['name' => 'Cik Zarina', 'email' => 'zarina@example.com', 'role' => 'vendor', 'password' => 'Zx123456'])->assertSessionHasErrors('role');
        $this->post(route('users.store'), ['name' => 'Cik Zarina', 'email' => 'zarina@example.com', 'role' => 'finance-clerk', 'password' => 'Zx123456'])->assertSessionHasNoErrors();
        $zarina = User::query()->where('email', 'zarina@example.com')->sole();
        $this->assertSame('staff', $zarina->type);
        $this->assertTrue($zarina->hasRole('finance-clerk'));
        $this->assertTrue($zarina->can('create-revenues'));

        // A role in use can't be deleted.
        $this->delete(route('roles.destroy', $role));
        $this->assertNotNull(Role::findByName('finance-clerk'));
        $this->get(route('roles.create'))->assertOk()->assertInertia(fn ($page) => $page->has('groups'));
    }

    public function test_new_staff_get_the_welcome_email_from_the_template(): void
    {
        $this->seed(MessageTemplateSeeder::class);
        $this->actingAs($this->userWithRole());
        Event::fake([MessageSent::class]);

        $this->post(route('users.store'), ['name' => 'Encik Faiz', 'email' => 'faiz@example.com', 'role' => 'staff', 'password' => 'Zx123456']);

        Event::assertDispatched(MessageSent::class, fn (MessageSent $event) => $event->message->getSubject() === 'Welcome to '.config('app.name')
            && str_contains($event->message->getTextBody(), 'Password: Zx123456'));
    }

    public function test_disabled_users_cannot_sign_in_and_are_signed_out(): void
    {
        $admin = $this->userWithRole();
        $staff = $this->userWithRole('staff');
        $staff->forceFill(['password' => 'Zx123456'])->save();
        $this->actingAs($admin);

        $this->put(route('users.toggle', $admin))->assertSessionHas('inertia.flash_data.toast.type', 'error');
        $this->put(route('users.toggle', $staff));
        $this->assertFalse($staff->refresh()->is_login_enabled);

        auth()->logout();
        $this->post(route('login.store'), ['email' => $staff->email, 'password' => 'Zx123456'])->assertSessionHasErrors('email');
        $this->assertGuest();

        // An existing session is ended on the next request.
        $this->actingAs($staff)->get(route('dashboard'))->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_password_change_and_delete_guards(): void
    {
        $admin = $this->userWithRole();
        $staff = $this->userWithRole('staff');
        $this->actingAs($admin);

        $this->put(route('users.password', $staff), ['password' => 'Zx123456', 'password_confirmation' => 'nope'])->assertSessionHasErrors('password');
        $this->put(route('users.password', $staff), ['password' => 'Zx123456', 'password_confirmation' => 'Zx123456'])->assertSessionHasNoErrors();

        $this->delete(route('users.destroy', $admin));
        $this->assertModelExists($admin);
        $this->delete(route('users.destroy', $staff));
        $this->assertModelMissing($staff);

        $this->get(route('users.index', ['role' => 'company']))->assertOk()->assertInertia(fn ($page) => $page->has('users.data', 1));
        $this->get(route('users.index', ['login' => 'disabled']))->assertInertia(fn ($page) => $page->has('users.data', 0));
        $this->actingAs($this->userWithRole('staff'))->get(route('users.index'))->assertForbidden();
    }

    public function test_permissions_are_grouped_by_the_resource_they_act_on(): void
    {
        $groups = collect(PermissionGroups::group(['manage-any-goals', 'create-goals', 'convert-to-invoice-retainer', 'year-end-close']))->keyBy('resource');

        $this->assertSame(['Manage Any', 'Create'], array_column($groups['goals']['permissions'], 'label'));
        $this->assertSame('Convert To Invoice', $groups['retainer']['permissions'][0]['label']);
        $this->assertArrayHasKey('year-end-close', $groups->all());
    }
}
