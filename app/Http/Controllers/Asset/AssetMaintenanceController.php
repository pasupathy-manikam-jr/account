<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AssetMaintenanceController extends Controller
{
    public function index(Request $request): Response
    {
        $query = AssetMaintenance::query()->with('asset:id,name,serial_code')
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('title', 'like', "%{$search}%")->orWhere('technician', 'like', "%{$search}%")
                ->orWhereHas('asset', fn (Builder $a) => $a->where('name', 'like', "%{$search}%")->orWhere('serial_code', 'like', "%{$search}%"))))
            ->when(in_array($request->input('maintenance_type'), AssetMaintenance::TYPES, true), fn (Builder $q) => $q->where('maintenance_type', $request->input('maintenance_type')))
            ->when(in_array($request->input('priority'), AssetMaintenance::PRIORITIES, true), fn (Builder $q) => $q->where('priority', $request->input('priority')));

        $counts = TableQuery::countBy($query, 'status');
        $query->when(in_array($request->input('status'), AssetMaintenance::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')));

        return Inertia::render('asset/maintenance', [
            'maintenances' => TableQuery::paginate($query, $request, [], ['title', 'scheduled_date', 'cost'], 'scheduled_date'),
            'counts' => ['all' => $counts->sum(), ...collect(AssetMaintenance::STATUSES)->mapWithKeys(fn ($s) => [$s => $counts[$s] ?? 0])],
            'assets' => Asset::query()->orderBy('name')->get(['id', 'name', 'serial_code'])->map(fn (Asset $a) => ['id' => $a->id, 'name' => "{$a->name} ({$a->serial_code})"]),
            'filters' => TableQuery::filters($request, ['status', 'maintenance_type', 'priority']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        AssetMaintenance::query()->create($this->validated($request));

        return $this->done(__('Maintenance scheduled successfully.'));
    }

    public function update(Request $request, AssetMaintenance $assetMaintenance): RedirectResponse
    {
        if (! in_array($assetMaintenance->status, ['scheduled', 'in_progress'], true)) {
            return $this->toast('error', __('Completed or cancelled maintenance cannot be edited.'));
        }

        $assetMaintenance->update($this->validated($request));

        return $this->done(__('Maintenance updated successfully.'));
    }

    public function destroy(AssetMaintenance $assetMaintenance): RedirectResponse
    {
        if ($assetMaintenance->status === 'in_progress') {
            return $this->toast('error', __('Maintenance in progress cannot be deleted; complete or cancel it first.'));
        }

        $assetMaintenance->delete();

        return $this->done(__('Maintenance deleted successfully.'));
    }

    /** start / complete / cancel, fixed by the route. */
    public function transition(AssetMaintenance $assetMaintenance, string $action): RedirectResponse
    {
        $assetMaintenance->transition($action);

        return $this->done(__('Maintenance :status.', ['status' => __(str_replace('_', ' ', $assetMaintenance->status))]));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'asset_id' => ['required', Rule::exists('assets', 'id')],
            'title' => ['required', 'string', 'max:255'],
            'maintenance_type' => ['required', Rule::in(AssetMaintenance::TYPES)],
            'priority' => ['required', Rule::in(AssetMaintenance::PRIORITIES)],
            'scheduled_date' => ['required', 'date'],
            'cost' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99', 'decimal:0,2'],
            'technician' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]) + ['cost' => 0];
    }
}
