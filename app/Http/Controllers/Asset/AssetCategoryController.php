<?php

namespace App\Http\Controllers\Asset;

use App\Http\Controllers\Controller;
use App\Models\AssetCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AssetCategoryController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('asset/categories', [
            'categories' => AssetCategory::query()->withCount('assets')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        AssetCategory::query()->create($this->validated($request));

        return $this->done(__('Category created successfully.'));
    }

    public function update(Request $request, AssetCategory $category): RedirectResponse
    {
        $category->update($this->validated($request, $category));

        return $this->done(__('Category updated successfully.'));
    }

    public function destroy(AssetCategory $category): RedirectResponse
    {
        if ($category->assets()->exists()) {
            return $this->toast('error', __('Categories with assets cannot be deleted.'));
        }

        $category->delete();

        return $this->done(__('Category deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?AssetCategory $category = null): array
    {
        return $request->validate(['name' => ['required', 'string', 'max:100', Rule::unique('asset_categories')->ignore($category)]]);
    }
}
