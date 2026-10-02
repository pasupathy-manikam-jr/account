<?php

namespace App\Http\Controllers\UserManagement;

use App\Http\Controllers\Controller;
use App\Models\MessageTemplate;
use App\Models\User;
use App\Support\Settings;
use App\Support\TableQuery;
use Database\Seeders\RolesSeeder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

/**
 * Every login in the system. New logins made here are staff; client and vendor logins come with their
 * customer or vendor record. Staff can hold the built-in staff role or any custom role.
 */
class UserController extends Controller
{
    public const TYPES = ['company', 'staff', 'client', 'vendor'];

    public function index(Request $request): Response
    {
        $query = User::query()->with('roles:id,name');
        TableQuery::search($query, $request, ['name', 'email', 'mobile_no']);

        $query->when($request->filled('role'), fn (Builder $q) => $q->whereHas('roles', fn (Builder $r) => $r->where('name', $request->string('role')->toString())))
            ->when(in_array($request->input('login'), ['enabled', 'disabled'], true), fn (Builder $q) => $q->where('is_login_enabled', $request->input('login') === 'enabled'));

        return Inertia::render('user-management/users/index', [
            'users' => TableQuery::paginate($query, $request, [], ['name', 'email', 'created_at'], 'created_at'),
            'roles' => Role::query()->orderBy('name')->pluck('name'),
            'staffRoles' => $this->staffRoles(),
            'filters' => TableQuery::filters($request, ['role', 'login']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            ...$this->rules(),
            'role' => ['required', Rule::in($this->staffRoles())],
            'password' => ['required', 'string', Password::defaults()],
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = new User(Arr::only($data, ['name', 'email', 'mobile_no', 'password']));
            $user->forceFill(['type' => 'staff', 'email_verified_at' => now()])->save();
            $user->assignRole($data['role']);

            return $user;
        });

        $this->sendWelcome($user, $data['password']);

        return $this->done(__('User created. Their sign-in details were emailed to :email.', ['email' => $user->email]));
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            ...$this->rules($user),
            // Only staff change role here; other types keep the role matching their type.
            'role' => [$user->type === 'staff' ? 'required' : 'prohibited', Rule::in($this->staffRoles())],
        ]);

        DB::transaction(function () use ($user, $data) {
            $user->update(Arr::only($data, ['name', 'email', 'mobile_no']));

            if ($user->type === 'staff') {
                $user->syncRoles([$data['role']]);
            }
        });

        return $this->done(__('User updated successfully.'));
    }

    public function password(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate(['password' => ['required', 'string', 'confirmed', Password::defaults()]]);
        $user->forceFill(['password' => $data['password']])->save();

        return $this->done(__('Password changed for :name.', ['name' => $user->name]));
    }

    /** Turn sign-in on or off; the account and its history stay. */
    public function toggle(Request $request, User $user): RedirectResponse
    {
        if ($user->is($request->user()) || $user->type === 'company') {
            return $this->toast('error', __('You cannot disable your own login or the company owner\'s.'));
        }

        $user->forceFill(['is_login_enabled' => ! $user->is_login_enabled])->save();

        return $this->done($user->is_login_enabled ? __('Login enabled for :name.', ['name' => $user->name]) : __('Login disabled for :name.', ['name' => $user->name]));
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($user->is($request->user()) || $user->type === 'company') {
            return $this->toast('error', __('You cannot delete yourself or the company owner.'));
        }

        // Invoices, payments and the like still point at them: the delete is refused by the database.
        if (! rescue(fn () => $user->delete(), false, report: false)) {
            return $this->toast('error', __(':name has records in the books and cannot be deleted. Disable their login instead.', ['name' => $user->name]));
        }

        return $this->done(__('User deleted successfully.'));
    }

    /** The New User email, in the user's language, through the editable template. */
    private function sendWelcome(User $user, string $password): void
    {
        $mail = MessageTemplate::render('email', 'new_user', [
            'app_name' => config('app.name'),
            'company_name' => Settings::company(),
            'app_url' => config('app.url'),
            'name' => $user->name,
            'email' => $user->email,
            'password' => $password,
        ], $user->lang);

        Mail::raw($mail['body'], fn ($message) => $message->to($user->email, $user->name)->subject((string) $mail['subject']));
    }

    /**
     * Staff and the custom roles (anything that isn't another type's built-in role).
     *
     * @return list<string>
     */
    private function staffRoles(): array
    {
        return array_values(Role::query()->whereNotIn('name', array_diff(RolesSeeder::ROLES, ['staff']))->orderBy('name')->pluck('name')->all());
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(?User $user = null): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique('users')->ignore($user)],
            'mobile_no' => ['nullable', 'string', 'max:30'],
        ];
    }
}
