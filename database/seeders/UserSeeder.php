<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Demo logins from database/demo/users.json, all with the password Zx123456.
     * Each user holds the role matching their type (run RolesSeeder first).
     */
    public function run(): void
    {
        $password = Hash::make('Zx123456');

        /** @var list<array{name: string, email: string, type: string, mobile_no?: string}> $rows */
        $rows = json_decode((string) file_get_contents(database_path('demo/users.json')), true);

        foreach ($rows as $row) {
            $user = User::query()->firstOrNew(['email' => $row['email']]);
            $user->forceFill([
                'name' => $row['name'],
                'type' => $row['type'],
                'mobile_no' => $row['mobile_no'] ?? null,
                'password' => $password,
                'email_verified_at' => now(),
            ])->save();

            $user->syncRoles([$row['type']]);
        }
    }
}
