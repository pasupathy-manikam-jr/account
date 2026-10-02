<?php

namespace App\Http\Controllers\Contracts;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\ContractSignature;
use App\Models\ContractType;
use App\Models\User;
use App\Support\Settings;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ContractController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Contract::query()
            ->visibleTo($request->user())
            ->with(['user:id,name,email', 'contractType:id,name'])
            ->when($request->filled('type_id'), fn (Builder $q) => $q->where('type_id', $request->integer('type_id')))
            ->when($request->filled('user_id'), fn (Builder $q) => $q->where('user_id', $request->integer('user_id')));

        TableQuery::search($query, $request, ['subject', 'contract_number']);
        $counts = TableQuery::countBy($query, 'status');
        $query->when(in_array($request->input('status'), Contract::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')));

        return Inertia::render('contracts/index', [
            'contracts' => TableQuery::paginate($query, $request, [], ['contract_number', 'subject', 'value', 'start_date', 'end_date'], 'contract_number'),
            'counts' => ['all' => $counts->sum(), ...collect(Contract::STATUSES)->mapWithKeys(fn ($s) => [$s => $counts[$s] ?? 0])],
            'users' => $this->parties(),
            'contractTypes' => ContractType::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'filters' => TableQuery::filters($request, ['status', 'type_id', 'user_id']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        DB::transaction(function () use ($request) {
            $contract = new Contract($this->validated($request));
            $contract->forceFill(['created_by' => $request->user()->id])->save();
            $contract->forceFill(['contract_number' => sprintf('CON%04d', $contract->id)])->save();
        });

        return $this->done(__('Contract created successfully.'));
    }

    public function show(Request $request, Contract $contract): Response
    {
        abort_unless($contract->isVisibleTo($request->user()), 404);

        return Inertia::render('contracts/show', [
            'contract' => $contract->load([
                'user:id,name,email',
                'contractType:id,name',
                'attachments' => fn ($q) => $q->latest()->with('uploader:id,name'),
                'comments' => fn ($q) => $q->latest()->with('user:id,name,email'),
                'notes' => fn ($q) => $q->latest()->with('user:id,name,email'),
                'renewals' => fn ($q) => $q->latest('start_date'),
                'signatures' => fn ($q) => $q->oldest('signed_at'),
            ]),
            'users' => $this->parties(),
            'contractTypes' => ContractType::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'hasSigned' => $contract->signatures()->where('user_id', $request->user()->id)->exists(),
        ]);
    }

    /** The contract laid out as a document, to read and print. */
    public function preview(Request $request, Contract $contract): Response
    {
        abort_unless($contract->isVisibleTo($request->user()), 404);

        return Inertia::render('contracts/preview', [
            'contract' => $contract->load(['user:id,name,email', 'contractType:id,name', 'signatures' => fn ($q) => $q->oldest('signed_at')]),
            'company' => Settings::company(),
        ]);
    }

    public function update(Request $request, Contract $contract): RedirectResponse
    {
        abort_unless($contract->isVisibleTo($request->user()), 404);
        $contract->update($this->validated($request));

        return $this->done(__('Contract updated successfully.'));
    }

    public function destroy(Request $request, Contract $contract): RedirectResponse
    {
        abort_unless($contract->isVisibleTo($request->user()), 404);
        // The rows cascade with the contract; the uploaded files have to be removed by hand.
        Storage::disk('public')->delete($contract->attachments()->pluck('file_path')->all());
        $contract->delete();

        return $this->done(__('Contract deleted successfully.'));
    }

    /** A pending copy with the same terms, for a similar engagement. */
    public function duplicate(Request $request, Contract $contract): RedirectResponse
    {
        abort_unless($contract->isVisibleTo($request->user()), 404);

        DB::transaction(function () use ($contract, $request) {
            $copy = $contract->replicate(['contract_number', 'status', 'created_by']);
            $copy->forceFill(['status' => 'pending', 'created_by' => $request->user()->id])->save();
            $copy->forceFill(['contract_number' => sprintf('CON%04d', $copy->id)])->save();
        });

        return $this->done(__('Contract duplicated successfully.'));
    }

    public function status(Request $request, Contract $contract): RedirectResponse
    {
        abort_unless($contract->isVisibleTo($request->user()), 404);
        $contract->update($request->validate(['status' => ['required', Rule::in(Contract::STATUSES)]]));

        return $this->done(__('Contract status updated.'));
    }

    /** Sign with a typed name; each user signs a contract once. */
    public function sign(Request $request, Contract $contract): RedirectResponse
    {
        abort_unless($contract->isVisibleTo($request->user()), 404);

        $data = $request->validate(['signer_name' => ['required', 'string', 'max:100']]);

        if ($contract->signatures()->where('user_id', $request->user()->id)->exists()) {
            return $this->toast('error', __('You have already signed this contract.'));
        }

        $contract->signatures()->create([
            'user_id' => $request->user()->id,
            'signer_name' => $data['signer_name'],
            'signature_data' => ContractSignature::render($data['signer_name']),
            'signed_at' => now(),
        ]);

        return $this->done(__('Contract signed successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'user_id' => ['required', Rule::exists('users', 'id')->whereNot('type', 'company')],
            'type_id' => ['required', Rule::exists('contract_types', 'id')->where('is_active', true)],
            'value' => ['required', 'numeric', 'min:0', 'max:9999999999999.99', 'decimal:0,2'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'status' => ['required', Rule::in(Contract::STATUSES)],
            'description' => ['nullable', 'string', 'max:10000'],
        ]);
    }

    /**
     * Who a contract can be with: clients, vendors and staff.
     *
     * @return Collection<int, User>
     */
    private function parties(): Collection
    {
        return User::query()->where('type', '!=', 'company')->orderBy('name')->get(['id', 'name', 'email', 'type']);
    }
}
