<?php

namespace Database\Seeders;

use App\Support\Settings;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SettingsSeeder extends Seeder
{
    /**
     * The demo company's details. Settings someone already saved are left alone.
     */
    public function run(): void
    {
        $saved = DB::table('settings')->pluck('key')->all();

        Settings::put(array_diff_key([
            'company_name' => 'Lim Group Sdn. Bhd.',
            'company_registration_no' => '201901023456 (1332456-K)',
            'sst_registration_no' => 'W10-1808-32001234',
            'company_address' => 'Level 12, Menara Lim Group, 288 Jalan Ampang',
            'company_city' => 'Kuala Lumpur',
            'company_state' => 'W.P. Kuala Lumpur',
            'company_postcode' => '50450',
            'company_country' => 'Malaysia',
            'company_phone' => '+60 3-2161 8888',
            'company_email' => 'akaun@limgroup.com.my',
        ], array_flip($saved)));
    }
}
