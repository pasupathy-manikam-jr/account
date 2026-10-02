<?php

namespace App\Http\Controllers\Goal;

use App\Http\Controllers\Controller;
use App\Models\GoalCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class GoalCategoryController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('goal/categories/index', [
            'categories' => GoalCategory::query()->withCount('goals')->orderBy('category_name')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        GoalCategory::query()->create($this->validated($request));

        return $this->done(__('Category created successfully.'));
    }

    public function update(Request $request, GoalCategory $category): RedirectResponse
    {
        $category->update($this->validated($request, $category));

        return $this->done(__('Category updated successfully.'));
    }

    public function destroy(GoalCategory $category): RedirectResponse
    {
        if ($category->goals()->exists()) {
            return $this->toast('error', __('Categories with goals cannot be deleted.'));
        }

        $category->delete();

        return $this->done(__('Category deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?GoalCategory $category = null): array
    {
        return $request->validate([
            'category_name' => ['required', 'string', 'max:255'],
            'category_code' => ['required', 'string', 'max:30', Rule::unique('goal_categories')->ignore($category)],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['boolean'],
        ]);
    }
}
