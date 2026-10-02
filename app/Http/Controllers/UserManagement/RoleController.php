<?php

namespace App\Http\Controllers\UserManagement;

use App\Http\Controllers\Controller;
use App\Support\PermissionGroups;
use App\Support\TableQuery;
use Database\Seeders\RolesSeeder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Roles and what they may do. The built-in roles can't be renamed or deleted, and the company (owner) role
 * can't be edited at all, so nobody can lock the business out of its own books.
 */
class RoleController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Role::query()->withCount(['permissions', 'users']);
        TableQuery::search($query, $request, ['name']);

        return Inertia::render('user-management/roles/index', [
            'roles' => TableQuery::paginate($query, $request, [], ['name', 'created_at'], 'created_at', 'asc'),
            'builtIn' => RolesSeeder::ROLES,
            'filters' => TableQuery::filters($request),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('user-management/roles/form', ['role' => null, 'selected' => [], ...$this->options()]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        DB::transaction(function () use ($data) {
            Role::create(['name' => $data['name'], 'guard_name' => 'web'])->syncPermissions($data['permissions']);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Role created successfully.')]);

        return to_route('roles.index');
    }

    public function edit(Role $role): Response|RedirectResponse
    {
        if ($role->name === 'company') {
            return $this->toast('error', __('The company role always has every permission and cannot be edited.'));
        }

        return Inertia::render('user-management/roles/form', [
            'role' => $role->only('id', 'name'),
            'selected' => $role->permissions()->pluck('name'),
            'locked' => in_array($role->name, RolesSeeder::ROLES, true),
            ...$this->options(),
        ]);
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        if ($role->name === 'company') {
            return $this->toast('error', __('The company role always has every permission and cannot be edited.'));
        }

        $data = $this->validated($request, $role);

        DB::transaction(function () use ($role, $data) {
            // Built-in role names are what users.type points at, so they keep their name.
            if (! in_array($role->name, RolesSeeder::ROLES, true)) {
                $role->update(['name' => $data['name']]);
            }

            $role->syncPermissions($data['permissions']);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Role updated successfully.')]);

        return to_route('roles.index');
    }

    public function destroy(Role $role): RedirectResponse
    {
        if (in_array($role->name, RolesSeeder::ROLES, true) || $role->users()->exists()) {
            return $this->toast('error', __('Built-in roles and roles that still have users cannot be deleted.'));
        }

        $role->delete();

        return $this->done(__('Role deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function options(): array
    {
        return ['groups' => PermissionGroups::group(Permission::query()->orderBy('name')->pluck('name'))];
    }

    /**
     * @return array{name: string, permissions: list<string>}
     */
    private function validated(Request $request, ?Role $role = null): array
    {
        /** @var array{name: string, permissions: list<string>} */
        return $request->validate([
            'name' => ['required', 'string', 'max:50', 'regex:/^[a-z][a-z0-9-]*$/', Rule::unique('roles', 'name')->ignore($role), Rule::notIn(array_diff(RolesSeeder::ROLES, [$role?->name]))],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['string', Rule::exists('permissions', 'name')],
        ], [
            'name.regex' => __('Use lowercase letters, numbers and dashes, starting with a letter (e.g. finance-clerk).'),
            'permissions.required' => __('Choose at least one permission.'),
        ]);
    }
}
