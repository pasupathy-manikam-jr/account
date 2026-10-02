<?php

namespace Database\Seeders;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetDepreciation;
use App\Models\AssetLocation;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;

class AssetSeeder extends Seeder
{
    /**
     * The asset register from database/demo/assets.json. Schedules marked "post" have their depreciation
     * posted to the ledger up to the end of last month, through the model, like the Post button does.
     */
    public function run(): void
    {
        /** @var array{categories: list<string>, locations: list<array<string, string|null>>, assets: list<array<string, mixed>>, assignments: list<array<string, string|null>>, maintenances: list<array<string, string|null>>, depreciations: list<array<string, mixed>>} $demo */
        $demo = File::json(database_path('demo/assets.json'), JSON_THROW_ON_ERROR);
        $admin = User::query()->where('email', 'company@example.com')->value('id');

        foreach ($demo['categories'] as $name) {
            AssetCategory::query()->firstOrCreate(['name' => $name]);
        }

        foreach ($demo['locations'] as $row) {
            AssetLocation::query()->updateOrCreate(['code' => $row['code']], [
                'name' => $row['name'],
                'type' => $row['type'],
                'parent_id' => $row['parent'] ? AssetLocation::query()->where('code', $row['parent'])->value('id') : null,
            ]);
        }

        $categories = AssetCategory::query()->pluck('id', 'name');
        $locations = AssetLocation::query()->pluck('id', 'code');

        foreach ($demo['assets'] as $row) {
            $asset = Asset::query()->firstOrNew(['serial_code' => $row['serial_code']]);
            $asset->fill([...Arr::except($row, ['category', 'location']), 'category_id' => $categories[$row['category']], 'location_id' => $locations[$row['location']]])
                ->forceFill(['created_by' => $admin])->save();
        }

        $assets = Asset::query()->pluck('id', 'serial_code');
        $users = User::query()->pluck('id', 'email');

        foreach ($demo['assignments'] as $row) {
            $assignment = Asset::query()->whereKey($assets[$row['asset']])->firstOrFail()->assignments()
                ->firstOrNew(['assigned_to' => $users[$row['user']], 'assigned_date' => $row['assigned_date']]);
            $assignment->fill(Arr::only($row, ['expected_return_date', 'condition']))
                ->forceFill(Arr::only($row, ['returned_date', 'return_condition']))->save();
        }

        foreach ($demo['maintenances'] as $row) {
            Asset::query()->whereKey($assets[$row['asset']])->firstOrFail()->maintenances()->firstOrNew(['title' => $row['title']])
                ->fill(Arr::except($row, ['asset', 'status', 'completed_date']))
                ->forceFill(['status' => $row['status'], 'completed_date' => $row['completed_date']])->save();
        }

        foreach ($demo['depreciations'] as $row) {
            $schedule = AssetDepreciation::query()->firstOrNew(['asset_id' => $assets[$row['asset']]]);

            if ($schedule->exists) {
                continue; // already seeded (and maybe posted)
            }

            $schedule->fill(Arr::except($row, ['asset', 'post']))->save();

            if ($row['post']) {
                // A posting per financial year end, then the year so far, so each year's P&L carries its share.
                $through = Carbon::today()->subMonthNoOverflow()->endOfMonth();

                for ($year = $schedule->start_date->year; $year < $through->year; $year++) {
                    $schedule->postTo(Carbon::create($year, 12, 31));
                }

                $schedule->postTo($through);
            }
        }
    }
}
