<?php

namespace App\Http\Controllers\ProductService;

use App\Http\Controllers\Controller;
use App\Models\Unit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UnitController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('product-service/units/index', [
            'units' => Unit::query()->withCount('items')->orderBy('unit_name')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Unit::create($this->validated($request));

        return $this->done(__('Unit created successfully.'));
    }

    public function update(Request $request, Unit $unit): RedirectResponse
    {
        $unit->update($this->validated($request, $unit));

        return $this->done(__('Unit updated successfully.'));
    }

    public function destroy(Unit $unit): RedirectResponse
    {
        if ($unit->items()->exists()) {
            return $this->toast('error', __('Units used by items cannot be deleted.'));
        }

        $unit->delete();

        return $this->done(__('Unit deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Unit $unit = null): array
    {
        return $request->validate([
            'unit_name' => ['required', 'string', 'max:255', Rule::unique('units')->ignore($unit)],
        ]);
    }
}
