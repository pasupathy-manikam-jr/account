<?php

namespace App\Http\Controllers\ProductService;

use App\Http\Controllers\Controller;
use App\Models\Tax;
use EInvoiceSdk\Codes;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TaxController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('product-service/taxes/index', [
            'taxes' => Tax::query()->withCount('items')->orderBy('tax_name')->get(),
            'typeCodes' => Codes::taxTypes(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Tax::create($this->validated($request));

        return $this->done(__('Tax created successfully.'));
    }

    public function update(Request $request, Tax $tax): RedirectResponse
    {
        $tax->update($this->validated($request, $tax));

        return $this->done(__('Tax updated successfully.'));
    }

    public function destroy(Tax $tax): RedirectResponse
    {
        if ($tax->items()->exists()) {
            return $this->toast('error', __('Taxes applied to items cannot be deleted.'));
        }

        $tax->delete();

        return $this->done(__('Tax deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Tax $tax = null): array
    {
        return $request->validate([
            'tax_name' => ['required', 'string', 'max:255', Rule::unique('taxes')->ignore($tax)],
            'rate' => ['required', 'numeric', 'between:0,100', 'decimal:0,2'],
            'type_code' => ['nullable', Rule::in(array_keys(Codes::taxTypes()))],
        ]);
    }
}
