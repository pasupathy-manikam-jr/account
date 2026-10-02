<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Purchase\PurchaseInvoiceController;
use App\Models\DebitNote;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DebitNoteController extends Controller
{
    public function index(Request $request): Response
    {
        $query = DebitNote::query()
            ->visibleTo($request->user())
            ->with(['vendor:id,name,email', 'invoice:id,invoice_number', 'purchaseReturn:id,return_number', 'approver:id,name'])
            ->when($request->filled('vendor_id'), fn (Builder $q) => $q->where('vendor_id', $request->integer('vendor_id')))
            ->when($request->filled('return_id'), fn (Builder $q) => $q->where('return_id', $request->integer('return_id')))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('debit_note_number', 'like', "%{$search}%")
                ->orWhereHas('vendor', fn (Builder $c) => $c->where('name', 'like', "%{$search}%"))));

        TableQuery::month($query, $request, 'debit_note_date');
        $counts = TableQuery::countBy($query, 'status');
        $query->when(in_array($request->input('status'), DebitNote::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')));

        return Inertia::render('account/debit-notes/index', [
            'debitNotes' => TableQuery::paginate($query, $request, [], ['debit_note_number', 'debit_note_date', 'total_amount'], 'debit_note_date'),
            'counts' => ['all' => $counts->sum(), ...collect(DebitNote::STATUSES)->mapWithKeys(fn ($s) => [$s => $counts[$s] ?? 0])],
            'vendors' => PurchaseInvoiceController::vendors(),
            'returns' => DebitNote::query()->visibleTo($request->user())->whereNotNull('return_id')->with('purchaseReturn:id,return_number')->get(['id', 'return_id'])
                ->map(fn (DebitNote $note) => ['id' => $note->return_id, 'name' => $note->purchaseReturn?->return_number])->unique('id')->sortBy('name')->values(),
            'filters' => TableQuery::filters($request, ['status', 'vendor_id', 'return_id', 'month']),
        ]);
    }

    public function show(Request $request, DebitNote $debitNote): Response
    {
        abort_unless($debitNote->isVisibleTo($request->user()), 404);

        return Inertia::render('account/debit-notes/show', [
            'debitNote' => $debitNote->load([
                'vendor:id,name,email',
                'invoice:id,invoice_number',
                'purchaseReturn:id,return_number',
                'approver:id,name',
                'items.item:id,name,sku,description',
            ]),
        ]);
    }

    public function approve(Request $request, DebitNote $debitNote): RedirectResponse
    {
        $debitNote->approve($request->user());

        return $this->done(__('Debit note approved and posted to the ledger.'));
    }

    public function destroy(DebitNote $debitNote): RedirectResponse
    {
        if ($debitNote->status !== 'draft') {
            return $this->toast('error', __('Only draft debit notes can be deleted.'));
        }

        $debitNote->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Debit note deleted successfully.')]);

        return to_route('account.debit-notes.index');
    }
}
