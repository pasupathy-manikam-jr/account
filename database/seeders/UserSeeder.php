<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public const PASSWORD = 'Zx123456';

    /**
     * One seeded account per role (role label => email from users.json). With
     * DEMO_LOGINS=true the login page offers them as one-click logins, so never
     * enable that flag on a live server.
     */
    public const QUICK_LOGINS = [
        'Company' => 'company@example.com',
        'Staff' => 'aisyah.rahman@example.com',
        'Client' => 'nazri.abdullah@example.com',
        'Vendor' => 'kokleong.chan@example.com',
    ];

    /**
     * @return list<array{name: string, email: string, password: string}>
     */
    public static function quickLogins(): array
    {
        return array_map(
            fn (string $name, string $email) => ['name' => $name, 'email' => $email, 'password' => self::PASSWORD],
            array_keys(self::QUICK_LOGINS),
            self::QUICK_LOGINS,
        );
    }

    /**
     * Demo logins from database/demo/users.json, all with the password Zx123456.
     * Each user holds the role matching their type (run RolesSeeder first).
     */
    public function run(): void
    {
        $password = Hash::make(self::PASSWORD);

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
