<?php

namespace App\Http\Controllers\ProductService;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\SalesProposalItem;
use App\Models\Tax;
use App\Models\Unit;
use App\Models\Warehouse;
use App\Support\Money;
use App\Support\TableQuery;
use EInvoiceSdk\Codes;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class ItemController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Item::query()
            ->with(['category:id,name,color', 'unit:id,unit_name'])
            ->withSum('stocks as total_quantity', 'quantity')
            ->when($request->filled('category_id'), fn (Builder $q) => $q->where('category_id', $request->integer('category_id')))
            ->when(in_array($request->input('type'), Item::TYPES, true), fn (Builder $q) => $q->where('type', $request->input('type')));

        return Inertia::render('product-service/items/index', [
            'items' => TableQuery::paginate($query, $request, ['name', 'sku'], ['name', 'sale_price', 'purchase_price', 'type', 'created_at'], 'name', 'asc'),
            'categories' => ItemCategory::query()->orderBy('name')->get(['id', 'name']),
            'filters' => TableQuery::filters($request, ['category_id', 'type']),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('product-service/items/form', [...$this->options(), 'item' => null]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        DB::transaction(function () use ($request, $data) {
            $item = new Item($data);
            $item->image = $this->storeImage($request);
            $item->save();
            $this->syncRelations($item, $data);
        });

        $this->done(__('Item created successfully.'));

        return to_route('product-service.items.index');
    }

    public function show(Item $item): Response
    {
        $item->load(['category:id,name,color', 'unit:id,unit_name', 'taxes:id,tax_name,rate', 'stocks.warehouse:id,name,city'])
            ->loadSum('stocks as total_quantity', 'quantity');

        return Inertia::render('product-service/items/show', [
            'item' => $item,
            'warehouses' => Warehouse::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function edit(Item $item): Response
    {
        $item->load(['taxes:id', 'stocks:id,item_id,warehouse_id,quantity']);

        return Inertia::render('product-service/items/form', [...$this->options(), 'item' => $item]);
    }

    public function update(Request $request, Item $item): RedirectResponse
    {
        $data = $this->validated($request, $item);

        DB::transaction(function () use ($request, $item, $data) {
            $item->fill($data);

            if ($request->hasFile('image')) {
                $old = $item->image;
                $item->image = $this->storeImage($request);
                $old && Storage::disk('public')->delete($old);
            }

            $item->save();
            $this->syncRelations($item, $data);
        });

        $this->done(__('Item updated successfully.'));

        return to_route('product-service.items.index');
    }

    public function destroy(Item $item): RedirectResponse
    {
        if (SalesProposalItem::query()->where('item_id', $item->id)->exists()) {
            return $this->toast('error', __('Items used on proposals or invoices cannot be deleted. Deactivate it instead.'));
        }

        $item->delete();
        $item->image && Storage::disk('public')->delete($item->image);

        return $this->done(__('Item deleted successfully.'));
    }

    /**
     * Receive stock into a warehouse (adds to what is already there).
     */
    public function addStock(Request $request, Item $item): RedirectResponse
    {
        abort_unless(in_array($item->type, Item::STOCKED_TYPES, true), 422);

        $data = $request->validate([
            'warehouse_id' => ['required', Rule::exists('warehouses', 'id')->where('is_active', true)],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:9999999999999', 'decimal:0,2'],
        ]);

        DB::transaction(function () use ($item, $data) {
            $stock = $item->stocks()->lockForUpdate()->firstOrNew(['warehouse_id' => $data['warehouse_id']]);
            $stock->quantity = Money::format(Money::toCents($stock->quantity) + Money::toCents($data['quantity']));
            $stock->save();
        });

        return $this->done(__('Stock added successfully.'));
    }

    private function storeImage(Request $request): ?string
    {
        $file = $request->file('image');

        if (! $file instanceof UploadedFile) {
            return null;
        }

        return $file->store('items', 'public') ?: throw new RuntimeException('The item image could not be stored.');
    }

    /**
     * @return array<string, mixed>
     */
    private function options(): array
    {
        return [
            'categories' => ItemCategory::query()->orderBy('name')->get(['id', 'name']),
            'taxes' => Tax::query()->orderBy('tax_name')->get(['id', 'tax_name', 'rate']),
            'units' => Unit::query()->orderBy('unit_name')->get(['id', 'unit_name']),
            'warehouses' => Warehouse::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'types' => Item::TYPES,
            'classifications' => Codes::classifications(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function syncRelations(Item $item, array $data): void
    {
        $item->taxes()->sync($data['tax_ids'] ?? []);

        if (! in_array($item->type, Item::STOCKED_TYPES, true)) {
            $item->stocks()->delete();

            return;
        }

        // Only warehouses on the form are touched: stock in a warehouse that has since been
        // deactivated (so isn't listed) must survive an edit.
        /** @var list<array{warehouse_id: int|string, quantity: int|string|float|null}> $stocks */
        $stocks = $data['stocks'] ?? [];

        foreach ($stocks as $row) {
            $item->stocks()->updateOrCreate(['warehouse_id' => $row['warehouse_id']], ['quantity' => $row['quantity'] ?? 0]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Item $item = null): array
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(Item::TYPES)],
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['required', 'string', 'max:50', Rule::unique('items')->ignore($item)],
            'category_id' => ['required', Rule::exists('item_categories', 'id')],
            'unit_id' => ['required', Rule::exists('units', 'id')],
            'classification_code' => ['sometimes', 'required', Rule::in(array_keys(Codes::classifications()))],
            'tax_ids' => ['array'],
            'tax_ids.*' => ['integer', 'distinct', Rule::exists('taxes', 'id')],
            'sale_price' => ['required', 'numeric', 'min:0', 'max:9999999999999', 'decimal:0,2'],
            'purchase_price' => ['required', 'numeric', 'min:0', 'max:9999999999999', 'decimal:0,2'],
            'description' => ['nullable', 'string', 'max:500'],
            'long_description' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['boolean'],
            'image' => ['nullable', 'image', 'max:2048'],
            'stocks' => ['array'],
            'stocks.*.warehouse_id' => ['required', 'distinct', Rule::exists('warehouses', 'id')],
            'stocks.*.quantity' => ['nullable', 'numeric', 'min:0', 'max:9999999999999', 'decimal:0,2'],
        ]);

        unset($data['image']);

        return $data;
    }
}
