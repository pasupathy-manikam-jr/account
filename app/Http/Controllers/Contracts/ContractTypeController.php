<?php

namespace App\Http\Controllers\Contracts;

use App\Http\Controllers\Controller;
use App\Models\ContractType;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ContractTypeController extends Controller
{
    public function index(Request $request): Response
    {
        $query = ContractType::query()
            // The contracts column lists each one's number, as the demo does.
            ->with(['contracts' => fn ($q) => $q->orderBy('contract_number')->select(['id', 'type_id', 'contract_number'])])
            ->withCount('contracts')
            ->when($request->filled('status'), fn (Builder $q) => $q->where('is_active', $request->input('status') === 'active'))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('name', 'like', "%{$search}%")
                ->orWhereHas('contracts', fn (Builder $c) => $c->where('contract_number', 'like', "%{$search}%"))));

        return Inertia::render('contract-types/index', [
            'contractTypes' => TableQuery::paginate($query, $request, [], ['name', 'contracts_count'], 'name', 'asc'),
            'filters' => TableQuery::filters($request, ['status']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        ContractType::create($this->validated($request));

        return $this->done(__('Contract type created successfully.'));
    }

    public function update(Request $request, ContractType $contractType): RedirectResponse
    {
        $contractType->update($this->validated($request, $contractType));

        return $this->done(__('Contract type updated successfully.'));
    }

    public function destroy(ContractType $contractType): RedirectResponse
    {
        if ($contractType->contracts()->exists()) {
            return $this->toast('error', __('Contract types used by contracts cannot be deleted.'));
        }

        $contractType->delete();

        return $this->done(__('Contract type deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?ContractType $type = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('contract_types')->ignore($type)],
            'is_active' => ['boolean'],
        ]);
    }
}
