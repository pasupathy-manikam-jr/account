<?php

namespace App\Http\Controllers\Purchase;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\StockTransfer;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class StockTransferController extends Controller
{
    public function index(Request $request): Response
    {
        $query = StockTransfer::query()
            ->with(['fromWarehouse:id,name', 'toWarehouse:id,name', 'item:id,name,sku,image'])
            ->when($request->filled('warehouse_id'), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('from_warehouse_id', $request->integer('warehouse_id'))->orWhere('to_warehouse_id', $request->integer('warehouse_id'))))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q
                ->whereHas('item', fn (Builder $i) => $i->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%")));

        return Inertia::render('transfers/index', [
            'transfers' => TableQuery::paginate($query, $request, [], ['date', 'quantity'], 'date'),
            'warehouses' => Warehouse::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'items' => Item::query()->where('is_active', true)->whereNot('type', 'service')->orderBy('name')->get(['id', 'name', 'sku']),
            // What each warehouse holds, so the form can show what is available to move.
            'stocks' => WarehouseStock::query()->where('quantity', '>', 0)->get(['item_id', 'warehouse_id', 'quantity']),
            'filters' => TableQuery::filters($request, ['warehouse_id']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'from_warehouse_id' => ['required', Rule::exists('warehouses', 'id')->where('is_active', true)],
            'to_warehouse_id' => ['required', 'different:from_warehouse_id', Rule::exists('warehouses', 'id')->where('is_active', true)],
            'item_id' => ['required', Rule::exists('items', 'id')->where('is_active', true)->whereNot('type', 'service')],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:9999999', 'decimal:0,2'],
            'date' => ['required', 'date'],
        ]);

        StockTransfer::move($data, $request->user()->id);

        return $this->done(__('Stock transferred successfully.'));
    }

    public function destroy(StockTransfer $transfer): RedirectResponse
    {
        $transfer->reverse();

        return $this->done(__('Transfer deleted and the stock moved back.'));
    }
}
