<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\AccountType;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AccountTypeController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('account/account-types/index', [
            'accountTypes' => AccountType::query()->withCount('accounts')->orderBy('id')->get(),
            'categories' => array_keys(AccountType::CATEGORIES),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        AccountType::create($this->validated($request));

        return $this->done(__('Account type created successfully.'));
    }

    public function update(Request $request, AccountType $accountType): RedirectResponse
    {
        $accountType->update($this->validated($request, $accountType));

        return $this->done(__('Account type updated successfully.'));
    }

    public function destroy(AccountType $accountType): RedirectResponse
    {
        if ($accountType->is_system_type || $accountType->accounts()->exists()) {
            return $this->toast('error', __('System account types and types in use cannot be deleted.'));
        }

        $accountType->delete();

        return $this->done(__('Account type deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?AccountType $accountType = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:20', Rule::unique('account_types')->ignore($accountType)],
            'category' => ['required', Rule::in(array_keys(AccountType::CATEGORIES))],
            'normal_balance' => ['required', Rule::in(AccountType::BALANCES)],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['boolean'],
        ]);
    }
}
