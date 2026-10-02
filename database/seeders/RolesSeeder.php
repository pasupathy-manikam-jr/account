<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesSeeder extends Seeder
{
    /** Built-in roles (the users.type values); they can't be deleted. */
    public const ROLES = ['company', 'staff', 'client', 'vendor'];

    /**
     * Create the built-in roles with the AccountGo demo's permission sets (database/demo/roles.json).
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        /** @var array<string, list<string>> $roles */
        $roles = File::json(database_path('demo/roles.json'), JSON_THROW_ON_ERROR);
        $now = now();

        Permission::query()->upsert(
            collect(array_merge(...array_values($roles)))->unique()->map(fn (string $name) => [
                'name' => $name, 'guard_name' => 'web', 'created_at' => $now, 'updated_at' => $now,
            ])->values()->all(),
            ['name', 'guard_name'],
            ['updated_at'],
        );

        Role::query()->upsert(
            collect(array_keys($roles))->map(fn (string $name) => [
                'name' => $name, 'guard_name' => 'web', 'created_at' => $now, 'updated_at' => $now,
            ])->all(),
            ['name', 'guard_name'],
            ['updated_at'],
        );

        $ids = Permission::query()->pluck('id', 'name');

        foreach (Role::query()->whereIn('name', array_keys($roles))->get() as $role) {
            $role->permissions()->sync($ids->only($roles[$role->name])->values());
        }

        // Model events are off while seeding, so Spatie won't flush its cache on its own.
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
