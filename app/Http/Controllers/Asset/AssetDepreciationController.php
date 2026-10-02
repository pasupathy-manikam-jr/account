<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetDepreciation;
use App\Support\Money;
use App\Support\Settings;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AssetDepreciationController extends Controller
{
    public function index(Request $request): Response
    {
        $query = AssetDepreciation::query()->with('asset:id,name,serial_code,quantity,unit_price')
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->whereHas('asset', fn (Builder $a) => $a
                ->where('name', 'like', "%{$search}%")->orWhere('serial_code', 'like', "%{$search}%")));

        $all = (clone $query)->get();
        $figures = $all->mapWithKeys(fn (AssetDepreciation $d) => [$d->id => $d->figures(today())]);
        $counts = TableQuery::countBy($query, 'method');
        $query->when(in_array($request->input('method'), AssetDepreciation::METHODS, true), fn (Builder $q) => $q->where('method', $request->input('method')));

        $schedules = TableQuery::paginate($query, $request, [], ['start_date', 'useful_life_years', 'salvage_value'], 'start_date');
        $schedules->getCollection()->transform(fn (AssetDepreciation $d) => [...$d->toArray(), ...$figures[$d->id]]);
        $sum = fn (string $key) => Money::format($figures->sum(fn (array $f) => Money::toCents($f[$key])));

        return Inertia::render('asset/depreciation', [
            'schedules' => $schedules,
            'counts' => ['all' => $counts->sum(), ...collect(AssetDepreciation::METHODS)->mapWithKeys(fn ($m) => [$m => $counts[$m] ?? 0])],
            'stats' => [
                'count' => $all->count(),
                'book_value' => $sum('book_value'),
                'annual' => $sum('annual'),
                'average_life' => round((float) $all->avg('useful_life_years'), 1),
                'fully_depreciated' => $figures->where('status', 'fully_depreciated')->count(),
            ],
            'trend' => $this->trend($all),
            // Assets without a schedule yet (plus each row's own asset when editing, added on the page).
            'assets' => Asset::query()->whereDoesntHave('depreciation')->orderBy('name')->get(['id', 'name', 'serial_code', 'purchase_date'])
                ->map(fn (Asset $a) => ['id' => $a->id, 'name' => "{$a->name} ({$a->serial_code})", 'purchase_date' => $a->purchase_date->toDateString()]),
            'filters' => TableQuery::filters($request, ['method']),
        ]);
    }

    /**
     * This year, month by month across every schedule: the depreciation charged in the month and the total
     * accumulated by its end (later months are the schedule's projection).
     *
     * @param  Collection<int, AssetDepreciation>  $schedules
     * @return list<array{month: string, monthly: float, accumulated: float}>
     */
    private function trend(Collection $schedules): array
    {
        $months = [];
        $start = today()->startOfYear();

        for ($i = 0; $i < 12; $i++) {
            $end = $start->addMonths($i)->endOfMonth()->startOfDay();
            $before = $start->addMonths($i)->subDay();
            $accumulated = $schedules->sum(fn (AssetDepreciation $d) => $d->accumulatedAt($end));
            $monthly = $accumulated - $schedules->sum(fn (AssetDepreciation $d) => $d->accumulatedAt($before));
            $months[] = ['month' => $end->format('M'), 'monthly' => $monthly / 100, 'accumulated' => $accumulated / 100];
        }

        return $months;
    }

    public function store(Request $request): RedirectResponse
    {
        AssetDepreciation::query()->create($this->validated($request));

        return $this->done(__('Depreciation schedule created successfully.'));
    }

    public function update(Request $request, AssetDepreciation $assetDepreciation): RedirectResponse
    {
        if (Money::toCents($assetDepreciation->posted_amount) > 0) {
            return $this->toast('error', __('Depreciation has been posted for this schedule, so it can no longer change.'));
        }

        $assetDepreciation->update($this->validated($request, $assetDepreciation));

        return $this->done(__('Depreciation schedule updated successfully.'));
    }

    public function destroy(AssetDepreciation $assetDepreciation): RedirectResponse
    {
        if (Money::toCents($assetDepreciation->posted_amount) > 0) {
            return $this->toast('error', __('Schedules with posted depreciation cannot be deleted.'));
        }

        $assetDepreciation->delete();

        return $this->done(__('Depreciation schedule deleted successfully.'));
    }

    /** Post what has accrued up to today and isn't in the ledger yet. */
    public function post(AssetDepreciation $assetDepreciation): RedirectResponse
    {
        $posted = $assetDepreciation->postTo(today());

        return $this->done(__('Depreciation of :amount posted to the ledger.', ['amount' => Settings::money($posted / 100)]));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?AssetDepreciation $depreciation = null): array
    {
        $data = $request->validate([
            'asset_id' => ['required', Rule::exists('assets', 'id'), Rule::unique('asset_depreciations')->ignore($depreciation)],
            'method' => ['required', Rule::in(AssetDepreciation::METHODS)],
            'useful_life_years' => ['required', 'integer', 'between:1,50'],
            'salvage_value' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99', 'decimal:0,2'],
            'start_date' => ['required', 'date'],
        ], ['asset_id.unique' => __('This asset already has a depreciation schedule.')]) + ['salvage_value' => 0];

        $cost = Money::toCents(Asset::query()->whereKey($data['asset_id'])->firstOrFail()->purchase_cost);

        if (Money::toCents($data['salvage_value']) > $cost) {
            throw ValidationException::withMessages(['salvage_value' => __('The salvage value cannot be more than the asset\'s cost.')]);
        }

        return $data;
    }
}
