<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetAssignment;
use App\Models\User;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AssetAssignmentController extends Controller
{
    public const STATUSES = ['active', 'overdue', 'returned'];

    public function index(Request $request): Response
    {
        $query = AssetAssignment::query()->with(['asset:id,name,serial_code', 'assignee:id,name,email'])
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereHas('asset', fn (Builder $a) => $a->where('name', 'like', "%{$search}%")->orWhere('serial_code', 'like', "%{$search}%"))
                ->orWhereHas('assignee', fn (Builder $u) => $u->where('name', 'like', "%{$search}%"))));

        $query->when($request->filled('assigned_to'), fn (Builder $q) => $q->where('assigned_to', $request->integer('assigned_to')));
        $all = (clone $query)->get(['id', 'returned_date', 'expected_return_date']);
        $counts = collect(self::STATUSES)->mapWithKeys(fn ($s) => [$s => $all->where('status', $s)->count()]);
        $today = today()->toDateString();
        $query->when($request->input('status'), fn (Builder $q, string $status) => match ($status) {
            'returned' => $q->whereNotNull('returned_date'),
            'overdue' => $q->whereNull('returned_date')->whereDate('expected_return_date', '<', $today),
            'active' => $q->whereNull('returned_date')->where(fn (Builder $w) => $w->whereNull('expected_return_date')->orWhereDate('expected_return_date', '>=', $today)),
            default => $q,
        });

        return Inertia::render('asset/assignments', [
            'assignments' => TableQuery::paginate($query, $request, [], ['assigned_date', 'expected_return_date'], 'assigned_date'),
            'counts' => ['all' => $all->count(), ...$counts],
            'assets' => Asset::query()->withStatusCounts()->orderBy('name')->get(['id', 'name', 'serial_code', 'quantity'])
                ->map(fn (Asset $a) => ['id' => $a->id, 'name' => "{$a->name} ({$a->serial_code})", 'free' => $a->quantity - (int) $a->getAttribute('out_count')]),
            'staff' => self::staff(),
            'filters' => TableQuery::filters($request, ['status', 'assigned_to']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        AssetAssignment::query()->create($this->validated($request));

        return $this->done(__('Asset assigned successfully.'));
    }

    public function update(Request $request, AssetAssignment $assetAssignment): RedirectResponse
    {
        if ($assetAssignment->returned_date !== null) {
            return $this->toast('error', __('Returned assignments cannot be edited.'));
        }

        $assetAssignment->update($this->validated($request, $assetAssignment));

        return $this->done(__('Assignment updated successfully.'));
    }

    public function destroy(AssetAssignment $assetAssignment): RedirectResponse
    {
        $assetAssignment->delete();

        return $this->done(__('Assignment deleted successfully.'));
    }

    /** Record the asset coming back, and the state it came back in. */
    public function return(Request $request, AssetAssignment $assetAssignment): RedirectResponse
    {
        if ($assetAssignment->returned_date !== null) {
            return $this->toast('error', __('This asset has already been returned.'));
        }

        $data = $request->validate([
            'returned_date' => ['required', 'date', 'after_or_equal:'.$assetAssignment->assigned_date->toDateString(), 'before_or_equal:today'],
            'return_condition' => ['required', Rule::in(AssetAssignment::CONDITIONS)],
        ]);
        $assetAssignment->forceFill($data)->save();

        return $this->done(__('Asset returned successfully.'));
    }

    /**
     * Internal users an asset can be handed to.
     *
     * @return list<array{id: int, name: string, email: string}>
     */
    public static function staff(): array
    {
        return array_values(User::query()->whereIn('type', ['company', 'staff'])->orderBy('name')->get(['id', 'name', 'email'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email])->all());
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?AssetAssignment $assignment = null): array
    {
        $data = $request->validate([
            'asset_id' => ['required', Rule::exists('assets', 'id')],
            'assigned_to' => ['required', Rule::exists('users', 'id')->whereIn('type', ['company', 'staff'])],
            'assigned_date' => ['required', 'date', 'before_or_equal:today'],
            'expected_return_date' => ['nullable', 'date', 'after_or_equal:assigned_date'],
            'condition' => ['required', Rule::in(AssetAssignment::CONDITIONS)],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        // Every unit of the asset is already out (this assignment excluded when editing).
        $asset = Asset::query()->whereKey($data['asset_id'])->firstOrFail();
        $out = $asset->assignments()->whereNull('returned_date')->when($assignment, fn (Builder $q) => $q->whereKeyNot($assignment->id))->count();

        if ($out >= $asset->quantity) {
            throw ValidationException::withMessages(['asset_id' => __('Every unit of this asset is already assigned.')]);
        }

        return $data;
    }
}
