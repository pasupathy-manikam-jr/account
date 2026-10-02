<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\SalesInvoice;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Settings;
use App\Support\TableQuery;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\Response;

class SalesInvoiceController extends Controller
{
    public function index(Request $request): InertiaResponse
    {
        $query = SalesInvoice::query()
            ->visibleTo($request->user())
            ->with('customer:id,name,email')
            ->when($request->filled('customer_id'), fn (Builder $q) => $q->where('customer_id', $request->integer('customer_id')))
            ->when($request->filled('warehouse_id'), fn (Builder $q) => $q->where('warehouse_id', $request->integer('warehouse_id')))
            ->when(in_array($request->input('status'), SalesInvoice::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')))
            ->when(in_array($request->input('type'), SalesInvoice::TYPES, true), fn (Builder $q) => $q->where('type', $request->input('type')))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('invoice_number', 'like', "%{$search}%")
                ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"))));

        return Inertia::render('sales-invoices/index', [
            'invoices' => TableQuery::paginate($query, $request, [], ['invoice_number', 'invoice_date', 'due_date', 'subtotal', 'tax_amount', 'total_amount'], 'invoice_date'),
            'customers' => self::customers(),
            'warehouses' => Warehouse::query()->orderBy('name')->get(['id', 'name']),
            'filters' => TableQuery::filters($request, ['customer_id', 'warehouse_id', 'status', 'type']),
        ]);
    }

    public function create(): InertiaResponse
    {
        return Inertia::render('sales-invoices/form', [...self::formOptions(), 'invoice' => null]);
    }

    public function store(Request $request): RedirectResponse
    {
        $invoice = DB::transaction(function () use ($request) {
            $invoice = new SalesInvoice;
            $invoice->forceFill(['created_by' => $request->user()->id]);
            $this->save($invoice, $request);

            return $invoice;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invoice created successfully.')]);

        return to_route('sales-invoices.show', $invoice);
    }

    public function show(Request $request, SalesInvoice $salesInvoice): InertiaResponse
    {
        abort_unless($salesInvoice->isVisibleTo($request->user()), 404);

        return Inertia::render('sales-invoices/show', [
            'invoice' => $salesInvoice->load([
                'customer:id,name,email',
                'customer.customer:id,user_id,company_name,contact_person_mobile,billing_address,shipping_address',
                'warehouse:id,name',
                'items.item:id,name,sku,description',
            ]),
            'company' => ['name' => Settings::company()],
        ]);
    }

    public function edit(SalesInvoice $salesInvoice): InertiaResponse|RedirectResponse
    {
        if ($salesInvoice->status !== 'draft') {
            return $this->toast('error', __('Only draft invoices can be edited.'));
        }

        return Inertia::render('sales-invoices/form', [...self::formOptions(), 'invoice' => $salesInvoice->load('items')]);
    }

    public function update(Request $request, SalesInvoice $salesInvoice): RedirectResponse
    {
        if ($salesInvoice->status !== 'draft') {
            return $this->toast('error', __('Only draft invoices can be edited.'));
        }

        DB::transaction(fn () => $this->save($salesInvoice, $request));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invoice updated successfully.')]);

        return to_route('sales-invoices.show', $salesInvoice);
    }

    public function destroy(SalesInvoice $salesInvoice): RedirectResponse
    {
        if ($salesInvoice->status !== 'draft') {
            return $this->toast('error', __('Only draft invoices can be deleted.'));
        }

        $salesInvoice->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invoice deleted successfully.')]);

        return to_route('sales-invoices.index');
    }

    /** Draft → posted: stock leaves the warehouse and the invoice reaches the ledger. */
    public function post(SalesInvoice $salesInvoice): RedirectResponse
    {
        $salesInvoice->post();

        return $this->done(__('Invoice posted to the ledger.'));
    }

    public function pdf(Request $request, SalesInvoice $salesInvoice): Response
    {
        abort_unless($salesInvoice->isVisibleTo($request->user()), 404);

        $salesInvoice->load(['customer:id,name,email', 'customer.customer', 'warehouse:id,name', 'items.item:id,name,sku']);

        return Pdf::loadView('pdf.document', [
            'doc' => $salesInvoice,
            'party' => $salesInvoice->customer,
            'partyRecord' => $salesInvoice->customer->customer,
            'title' => __('Sales Invoice'),
            'number' => $salesInvoice->invoice_number,
            'partyLabel' => __('Billed To'),
            'paid' => $salesInvoice->paid_amount,
            'facts' => array_filter([
                __('Invoice Date') => Settings::date($salesInvoice->invoice_date),
                __('Due Date') => Settings::date($salesInvoice->due_date),
                __('Payment Terms') => $salesInvoice->payment_terms ?: '-',
                __('Warehouse') => $salesInvoice->warehouse?->name,
            ]),
        ])
            ->download("{$salesInvoice->invoice_number}.pdf");
    }

    /**
     * Validate the header and lines, then save them; the model prices each line.
     */
    private function save(SalesInvoice $invoice, Request $request): void
    {
        $type = $request->input('type');

        $data = $request->validate([
            'type' => ['required', Rule::in(SalesInvoice::TYPES)],
            'invoice_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:invoice_date'],
            'customer_id' => ['required', Rule::exists('users', 'id')->where('type', 'client')],
            'warehouse_id' => $type === 'service'
                ? ['prohibited']
                : ['required', Rule::exists('warehouses', 'id')->where('is_active', true)],
            'payment_terms' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            // Product invoices sell stock (products and parts); service invoices sell services.
            'items.*.item_id' => ['required', 'distinct', Rule::exists('items', 'id')->where('is_active', true)
                ->where(fn ($q) => $type === 'service' ? $q->where('type', 'service') : $q->whereNot('type', 'service'))],
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

        $invoice->saveWithLines([...$data, 'warehouse_id' => $data['warehouse_id'] ?? null], $items);
    }

    /**
     * @return array<string, mixed>
     */
    public static function formOptions(): array
    {
        return [
            'customers' => self::customers(),
            'warehouses' => Warehouse::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'items' => Item::query()->where('is_active', true)->with('taxes:id,tax_name,rate')->orderBy('name')
                ->get(['id', 'name', 'sku', 'type', 'sale_price']),
        ];
    }

    /**
     * Client logins with their company name and default payment terms.
     *
     * @return Collection<int, array{id: int, name: string, email: string, company_name: string|null, payment_terms: string|null}>
     */
    public static function customers(): Collection
    {
        return User::query()->where('type', 'client')->with('customer:id,user_id,company_name,payment_terms')->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'company_name' => $u->customer?->company_name,
                'payment_terms' => $u->customer?->payment_terms,
            ]);
    }
}
