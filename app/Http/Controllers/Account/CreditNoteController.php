<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Http\Controllers\EInvoiceController;
use App\Http\Controllers\Sales\SalesInvoiceController;
use App\Models\CreditNote;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CreditNoteController extends Controller
{
    public function index(Request $request): Response
    {
        $query = CreditNote::query()
            ->visibleTo($request->user())
            ->with(['customer:id,name,email', 'invoice:id,invoice_number', 'salesReturn:id,return_number', 'approver:id,name'])
            ->when($request->filled('customer_id'), fn (Builder $q) => $q->where('customer_id', $request->integer('customer_id')))
            ->when($request->filled('return_id'), fn (Builder $q) => $q->where('return_id', $request->integer('return_id')))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('credit_note_number', 'like', "%{$search}%")
                ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'like', "%{$search}%"))));

        TableQuery::month($query, $request, 'credit_note_date');
        $counts = TableQuery::countBy($query, 'status');
        $query->when(in_array($request->input('status'), CreditNote::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')));

        return Inertia::render('account/credit-notes/index', [
            'creditNotes' => TableQuery::paginate($query, $request, [], ['credit_note_number', 'credit_note_date', 'total_amount'], 'credit_note_date'),
            'counts' => ['all' => $counts->sum(), ...collect(CreditNote::STATUSES)->mapWithKeys(fn ($s) => [$s => $counts[$s] ?? 0])],
            'customers' => SalesInvoiceController::customers(),
            'returns' => CreditNote::query()->visibleTo($request->user())->whereNotNull('return_id')->with('salesReturn:id,return_number')->get(['id', 'return_id'])
                ->map(fn (CreditNote $note) => ['id' => $note->return_id, 'name' => $note->salesReturn?->return_number])->unique('id')->sortBy('name')->values(),
            'filters' => TableQuery::filters($request, ['status', 'customer_id', 'return_id', 'month']),
        ]);
    }

    public function show(Request $request, CreditNote $creditNote): Response
    {
        abort_unless($creditNote->isVisibleTo($request->user()), 404);

        return Inertia::render('account/credit-notes/show', [
            'creditNote' => $creditNote->load([
                'customer:id,name,email',
                'invoice:id,invoice_number',
                'salesReturn:id,return_number',
                'approver:id,name',
                'items.item:id,name,sku,description',
            ]),
            'einvoice' => EInvoiceController::summary($creditNote),
        ]);
    }

    public function approve(Request $request, CreditNote $creditNote): RedirectResponse
    {
        $creditNote->approve($request->user());

        return $this->done(__('Credit note approved and posted to the ledger.'));
    }

    public function destroy(CreditNote $creditNote): RedirectResponse
    {
        if ($creditNote->status !== 'draft') {
            return $this->toast('error', __('Only draft credit notes can be deleted.'));
        }

        $creditNote->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Credit note deleted successfully.')]);

        return to_route('account.credit-notes.index');
    }
}
