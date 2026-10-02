<?php

namespace Tests\Feature\Asset;

use App\Models\Asset;
use App\Models\AssetAssignment;
use App\Models\AssetCategory;
use App\Models\AssetDepreciation;
use App\Models\AssetLocation;
use App\Models\AssetMaintenance;
use App\Models\User;
use App\Support\FinancialStatements;
use Carbon\CarbonImmutable;
use Database\Seeders\LedgerSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AssetTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-10-01');
        $this->seed(LedgerSeeder::class);
        $this->admin = $this->userWithRole();
        $this->actingAs($this->admin);
    }

    private function asset(int $quantity = 1, string $price = '10000.00'): Asset
    {
        return Asset::query()->create([
            'name' => 'Proton X50', 'serial_code' => 'VH-'.fake()->unique()->numerify('###'), 'category_id' => AssetCategory::query()->create(['name' => fake()->unique()->word()])->id,
            'purchase_date' => '2024-01-01', 'quantity' => $quantity, 'unit_price' => $price,
        ]);
    }

    public function test_depreciation_schedules_for_each_method(): void
    {
        $asset = $this->asset();
        $expected = [
            'straight_line' => [[180000, 180000, 180000, 180000, 180000], 270000],
            'declining_balance' => [[400000, 240000, 144000, 86400, 29600], 520000],
            'sum_of_years' => [[300000, 240000, 180000, 120000, 60000], 420000],
        ];

        foreach ($expected as $method => [$years, $at18Months]) {
            $schedule = new AssetDepreciation(['method' => $method, 'useful_life_years' => 5, 'salvage_value' => '1000.00', 'start_date' => '2024-01-01']);
            $schedule->setRelation('asset', $asset);

            $this->assertSame($years, $schedule->yearlyAmounts(), $method);
            $this->assertSame($at18Months, $schedule->accumulatedAt(CarbonImmutable::parse('2025-07-01')), $method);
            // Never below salvage, however long it runs.
            $this->assertSame(900000, $schedule->accumulatedAt(CarbonImmutable::parse('2040-01-01')), $method);
        }
    }

    public function test_posting_depreciation_hits_the_ledger_once_and_locks_the_schedule(): void
    {
        $asset = $this->asset();
        $this->post(route('asset.asset-depreciation.store'), ['asset_id' => $asset->id, 'method' => 'straight_line', 'useful_life_years' => 5, 'salvage_value' => '20000', 'start_date' => '2024-01-01'])
            ->assertSessionHasErrors('salvage_value');
        $this->post(route('asset.asset-depreciation.store'), ['asset_id' => $asset->id, 'method' => 'straight_line', 'useful_life_years' => 5, 'salvage_value' => '1000', 'start_date' => '2024-01-01'])
            ->assertSessionHasNoErrors();
        $schedule = AssetDepreciation::query()->sole();

        // 2024-01-01 → 2026-10-01 is 33 months: 2 × 1,800 + 9/12 × 1,800 = 4,950.
        $this->put(route('asset.asset-depreciation.post', $schedule))->assertSessionHasNoErrors();
        $this->assertSame('4950.00', $schedule->refresh()->posted_amount);

        // The trend runs Jan–Dec of this year: RM1,800 a year is RM150 a month; by 31 Jan 2026 two full years (RM3,600) have run.
        $trend = $this->get(route('asset.asset-depreciation.index'))->inertiaProps('trend');
        $this->assertCount(12, $trend);
        $this->assertSame(['Jan', 150.0, 3600.0], [$trend[0]['month'], (float) $trend[0]['monthly'], (float) $trend[0]['accumulated']]);
        $balances = FinancialStatements::balances(null, '2026-10-01')->keyBy('code');
        $this->assertSame(495000, $balances['5430']['closing']);
        $this->assertSame(495000, $balances['1610']['closing']);

        $this->put(route('asset.asset-depreciation.post', $schedule))->assertSessionHasErrors('status');
        $this->put(route('asset.asset-depreciation.update', $schedule), ['asset_id' => $asset->id, 'method' => 'sum_of_years', 'useful_life_years' => 3, 'start_date' => '2024-01-01']);
        $this->assertSame('straight_line', $schedule->refresh()->method);
        $this->put(route('assets.update', $asset), [...$asset->only('name', 'serial_code', 'category_id'), 'purchase_date' => '2024-01-01', 'quantity' => 2, 'unit_price' => '10000']);
        $this->assertSame(1, $asset->refresh()->quantity);

        // Contra asset: the balance sheet shows it as a reduction and still balances.
        $bs = FinancialStatements::balanceSheet('2026-10-01');
        $this->assertSame($bs['total_assets'], $bs['total_liabilities'] + $bs['total_equity']);
    }

    public function test_assignments_respect_quantity_and_drive_asset_status(): void
    {
        $asset = $this->asset(quantity: 2);
        $staff = $this->userWithRole('staff');
        $assign = fn () => $this->post(route('asset.asset-assignments.store'), ['asset_id' => $asset->id, 'assigned_to' => $staff->id, 'assigned_date' => '2026-09-01', 'expected_return_date' => '2026-09-20', 'condition' => 'good']);

        $assign()->assertSessionHasNoErrors();
        $assign()->assertSessionHasNoErrors();
        $assign()->assertSessionHasErrors('asset_id');
        $this->post(route('asset.asset-assignments.store'), ['asset_id' => $asset->id, 'assigned_to' => $this->userWithRole('client')->id, 'assigned_date' => '2026-09-01', 'condition' => 'good'])
            ->assertSessionHasErrors('assigned_to');

        $this->assertSame('assigned', Asset::query()->withStatusCounts()->find($asset->id)->status);
        $this->assertSame('overdue', AssetAssignment::query()->first()->status);
        $this->assertSame([$asset->id], Asset::query()->whereStatus('assigned')->pluck('id')->all());

        $first = AssetAssignment::query()->first();
        $this->put(route('asset.asset-assignments.return', $first), ['returned_date' => '2026-08-01', 'return_condition' => 'fair'])->assertSessionHasErrors('returned_date');
        $this->put(route('asset.asset-assignments.return', $first), ['returned_date' => '2026-09-25', 'return_condition' => 'fair'])->assertSessionHasNoErrors();
        $this->assertSame('returned', $first->refresh()->status);
        $this->assertSame('available', Asset::query()->withStatusCounts()->find($asset->id)->status);

        $this->get(route('asset.asset-assignments.index', ['status' => 'overdue']))->assertOk()
            ->assertInertia(fn ($page) => $page->where('counts.returned', 1)->where('counts.overdue', 1)->has('assignments.data', 1));
    }

    public function test_maintenance_workflow_marks_the_asset_under_maintenance(): void
    {
        $asset = $this->asset();
        $this->post(route('asset.asset-maintenance.store'), ['asset_id' => $asset->id, 'title' => 'Servis 20,000 km', 'maintenance_type' => 'preventive', 'priority' => 'medium', 'scheduled_date' => '2026-10-05', 'cost' => '450'])
            ->assertSessionHasNoErrors();
        $job = AssetMaintenance::query()->sole();

        $this->put(route('asset.asset-maintenance.start', $job));
        $this->assertSame('maintenance', Asset::query()->withStatusCounts()->find($asset->id)->status);
        $this->delete(route('asset.asset-maintenance.destroy', $job));
        $this->assertModelExists($job);

        $this->put(route('asset.asset-maintenance.complete', $job));
        $this->assertSame(['completed', '2026-10-01'], [$job->refresh()->status, $job->completed_date->toDateString()]);
        $this->put(route('asset.asset-maintenance.start', $job))->assertSessionHasErrors('status');
        $this->assertSame('available', Asset::query()->withStatusCounts()->find($asset->id)->status);
    }

    public function test_locations_cannot_loop_and_pages_render_for_the_company_only(): void
    {
        $building = AssetLocation::query()->create(['name' => 'Menara', 'code' => 'B1', 'type' => 'building']);
        $floor = AssetLocation::query()->create(['name' => 'Level 3', 'code' => 'F3', 'type' => 'floor', 'parent_id' => $building->id]);

        $this->put(route('asset.asset-locations.update', $building), ['name' => 'Menara', 'code' => 'B1', 'type' => 'building', 'parent_id' => $floor->id])
            ->assertSessionHasErrors('parent_id');
        $this->delete(route('asset.asset-locations.destroy', $building));
        $this->assertModelExists($building);

        $asset = $this->asset();
        foreach (['assets.index', 'asset.asset-assignments.index', 'asset.asset-maintenance.index', 'asset.asset-depreciation.index', 'asset.asset-locations.index', 'asset.categories.index'] as $route) {
            $this->get(route($route))->assertOk();
        }
        $this->get(route('assets.show', $asset))->assertOk();

        $this->actingAs($this->userWithRole('staff'))->get(route('assets.index'))->assertForbidden();
    }
}
