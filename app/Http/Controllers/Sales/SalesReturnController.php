<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Models\SalesInvoice;
use App\Models\SalesInvoiceItem;
use App\Models\SalesReturn;
use App\Models\Warehouse;
use App\Support\Money;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SalesReturnController extends Controller
{
    public function index(Request $request): Response
    {
        $query = SalesReturn::query()
            // Clients see only their own returns.
            ->when(! $request->user()->can('manage-any-sales-return-invoices'), fn (Builder $q) => $q->where('customer_id', $request->user()->id))
            ->with(['customer:id,name,email', 'warehouse:id,name', 'items:id,return_id,item_id,quantity', 'items.item:id,name'])
            ->when($request->filled('customer_id'), fn (Builder $q) => $q->where('customer_id', $request->integer('customer_id')))
            ->when($request->filled('warehouse_id'), fn (Builder $q) => $q->where('warehouse_id', $request->integer('warehouse_id')))
            ->when(in_array($request->input('status'), SalesReturn::STATUSES, true), fn (Builder $q) => $q->where('status', $request->input('status')))
            ->when(in_array($request->input('reason'), SalesReturn::REASONS, true), fn (Builder $q) => $q->where('reason', $request->input('reason')))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('return_number', 'like', "%{$search}%")
                ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'like', "%{$search}%"))));

        return Inertia::render('sales-returns/index', [
            'returns' => TableQuery::paginate($query, $request, [], ['return_number', 'return_date', 'total_amount'], 'return_date'),
            'customers' => SalesInvoiceController::customers(),
            'warehouses' => Warehouse::query()->orderBy('name')->get(['id', 'name']),
            'filters' => TableQuery::filters($request, ['customer_id', 'warehouse_id', 'status', 'reason']),
        ]);
    }

    public function create(): Response
    {
        // Posted product invoices with something left to return.
        $invoices = SalesInvoice::query()
            ->where('type', 'product')
            ->whereIn('status', ['posted', 'partial', 'paid'])
            ->with(['customer:id,name,email', 'items.item:id,name,sku'])
            ->latest('invoice_date')
            ->get()
            ->map(fn (SalesInvoice $invoice) => [
                'id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'invoice_date' => $invoice->invoice_date->format('Y-m-d'),
                'warehouse_id' => $invoice->warehouse_id,
                'customer' => $invoice->customer->only(['id', 'name', 'email']),
                'items' => $invoice->items->map(fn (SalesInvoiceItem $line) => [
                    'id' => $line->id,
                    'name' => $line->item->name,
                    'sku' => $line->item->sku,
                    'quantity' => $line->quantity,
                    'returnable' => $line->returnableQuantity(),
                    'unit_price' => $line->unit_price,
                    'discount_percentage' => $line->discount_percentage,
                    'tax_percentage' => $line->tax_percentage,
                ])->filter(fn (array $line) => Money::toCents($line['returnable']) > 0)->values(),
            ])
            ->filter(fn (array $invoice) => $invoice['items']->isNotEmpty())
            ->values();

        return Inertia::render('sales-returns/form', [
            'invoices' => $invoices,
            'warehouses' => Warehouse::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'reasons' => SalesReturn::REASONS,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $invoiceId = $request->integer('original_invoice_id');

        $data = $request->validate([
            'original_invoice_id' => ['required', Rule::exists('sales_invoices', 'id')->where('type', 'product')->whereIn('status', ['posted', 'partial', 'paid'])],
            'return_date' => ['required', 'date'],
            'warehouse_id' => ['required', Rule::exists('warehouses', 'id')->where('is_active', true)],
            'reason' => ['required', Rule::in(SalesReturn::REASONS)],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.original_invoice_item_id' => ['required', 'distinct', Rule::exists('sales_invoice_items', 'id')->where('invoice_id', $invoiceId)],
            'items.*.quantity' => [
                'required', 'numeric', 'gt:0', 'decimal:0,2',
                function (string $attribute, mixed $value, \Closure $fail) use ($request) {
                    $index = (int) explode('.', $attribute)[1];
                    $line = SalesInvoiceItem::query()->whereKey($request->input("items.{$index}.original_invoice_item_id"))->first();

                    if ($line && Money::toCents($value) > Money::toCents($line->returnableQuantity())) {
                        $fail(__('Only :quantity can still be returned.', ['quantity' => rtrim(rtrim($line->returnableQuantity(), '0'), '.')]));
                    }
                },
            ],
        ], [], [
            'items.*.original_invoice_item_id' => __('invoice line'),
            'items.*.quantity' => __('quantity'),
        ]);

        $invoice = SalesInvoice::query()->whereKey($data['original_invoice_id'])->firstOrFail();

        if ($invoice->invoice_date->isAfter($data['return_date'])) {
            return back()->withErrors(['return_date' => __('The return date cannot be before the invoice date.')]);
        }

        $return = DB::transaction(function () use ($data, $invoice, $request) {
            $return = new SalesReturn;
            $return->forceFill(['created_by' => $request->user()->id]);
            $return->saveFromInvoice([
                'return_date' => $data['return_date'],
                'customer_id' => $invoice->customer_id,
                'warehouse_id' => $data['warehouse_id'],
                'original_invoice_id' => $invoice->id,
                'reason' => $data['reason'],
                'notes' => $data['notes'] ?? null,
            ], $data['items']);

            return $return;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sales return created successfully.')]);

        return to_route('sales-returns.show', $return);
    }

    public function show(Request $request, SalesReturn $salesReturn): Response
    {
        abort_unless($request->user()->can('manage-any-sales-return-invoices') || $salesReturn->customer_id === $request->user()->id, 404);

        return Inertia::render('sales-returns/show', [
            'salesReturn' => $salesReturn->load([
                'customer:id,name,email',
                'warehouse:id,name',
                'originalInvoice:id,invoice_number,invoice_date',
                'creditNote:id,return_id,credit_note_number,status',
                'items.item:id,name,sku,description',
            ]),
        ]);
    }

    public function destroy(SalesReturn $salesReturn): RedirectResponse
    {
        if ($salesReturn->status !== 'draft') {
            return $this->toast('error', __('Only draft returns can be deleted.'));
        }

        $salesReturn->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sales return deleted successfully.')]);

        return to_route('sales-returns.index');
    }

    public function approve(SalesReturn $salesReturn): RedirectResponse
    {
        $salesReturn->approve();

        return $this->done(__('Sales return approved.'));
    }

    /** Approved → completed: restock and raise the credit note. */
    public function complete(SalesReturn $salesReturn): RedirectResponse
    {
        $note = $salesReturn->complete();

        return $this->done(__('Return completed. Credit note :number raised.', ['number' => $note->credit_note_number]));
    }
}
