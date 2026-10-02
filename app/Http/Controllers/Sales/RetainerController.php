<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Retainer;
use App\Models\RetainerItem;
use App\Models\SalesInvoice;
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

class RetainerController extends Controller
{
    public function index(Request $request): InertiaResponse
    {
        $query = Retainer::query()
            ->visibleTo($request->user())
            ->with('customer:id,name,email')
            ->when($request->filled('customer_id'), fn (Builder $q) => $q->where('customer_id', $request->integer('customer_id')))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('retainer_number', 'like', "%{$search}%")
                ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"))));

        // Status tabs, plus "converted": retainers already turned into an invoice, whatever their status.
        $counts = TableQuery::countBy($query, 'status');
        $converted = (clone $query)->whereNotNull('invoice_id')->count();
        $status = $request->input('status');
        $query->when($status === 'converted', fn (Builder $q) => $q->whereNotNull('invoice_id'))
            ->when(in_array($status, Retainer::STATUSES, true), fn (Builder $q) => $q->where('status', $status));

        return Inertia::render('retainers/index', [
            'retainers' => TableQuery::paginate($query, $request, [], ['retainer_number', 'retainer_date', 'due_date', 'subtotal', 'tax_amount', 'total_amount'], 'retainer_date'),
            'counts' => ['all' => $counts->sum(), ...collect(Retainer::STATUSES)->mapWithKeys(fn ($s) => [$s => $counts[$s] ?? 0]), 'converted' => $converted],
            'customers' => SalesInvoiceController::customers(),
            'filters' => TableQuery::filters($request, ['customer_id', 'status']),
        ]);
    }

    public function create(): InertiaResponse
    {
        return Inertia::render('retainers/form', [...$this->formOptions(), 'retainer' => null]);
    }

    public function store(Request $request): RedirectResponse
    {
        $retainer = DB::transaction(function () use ($request) {
            $retainer = new Retainer;
            $retainer->forceFill(['created_by' => $request->user()->id]);
            $this->save($retainer, $request);

            return $retainer;
        });

        $this->flash(__('Retainer created successfully.'));

        return to_route('retainers.show', $retainer);
    }

    public function show(Request $request, Retainer $retainer): InertiaResponse
    {
        abort_unless($retainer->isVisibleTo($request->user()), 404);

        return Inertia::render('retainers/show', [
            'retainer' => $retainer->load([
                'customer:id,name,email',
                'customer.customer:id,user_id,company_name,contact_person_mobile,billing_address',
                'warehouse:id,name',
                'items.item:id,name,sku,description',
            ]),
        ]);
    }

    public function edit(Retainer $retainer): InertiaResponse|RedirectResponse
    {
        if ($retainer->status !== 'draft') {
            return $this->toast('error', __('Only draft retainers can be edited.'));
        }

        return Inertia::render('retainers/form', [...$this->formOptions(), 'retainer' => $retainer->load('items')]);
    }

    public function update(Request $request, Retainer $retainer): RedirectResponse
    {
        if ($retainer->status !== 'draft') {
            return $this->toast('error', __('Only draft retainers can be edited.'));
        }

        DB::transaction(fn () => $this->save($retainer, $request));

        $this->flash(__('Retainer updated successfully.'));

        return to_route('retainers.show', $retainer);
    }

    public function destroy(Retainer $retainer): RedirectResponse
    {
        if ($retainer->status !== 'draft') {
            return $this->toast('error', __('Only draft retainers can be deleted.'));
        }

        $retainer->delete();

        $this->flash(__('Retainer deleted successfully.'));

        return to_route('retainers.index');
    }

    /** Draft → sent. */
    public function send(Retainer $retainer): RedirectResponse
    {
        return $this->move($retainer, 'draft', 'sent', __('Retainer marked as sent.'));
    }

    /** Sent → accepted, by the company or by the client it was sent to. */
    public function accept(Request $request, Retainer $retainer): RedirectResponse
    {
        abort_unless($retainer->isVisibleTo($request->user()), 404);

        return $this->move($retainer, 'sent', 'accepted', __('Retainer accepted.'));
    }

    /** Sent → rejected, by the company or by the client it was sent to. */
    public function reject(Request $request, Retainer $retainer): RedirectResponse
    {
        abort_unless($retainer->isVisibleTo($request->user()), 404);

        return $this->move($retainer, 'sent', 'rejected', __('Retainer rejected.'));
    }

    /**
     * Accepted (or part/fully paid) → a draft product invoice with the same lines. The invoice keeps the
     * retainer, so posting it applies the deposits already received. Once only.
     */
    public function convert(Retainer $retainer): RedirectResponse
    {
        if (! in_array($retainer->status, ['accepted', 'partial', 'paid'], true) || $retainer->invoice_id !== null) {
            return $this->toast('error', __('Only accepted retainers that are not yet invoiced can be converted.'));
        }

        $invoice = DB::transaction(function () use ($retainer) {
            $invoice = new SalesInvoice;
            $invoice->forceFill(['created_by' => auth()->id(), 'retainer_id' => $retainer->id]);
            $invoice->saveWithLines([
                'type' => 'product',
                'invoice_date' => today()->format('Y-m-d'),
                'due_date' => today()->addDays(max(0, $retainer->retainer_date->diffInDays($retainer->due_date)))->format('Y-m-d'),
                'customer_id' => $retainer->customer_id,
                'warehouse_id' => $retainer->warehouse_id,
                'payment_terms' => $retainer->payment_terms,
                'notes' => $retainer->notes,
            ], array_values($retainer->items->map(fn (RetainerItem $line) => [
                'item_id' => $line->item_id,
                'quantity' => $line->quantity,
                'unit_price' => $line->unit_price,
                'discount_percentage' => $line->discount_percentage,
            ])->all()));
            $retainer->forceFill(['invoice_id' => $invoice->id])->save();

            return $invoice;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Retainer converted to invoice :number.', ['number' => $invoice->invoice_number])]);

        return to_route('sales-invoices.show', $invoice);
    }

    /** A fresh draft copy, dated today, for a repeat engagement. */
    public function duplicate(Request $request, Retainer $retainer): RedirectResponse
    {
        $copy = DB::transaction(function () use ($retainer, $request) {
            $copy = new Retainer;
            $copy->forceFill(['created_by' => $request->user()->id]);
            $copy->saveWithLines([
                'retainer_date' => today()->format('Y-m-d'),
                'due_date' => today()->addDays(max(0, $retainer->retainer_date->diffInDays($retainer->due_date)))->format('Y-m-d'),
                'customer_id' => $retainer->customer_id,
                'warehouse_id' => $retainer->warehouse_id,
                'payment_terms' => $retainer->payment_terms,
                'notes' => $retainer->notes,
            ], array_values($retainer->items->map(fn (RetainerItem $line) => [
                'item_id' => $line->item_id,
                'quantity' => $line->quantity,
                'unit_price' => $line->unit_price,
                'discount_percentage' => $line->discount_percentage,
            ])->all()));

            return $copy;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Retainer duplicated as :number.', ['number' => $copy->retainer_number])]);

        return to_route('retainers.edit', $copy);
    }

    public function pdf(Request $request, Retainer $retainer): Response
    {
        abort_unless($retainer->isVisibleTo($request->user()), 404);

        $retainer->load(['customer:id,name,email', 'customer.customer', 'warehouse:id,name', 'items.item:id,name,sku']);

        return Pdf::loadView('pdf.document', [
            'doc' => $retainer,
            'party' => $retainer->customer,
            'partyRecord' => $retainer->customer->customer,
            'title' => __('Retainer'),
            'number' => $retainer->retainer_number,
            'partyLabel' => __('Retainer For'),
            'facts' => [
                __('Retainer Date') => Settings::date($retainer->retainer_date),
                __('Due Date') => Settings::date($retainer->due_date),
                __('Payment Terms') => $retainer->payment_terms ?: '-',
                __('Warehouse') => $retainer->warehouse->name,
            ],
        ])
            ->download("{$retainer->retainer_number}.pdf");
    }

    private function move(Retainer $model, string $from, string $to, string $message): RedirectResponse
    {
        if ($model->status !== $from) {
            return $this->toast('error', __('This retainer is :status and cannot be changed that way.', ['status' => __($model->status)]));
        }

        $model->forceFill(['status' => $to])->save();

        return $this->done($message);
    }

    private function flash(string $message): void
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);
    }

    /**
     * Validate the header and lines, then save them; the model prices each line.
     */
    private function save(Retainer $model, Request $request): void
    {
        $data = $request->validate([
            'retainer_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:retainer_date'],
            'customer_id' => ['required', Rule::exists('users', 'id')->where('type', 'client')],
            'warehouse_id' => ['required', Rule::exists('warehouses', 'id')->where('is_active', true)],
            'payment_terms' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            // Retainers quote stock from a warehouse and convert to product invoices, so no service items.
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

        $model->saveWithLines($data, $items);
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
