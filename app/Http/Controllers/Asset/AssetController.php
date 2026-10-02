<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetLocation;
use App\Support\Money;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AssetController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Asset::query()->withStatusCounts()->with(['category:id,name', 'location:id,name'])
            ->when($request->filled('category_id'), fn (Builder $q) => $q->where('category_id', $request->integer('category_id')))
            ->when($request->filled('location_id'), fn (Builder $q) => $q->where('location_id', $request->integer('location_id')));
        TableQuery::search($query, $request, ['name', 'serial_code']);

        $all = (clone $query)->get();
        $counts = collect(Asset::STATUSES)->mapWithKeys(fn ($s) => [$s => $all->where('status', $s)->count()]);
        $query->when(in_array($request->input('status'), Asset::STATUSES, true), fn (Builder $q) => $q->whereStatus($request->string('status')->toString()));

        return Inertia::render('asset/assets/index', [
            'assets' => TableQuery::paginate($query, $request, [], ['name', 'purchase_date', 'quantity', 'unit_price'], 'purchase_date'),
            'counts' => ['all' => $all->count(), ...$counts],
            'stats' => ['total_cost' => Money::format($all->sum(fn (Asset $a) => Money::toCents($a->purchase_cost)))],
            ...$this->options(),
            'filters' => TableQuery::filters($request, ['status', 'category_id', 'location_id']),
        ]);
    }

    public function show(Asset $asset): Response
    {
        $asset->loadCount(['assignments as out_count' => fn ($q) => $q->whereNull('returned_date'), 'maintenances as repair_count' => fn ($q) => $q->where('status', 'in_progress')])
            ->load(['category:id,name', 'location:id,name', 'assignments' => fn ($q) => $q->latest('assigned_date'), 'assignments.assignee:id,name,email', 'maintenances' => fn ($q) => $q->latest('scheduled_date'), 'depreciation']);

        $depreciation = $asset->depreciation;

        return Inertia::render('asset/assets/show', [
            'asset' => $asset,
            'depreciation' => $depreciation === null ? null : [
                ...$depreciation->toArray(),
                ...$depreciation->figures(today()),
                'schedule' => collect($depreciation->yearlyAmounts())->map(fn (int $amount, int $i) => [
                    'year' => $i + 1,
                    'from' => $depreciation->start_date->addYears($i)->toDateString(),
                    'amount' => Money::format($amount),
                ])->all(),
            ],
            ...$this->options(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $asset = new Asset($this->validated($request));
        $asset->forceFill(['created_by' => $request->user()->id])->save();

        return $this->done(__('Asset created successfully.'));
    }

    public function update(Request $request, Asset $asset): RedirectResponse
    {
        $data = $this->validated($request, $asset);

        if ($asset->depreciation && Money::toCents($asset->depreciation->posted_amount) > 0
            && (Money::toCents($data['unit_price']) !== Money::toCents($asset->unit_price) || (int) $data['quantity'] !== $asset->quantity)) {
            return $this->toast('error', __('Depreciation has been posted for this asset, so its cost can no longer change.'));
        }

        $asset->update($data);

        return $this->done(__('Asset updated successfully.'));
    }

    public function destroy(Asset $asset): RedirectResponse
    {
        if ($asset->assignments()->whereNull('returned_date')->exists() || ($asset->depreciation && Money::toCents($asset->depreciation->posted_amount) > 0)) {
            return $this->toast('error', __('Assets that are handed out or have posted depreciation cannot be deleted.'));
        }

        $asset->delete();

        return $this->done(__('Asset deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function options(): array
    {
        return [
            'categories' => AssetCategory::query()->orderBy('name')->get(['id', 'name']),
            'locations' => AssetLocation::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Asset $asset = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'serial_code' => ['required', 'string', 'max:50', Rule::unique('assets')->ignore($asset)],
            'category_id' => ['required', Rule::exists('asset_categories', 'id')],
            'location_id' => ['nullable', Rule::exists('asset_locations', 'id')->where('is_active', true)],
            'description' => ['nullable', 'string', 'max:2000'],
            'purchase_date' => ['required', 'date', 'before_or_equal:today'],
            // Never below what is handed out right now.
            'quantity' => ['required', 'integer', 'min:'.max(1, $asset?->assignments()->whereNull('returned_date')->count() ?? 1), 'max:100000'],
            'unit_price' => ['required', 'numeric', 'min:0', 'max:9999999999.99', 'decimal:0,2'],
        ]);
    }
}
