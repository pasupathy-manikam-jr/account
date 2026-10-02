<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Controller;
use App\Models\AssetLocation;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AssetLocationController extends Controller
{
    public function index(Request $request): Response
    {
        $query = AssetLocation::query()->with('parent:id,name')->withCount(['assets', 'children']);
        TableQuery::search($query, $request, ['name', 'code']);

        $counts = TableQuery::countBy($query, 'type');
        $query->when(in_array($request->input('type'), AssetLocation::TYPES, true), fn (Builder $q) => $q->where('type', $request->input('type')));

        return Inertia::render('asset/locations', [
            'locations' => TableQuery::paginate($query, $request, [], ['name', 'code', 'created_at'], 'name', 'asc'),
            'counts' => ['all' => $counts->sum(), ...collect(AssetLocation::TYPES)->mapWithKeys(fn ($t) => [$t => $counts[$t] ?? 0])],
            'parents' => AssetLocation::query()->orderBy('name')->get(['id', 'name', 'type']),
            'filters' => TableQuery::filters($request, ['type']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        AssetLocation::query()->create($this->validated($request));

        return $this->done(__('Location created successfully.'));
    }

    public function update(Request $request, AssetLocation $assetLocation): RedirectResponse
    {
        $assetLocation->update($this->validated($request, $assetLocation));

        return $this->done(__('Location updated successfully.'));
    }

    public function destroy(AssetLocation $assetLocation): RedirectResponse
    {
        if ($assetLocation->assets()->exists() || $assetLocation->children()->exists()) {
            return $this->toast('error', __('Locations holding assets or other locations cannot be deleted.'));
        }

        $assetLocation->delete();

        return $this->done(__('Location deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?AssetLocation $location = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:30', Rule::unique('asset_locations')->ignore($location)],
            'type' => ['required', Rule::in(AssetLocation::TYPES)],
            // Not itself or anything beneath it, so the tree can't loop.
            'parent_id' => ['nullable', Rule::exists('asset_locations', 'id'), Rule::notIn($location?->selfAndDescendantIds() ?? [])],
            'is_active' => ['boolean'],
        ], ['parent_id.not_in' => __('A location cannot sit inside itself or one of its own sub-locations.')]);
    }
}
