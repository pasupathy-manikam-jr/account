<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\PurchaseInvoice;
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

class PurchaseInvoiceController extends Controller
{
    public function index(Request $request): InertiaResponse
    {
        $dates = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', ...($request->filled('date_from') ? ['after_or_equal:date_from'] : [])],
        ]);

        $query = PurchaseInvoice::query()
            ->visibleTo($request->user())
            ->with(['vendor:id,name,email', 'warehouse:id,name'])
            ->when($request->filled('vendor_id'), fn (Builder $q) => $q->where('vendor_id', $request->integer('vendor_id')))
            ->when($request->filled('warehouse_id'), fn (Builder $q) => $q->where('warehouse_id', $request->integer('warehouse_id')))
            ->when($dates['date_from'] ?? null, fn (Builder $q, string $from) => $q->whereDate('invoice_date', '>=', $from))
            ->when($dates['date_to'] ?? null, fn (Builder $q, string $to) => $q->whereDate('invoice_date', '<=', $to))
            ->when(in_array($request->input('status'), PurchaseInvoice::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('invoice_number', 'like', "%{$search}%")
                ->orWhereHas('vendor', fn (Builder $c) => $c->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"))));

        return Inertia::render('purchase-invoices/index', [
            'invoices' => TableQuery::paginate($query, $request, [], ['invoice_number', 'invoice_date', 'due_date', 'subtotal', 'tax_amount', 'total_amount'], 'invoice_date'),
            'vendors' => self::vendors(),
            'warehouses' => Warehouse::query()->orderBy('name')->get(['id', 'name']),
            'filters' => TableQuery::filters($request, ['vendor_id', 'warehouse_id', 'status', 'date_from', 'date_to']),
        ]);
    }

    public function create(): InertiaResponse
    {
        return Inertia::render('purchase-invoices/form', [...self::formOptions(), 'invoice' => null]);
    }

    public function store(Request $request): RedirectResponse
    {
        $invoice = DB::transaction(function () use ($request) {
            $invoice = new PurchaseInvoice;
            $invoice->forceFill(['created_by' => $request->user()->id]);
            $this->save($invoice, $request);

            return $invoice;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invoice created successfully.')]);

        return to_route('purchase-invoices.show', $invoice);
    }

    public function show(Request $request, PurchaseInvoice $purchaseInvoice): InertiaResponse
    {
        abort_unless($purchaseInvoice->isVisibleTo($request->user()), 404);

        return Inertia::render('purchase-invoices/show', [
            'invoice' => $purchaseInvoice->load([
                'vendor:id,name,email',
                'vendor.vendor:id,user_id,company_name,contact_person_mobile,billing_address,shipping_address',
                'warehouse:id,name',
                'items.item:id,name,sku,description',
            ]),
            'company' => ['name' => Settings::company()],
        ]);
    }

    public function edit(PurchaseInvoice $purchaseInvoice): InertiaResponse|RedirectResponse
    {
        if ($purchaseInvoice->status !== 'draft') {
            return $this->toast('error', __('Only draft invoices can be edited.'));
        }

        return Inertia::render('purchase-invoices/form', [...self::formOptions(), 'invoice' => $purchaseInvoice->load('items')]);
    }

    public function update(Request $request, PurchaseInvoice $purchaseInvoice): RedirectResponse
    {
        if ($purchaseInvoice->status !== 'draft') {
            return $this->toast('error', __('Only draft invoices can be edited.'));
        }

        DB::transaction(fn () => $this->save($purchaseInvoice, $request));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invoice updated successfully.')]);

        return to_route('purchase-invoices.show', $purchaseInvoice);
    }

    public function destroy(PurchaseInvoice $purchaseInvoice): RedirectResponse
    {
        if ($purchaseInvoice->status !== 'draft') {
            return $this->toast('error', __('Only draft invoices can be deleted.'));
        }

        $purchaseInvoice->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invoice deleted successfully.')]);

        return to_route('purchase-invoices.index');
    }

    /** Draft → posted: stock leaves the warehouse and the invoice reaches the ledger. */
    public function post(PurchaseInvoice $purchaseInvoice): RedirectResponse
    {
        $purchaseInvoice->post();

        return $this->done(__('Invoice posted to the ledger.'));
    }

    public function pdf(Request $request, PurchaseInvoice $purchaseInvoice): Response
    {
        abort_unless($purchaseInvoice->isVisibleTo($request->user()), 404);

        $purchaseInvoice->load(['vendor:id,name,email', 'vendor.vendor', 'warehouse:id,name', 'items.item:id,name,sku']);

        return Pdf::loadView('pdf.document', [
            'doc' => $purchaseInvoice,
            'party' => $purchaseInvoice->vendor,
            'partyRecord' => $purchaseInvoice->vendor->vendor,
            'title' => __('Purchase Invoice'),
            'number' => $purchaseInvoice->invoice_number,
            'partyLabel' => __('Billed By'),
            'paid' => $purchaseInvoice->paid_amount,
            'facts' => array_filter([
                __('Invoice Date') => Settings::date($purchaseInvoice->invoice_date),
                __('Due Date') => Settings::date($purchaseInvoice->due_date),
                __('Payment Terms') => $purchaseInvoice->payment_terms ?: '-',
                __('Warehouse') => $purchaseInvoice->warehouse->name,
            ]),
        ])
            ->download("{$purchaseInvoice->invoice_number}.pdf");
    }

    /**
     * Validate the header and lines, then save them; the model prices each line.
     */
    private function save(PurchaseInvoice $invoice, Request $request): void
    {
        $data = $request->validate([
            'invoice_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:invoice_date'],
            'vendor_id' => ['required', Rule::exists('users', 'id')->where('type', 'vendor')],
            'warehouse_id' => ['required', Rule::exists('warehouses', 'id')->where('is_active', true)],
            'payment_terms' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            // Bills are for stock received into a warehouse: products and parts.
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

        $invoice->saveWithLines($data, $items);
    }

    /**
     * @return array<string, mixed>
     */
    public static function formOptions(): array
    {
        return [
            'vendors' => self::vendors(),
            'warehouses' => Warehouse::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            // Bills are priced at what the company pays, so the line price defaults to the purchase price.
            'items' => Item::query()->where('is_active', true)->whereNot('type', 'service')->with('taxes:id,tax_name,rate')->orderBy('name')
                ->get(['id', 'name', 'sku', 'type', 'purchase_price as sale_price']),
        ];
    }

    /**
     * Vendor logins with their company name and default payment terms.
     *
     * @return Collection<int, array{id: int, name: string, email: string, company_name: string|null, payment_terms: string|null}>
     */
    public static function vendors(): Collection
    {
        return User::query()->where('type', 'vendor')->with('vendor:id,user_id,company_name,payment_terms')->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'company_name' => $u->vendor?->company_name,
                'payment_terms' => $u->vendor?->payment_terms,
            ]);
    }
}
