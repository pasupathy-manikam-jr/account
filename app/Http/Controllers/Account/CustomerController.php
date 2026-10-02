<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\User;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Customer::query()->visibleTo($request->user())->with('user:id,name,email');

        return Inertia::render('account/customers/index', [
            'customers' => TableQuery::paginate(
                $query,
                $request,
                ['customer_code', 'company_name', 'contact_person_name', 'contact_person_email', 'tax_number'],
                ['customer_code', 'company_name', 'contact_person_name', 'contact_person_email'],
                'customer_code',
                'asc',
            ),
            'filters' => TableQuery::filters($request),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('account/customers/create', [
            'users' => $this->availableUsers(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $customer = new Customer($this->validated($request));
        $customer->created_by = $request->user()->id;
        $customer->save();

        return $this->backToIndex(__('Customer created successfully.'));
    }

    public function edit(Request $request, Customer $customer): Response
    {
        $this->authorizeVisible($request, $customer);

        return Inertia::render('account/customers/edit', [
            'customer' => $customer,
            'users' => $this->availableUsers($customer),
        ]);
    }

    public function update(Request $request, Customer $customer): RedirectResponse
    {
        $this->authorizeVisible($request, $customer);
        $customer->update($this->validated($request, $customer));

        return $this->backToIndex(__('Customer updated successfully.'));
    }

    public function destroy(Request $request, Customer $customer): RedirectResponse
    {
        $this->authorizeVisible($request, $customer);
        $customer->delete();

        return $this->done(__('Customer deleted successfully.'));
    }

    /**
     * Create and edit are full pages, so they return to the list rather than back().
     */
    private function backToIndex(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return to_route('account.customers.index');
    }

    private function authorizeVisible(Request $request, Customer $customer): void
    {
        abort_unless(Customer::query()->visibleTo($request->user())->whereKey($customer->id)->exists(), 404);
    }

    /**
     * Client users without a customer record (plus the one already linked when editing).
     *
     * @return Collection<int, User>
     */
    private function availableUsers(?Customer $current = null): Collection
    {
        return User::query()
            ->where('type', 'client')
            ->where(fn ($q) => $q->whereNotIn('id', Customer::query()->select('user_id'))->when($current, fn ($q) => $q->orWhere('id', $current->user_id)))
            ->orderBy('name')
            ->get(['id', 'name', 'email']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Customer $customer = null): array
    {
        $sameAsBilling = $request->boolean('same_as_billing');

        $data = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where('type', 'client'), Rule::unique('customers')->ignore($customer)],
            'company_name' => ['required', 'string', 'max:255'],
            'contact_person_name' => ['required', 'string', 'max:255'],
            'contact_person_email' => ['required', 'email', 'max:255'],
            'contact_person_mobile' => ['nullable', 'string', 'regex:/^\+[0-9]{7,15}$/'],
            'tax_number' => ['nullable', 'string', 'max:50'],
            'id_type' => ['nullable', 'required_with:id_number', Rule::in(['BRN', 'NRIC', 'PASSPORT', 'ARMY'])],
            'id_number' => ['nullable', 'required_with:id_type', 'string', 'max:30'],
            'payment_terms' => ['nullable', 'string', 'max:50'],
            ...$this->addressRules('billing_address', true),
            ...$this->addressRules('shipping_address', ! $sameAsBilling),
            'same_as_billing' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], [
            'contact_person_mobile.regex' => __('Use the format +[country code][phone number], e.g. +60123456789.'),
        ]);

        $data['same_as_billing'] = $sameAsBilling;
        $data['shipping_address'] = $sameAsBilling ? null : $data['shipping_address'];

        return $data;
    }

    /**
     * @return array<string, list<string>>
     */
    private function addressRules(string $key, bool $required): array
    {
        if (! $required) {
            return [$key => ['nullable', 'array']];
        }

        return [
            $key => ['required', 'array'],
            "{$key}.name" => ['nullable', 'string', 'max:255'],
            "{$key}.address_line_1" => ['required', 'string', 'max:255'],
            "{$key}.address_line_2" => ['nullable', 'string', 'max:255'],
            "{$key}.city" => ['required', 'string', 'max:100'],
            "{$key}.state" => ['nullable', 'string', 'max:100'],
            "{$key}.country" => ['required', 'string', 'max:100'],
            "{$key}.zip_code" => ['nullable', 'string', 'max:20'],
        ];
    }
}
