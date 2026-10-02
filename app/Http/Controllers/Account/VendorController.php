<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Vendor;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class VendorController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Vendor::query()->visibleTo($request->user())->with('user:id,name,email');

        return Inertia::render('account/vendors/index', [
            'vendors' => TableQuery::paginate(
                $query,
                $request,
                ['vendor_code', 'company_name', 'contact_person_name', 'contact_person_email', 'tax_number'],
                ['vendor_code', 'company_name', 'contact_person_name', 'contact_person_email'],
                'vendor_code',
                'asc',
            ),
            'filters' => TableQuery::filters($request),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('account/vendors/create', [
            'users' => $this->availableUsers(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $vendor = new Vendor($this->validated($request));
        $vendor->created_by = $request->user()->id;
        $vendor->save();

        return $this->backToIndex(__('Vendor created successfully.'));
    }

    public function edit(Request $request, Vendor $vendor): Response
    {
        $this->authorizeVisible($request, $vendor);

        return Inertia::render('account/vendors/edit', [
            'vendor' => $vendor,
            'users' => $this->availableUsers($vendor),
        ]);
    }

    public function update(Request $request, Vendor $vendor): RedirectResponse
    {
        $this->authorizeVisible($request, $vendor);
        $vendor->update($this->validated($request, $vendor));

        return $this->backToIndex(__('Vendor updated successfully.'));
    }

    public function destroy(Request $request, Vendor $vendor): RedirectResponse
    {
        $this->authorizeVisible($request, $vendor);
        $vendor->delete();

        return $this->done(__('Vendor deleted successfully.'));
    }

    /**
     * Create and edit are full pages, so they return to the list rather than back().
     */
    private function backToIndex(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return to_route('account.vendors.index');
    }

    private function authorizeVisible(Request $request, Vendor $vendor): void
    {
        abort_unless(Vendor::query()->visibleTo($request->user())->whereKey($vendor->id)->exists(), 404);
    }

    /**
     * Vendor users without a vendor record (plus the one already linked when editing).
     *
     * @return Collection<int, User>
     */
    private function availableUsers(?Vendor $current = null): Collection
    {
        return User::query()
            ->where('type', 'vendor')
            ->where(fn ($q) => $q->whereNotIn('id', Vendor::query()->select('user_id'))->when($current, fn ($q) => $q->orWhere('id', $current->user_id)))
            ->orderBy('name')
            ->get(['id', 'name', 'email']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Vendor $vendor = null): array
    {
        $sameAsBilling = $request->boolean('same_as_billing');

        $data = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')->where('type', 'vendor'), Rule::unique('vendors')->ignore($vendor)],
            'company_name' => ['required', 'string', 'max:255'],
            'contact_person_name' => ['required', 'string', 'max:255'],
            'contact_person_email' => ['required', 'email', 'max:255'],
            'contact_person_mobile' => ['nullable', 'string', 'regex:/^\+[0-9]{7,15}$/'],
            'tax_number' => ['nullable', 'string', 'max:50'],
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
