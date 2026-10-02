<?php

namespace App\Http\Controllers;

use App\Models\Warehouse;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class WarehouseController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Warehouse::query()
            ->when($request->filled('status'), fn (Builder $q) => $q->where('is_active', $request->input('status') === 'active'));

        return Inertia::render('warehouses/index', [
            'warehouses' => TableQuery::paginate($query, $request, ['name', 'city', 'email', 'phone'], ['name', 'city', 'is_active'], 'name', 'asc'),
            'filters' => TableQuery::filters($request, ['status']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Warehouse::create($this->validated($request));

        return $this->done(__('Warehouse created successfully.'));
    }

    public function update(Request $request, Warehouse $warehouse): RedirectResponse
    {
        $warehouse->update($this->validated($request, $warehouse));

        return $this->done(__('Warehouse updated successfully.'));
    }

    public function destroy(Warehouse $warehouse): RedirectResponse
    {
        if ($warehouse->stocks()->where('quantity', '!=', 0)->exists()) {
            return $this->toast('error', __('Warehouses holding stock cannot be deleted. Deactivate it instead.'));
        }

        $warehouse->stocks()->delete();
        $warehouse->delete();

        return $this->done(__('Warehouse deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Warehouse $warehouse = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('warehouses')->ignore($warehouse)],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'zip_code' => ['nullable', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'is_active' => ['boolean'],
        ]);
    }
}
