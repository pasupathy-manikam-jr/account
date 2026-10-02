<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\SalesInvoice;
use App\Models\SalesProposal;
use App\Models\SalesProposalItem;
use App\Models\Warehouse;
use App\Support\Settings;
use App\Support\TableQuery;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\Response;

class SalesProposalController extends Controller
{
    public function index(Request $request): InertiaResponse
    {
        $query = SalesProposal::query()
            ->visibleTo($request->user())
            // The converted invoice's amounts give the proposal's balance.
            ->with(['customer:id,name,email', 'invoice:id,total_amount,paid_amount'])
            ->when($request->filled('customer_id'), fn (Builder $q) => $q->where('customer_id', $request->integer('customer_id')))
            ->when(in_array($request->input('status'), SalesProposal::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('proposal_number', 'like', "%{$search}%")
                ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"))));

        return Inertia::render('sales-proposals/index', [
            'proposals' => TableQuery::paginate($query, $request, [], ['proposal_number', 'proposal_date', 'due_date', 'subtotal', 'tax_amount', 'total_amount'], 'proposal_date'),
            'customers' => SalesInvoiceController::customers(),
            'filters' => TableQuery::filters($request, ['customer_id', 'status']),
        ]);
    }

    public function create(): InertiaResponse
    {
        return Inertia::render('sales-proposals/form', [...$this->formOptions(), 'proposal' => null]);
    }

    public function store(Request $request): RedirectResponse
    {
        $proposal = DB::transaction(function () use ($request) {
            $proposal = new SalesProposal;
            $proposal->forceFill(['created_by' => $request->user()->id]);
            $this->save($proposal, $request);

            return $proposal;
        });

        $this->flash(__('Proposal created successfully.'));

        return to_route('sales-proposals.show', $proposal);
    }

    public function show(Request $request, SalesProposal $salesProposal): InertiaResponse
    {
        abort_unless($salesProposal->isVisibleTo($request->user()), 404);

        return Inertia::render('sales-proposals/show', [
            'proposal' => $salesProposal->load([
                'customer:id,name,email',
                'customer.customer:id,user_id,company_name,contact_person_mobile,billing_address',
                'warehouse:id,name',
                'items.item:id,name,sku,description',
            ]),
        ]);
    }

    public function edit(SalesProposal $salesProposal): InertiaResponse|RedirectResponse
    {
        if ($salesProposal->status !== 'draft') {
            return $this->toast('error', __('Only draft proposals can be edited.'));
        }

        return Inertia::render('sales-proposals/form', [...$this->formOptions(), 'proposal' => $salesProposal->load('items')]);
    }

    public function update(Request $request, SalesProposal $salesProposal): RedirectResponse
    {
        if ($salesProposal->status !== 'draft') {
            return $this->toast('error', __('Only draft proposals can be edited.'));
        }

        DB::transaction(fn () => $this->save($salesProposal, $request));

        $this->flash(__('Proposal updated successfully.'));

        return to_route('sales-proposals.show', $salesProposal);
    }

    public function destroy(SalesProposal $salesProposal): RedirectResponse
    {
        if ($salesProposal->status !== 'draft') {
            return $this->toast('error', __('Only draft proposals can be deleted.'));
        }

        $salesProposal->delete();

        $this->flash(__('Proposal deleted successfully.'));

        return to_route('sales-proposals.index');
    }

    /** Draft → sent. */
    public function send(SalesProposal $salesProposal): RedirectResponse
    {
        return $this->move($salesProposal, 'draft', 'sent', __('Proposal marked as sent.'));
    }

    /** Sent → accepted, by the company or by the client it was sent to. */
    public function accept(Request $request, SalesProposal $salesProposal): RedirectResponse
    {
        abort_unless($salesProposal->isVisibleTo($request->user()), 404);

        return $this->move($salesProposal, 'sent', 'accepted', __('Proposal accepted.'));
    }

    /** Sent → rejected, by the company or by the client it was sent to. */
    public function reject(Request $request, SalesProposal $salesProposal): RedirectResponse
    {
        abort_unless($salesProposal->isVisibleTo($request->user()), 404);

        return $this->move($salesProposal, 'sent', 'rejected', __('Proposal rejected.'));
    }

    /**
     * Accepted → a draft product invoice with the same lines, linked back to this proposal (once only).
     */
    public function convert(SalesProposal $salesProposal): RedirectResponse
    {
        if ($salesProposal->status !== 'accepted' || $salesProposal->invoice_id !== null) {
            return $this->toast('error', __('Only accepted proposals that are not yet invoiced can be converted.'));
        }

        $invoice = DB::transaction(function () use ($salesProposal) {
            $invoice = new SalesInvoice;
            $invoice->forceFill(['created_by' => auth()->id()]);
            $invoice->saveWithLines([
                'type' => 'product',
                'invoice_date' => today()->format('Y-m-d'),
                'due_date' => today()->addDays(max(0, $salesProposal->proposal_date->diffInDays($salesProposal->due_date)))->format('Y-m-d'),
                'customer_id' => $salesProposal->customer_id,
                'warehouse_id' => $salesProposal->warehouse_id,
                'payment_terms' => $salesProposal->payment_terms,
                'notes' => $salesProposal->notes,
            ], array_values($salesProposal->items->map(fn (SalesProposalItem $line) => [
                'item_id' => $line->item_id,
                'quantity' => $line->quantity,
                'unit_price' => $line->unit_price,
                'discount_percentage' => $line->discount_percentage,
            ])->all()));
            $salesProposal->forceFill(['invoice_id' => $invoice->id])->save();

            return $invoice;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Proposal converted to invoice :number.', ['number' => $invoice->invoice_number])]);

        return to_route('sales-invoices.show', $invoice);
    }

    public function pdf(Request $request, SalesProposal $salesProposal): Response
    {
        abort_unless($salesProposal->isVisibleTo($request->user()), 404);

        $salesProposal->load(['customer:id,name,email', 'customer.customer', 'warehouse:id,name', 'items.item:id,name,sku']);

        return Pdf::loadView('pdf.document', [
            'doc' => $salesProposal,
            'party' => $salesProposal->customer,
            'partyRecord' => $salesProposal->customer->customer,
            'title' => __('Sales Proposal'),
            'number' => $salesProposal->proposal_number,
            'partyLabel' => __('Proposal For'),
            'facts' => [
                __('Proposal Date') => Settings::date($salesProposal->proposal_date),
                __('Due Date') => Settings::date($salesProposal->due_date),
                __('Payment Terms') => $salesProposal->payment_terms ?: '-',
                __('Warehouse') => $salesProposal->warehouse->name,
            ],
        ])
            ->download("{$salesProposal->proposal_number}.pdf");
    }

    private function move(SalesProposal $proposal, string $from, string $to, string $message): RedirectResponse
    {
        if ($proposal->status !== $from) {
            return $this->toast('error', __('This proposal is :status and cannot be changed that way.', ['status' => __($proposal->status)]));
        }

        $proposal->forceFill(['status' => $to])->save();

        return $this->done($message);
    }

    private function flash(string $message): void
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);
    }

    /**
     * Validate the header and lines, then save them; the model prices each line.
     */
    private function save(SalesProposal $proposal, Request $request): void
    {
        $data = $request->validate([
            'proposal_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:proposal_date'],
            'customer_id' => ['required', Rule::exists('users', 'id')->where('type', 'client')],
            'warehouse_id' => ['required', Rule::exists('warehouses', 'id')->where('is_active', true)],
            'payment_terms' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            // Proposals quote stock from a warehouse and convert to product invoices, so no service items.
            'items.*.item_id' => ['required', 'distinct', Rule::exists('items', 'id')->where('is_active', true)->whereNot('type', 'service')],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:9999999', 'decimal:0,2'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0', 'max:9999999999.99', 'decimal:0,2'],
            'items.*.discount_percentage' => ['nullable', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
        ], [], [
            'items.*.item_id' => __('product'),
            'items.*.quantity' => __('quantity'),
            'items.*.unit_price' => __('unit price'),
            'items.*.discount_percentage' => __('discount'),
        ]);

        $items = $data['items'];
        unset($data['items']);

        $proposal->saveWithLines($data, $items);
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'customers' => SalesInvoiceController::customers(),
            'warehouses' => Warehouse::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'items' => Item::query()->where('is_active', true)->where('type', '!=', 'service')->with('taxes:id,tax_name,rate')->orderBy('name')
                ->get(['id', 'name', 'sku', 'type', 'sale_price']),
        ];
    }
}
