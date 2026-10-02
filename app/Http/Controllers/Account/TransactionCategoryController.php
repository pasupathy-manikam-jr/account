<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\ChartOfAccount;
use App\Models\TransactionCategory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Revenue and expense categories (System Setup tabs). The route fixes the kind.
 */
class TransactionCategoryController extends Controller
{
    public function index(Request $request): Response
    {
        $kind = $this->kind($request);

        return Inertia::render('account/transaction-categories/index', [
            'kind' => $kind,
            'categories' => TransactionCategory::query()->where('kind', $kind)->withCount('entries')
                ->with('glAccount:id,account_code,account_name')->orderBy('category_code')->get(),
            'glAccounts' => self::glAccounts($kind),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $kind = $this->kind($request);
        $category = new TransactionCategory($this->validated($request, $kind));
        $category->forceFill(['kind' => $kind])->save();

        return $this->done(__('Category created successfully.'));
    }

    public function update(Request $request, TransactionCategory $category): RedirectResponse
    {
        abort_unless($category->kind === $this->kind($request), 404);
        $category->update($this->validated($request, $category->kind, $category));

        return $this->done(__('Category updated successfully.'));
    }

    public function destroy(Request $request, TransactionCategory $category): RedirectResponse
    {
        abort_unless($category->kind === $this->kind($request), 404);

        if ($category->entries()->exists()) {
            return $this->toast('error', __('Categories with entries cannot be deleted.'));
        }

        $category->delete();

        return $this->done(__('Category deleted successfully.'));
    }

    /**
     * Active ledger accounts a category of this kind can post to (revenue or expense accounts).
     *
     * @return Collection<int, ChartOfAccount>
     */
    public static function glAccounts(string $kind)
    {
        return ChartOfAccount::query()->where('is_active', true)
            ->whereHas('accountType', fn ($q) => $q->where('category', TransactionCategory::ACCOUNT_CATEGORY[$kind]))
            ->orderBy('account_code')->get(['id', 'account_code', 'account_name']);
    }

    private function kind(Request $request): string
    {
        return (string) $request->route()?->defaults['kind'];
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, string $kind, ?TransactionCategory $category = null): array
    {
        return $request->validate([
            'category_name' => ['required', 'string', 'max:255'],
            'category_code' => ['required', 'string', 'max:30', Rule::unique('transaction_categories')->where('kind', $kind)->ignore($category)],
            'gl_account_id' => ['required', Rule::in(self::glAccounts($kind)->pluck('id')->all())],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['boolean'],
        ], [
            'gl_account_id.in' => $kind === 'revenue' ? __('Choose an active revenue account.') : __('Choose an active expense account.'),
        ]);
    }
}
