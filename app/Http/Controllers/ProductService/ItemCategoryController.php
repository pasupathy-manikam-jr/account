<?php

namespace App\Http\Controllers\ProductService;

use App\Http\Controllers\Controller;
use App\Models\ItemCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ItemCategoryController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('product-service/item-categories/index', [
            'categories' => ItemCategory::query()->withCount('items')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        ItemCategory::create($this->validated($request));

        return $this->done(__('Category created successfully.'));
    }

    public function update(Request $request, ItemCategory $itemCategory): RedirectResponse
    {
        $itemCategory->update($this->validated($request, $itemCategory));

        return $this->done(__('Category updated successfully.'));
    }

    public function destroy(ItemCategory $itemCategory): RedirectResponse
    {
        if ($itemCategory->items()->exists()) {
            return $this->toast('error', __('Categories with items cannot be deleted.'));
        }

        $itemCategory->delete();

        return $this->done(__('Category deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?ItemCategory $category = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('item_categories')->ignore($category)],
            'color' => ['required', 'hex_color'],
        ]);
    }
}
