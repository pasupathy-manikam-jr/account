import { Head, router, useForm } from '@inertiajs/react';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import DatePicker from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { ItemThumb } from '@/components/item-cells';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { DateCell, IdBadge } from '@/components/table-cells';
import { FilterSelect } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import transfers from '@/routes/transfers';
import type { Paginated, TableFilters } from '@/types';

type Transfer = {
    id: number;
    quantity: string;
    date: string;
    from_warehouse: { id: number; name: string };
    to_warehouse: { id: number; name: string };
    item: { id: number; name: string; sku: string; image_url: string | null };
};

type Stock = { item_id: number; warehouse_id: number; quantity: string };

// A stable colour per warehouse so the same place reads the same everywhere on the page.
const PALETTE = [
    'border-emerald-200 bg-emerald-50 text-emerald-700',
    'border-violet-200 bg-violet-50 text-violet-700',
    'border-sky-200 bg-sky-50 text-sky-700',
    'border-amber-200 bg-amber-50 text-amber-700',
    'border-rose-200 bg-rose-50 text-rose-700',
    'border-teal-200 bg-teal-50 text-teal-700',
];

function WarehouseBadge({
    warehouse,
}: {
    warehouse: { id: number; name: string };
}) {
    return (
        <span
            className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PALETTE[warehouse.id % PALETTE.length]}`}
        >
            {warehouse.name}
        </span>
    );
}

const today = () => new Date().toISOString().slice(0, 10);
const blank = {
    from_warehouse_id: '',
    item_id: '',
    to_warehouse_id: '',
    quantity: '',
    date: today(),
};

export default function Transfers({
    transfers: list,
    warehouses,
    items,
    stocks,
    filters,
}: {
    transfers: Paginated<Transfer>;
    warehouses: { id: number; name: string }[];
    items: { id: number; name: string; sku: string }[];
    stocks: Stock[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Transfer | null>(null);
    const form = useForm(blank);
    const url = transfers.index();
    const available = stocks.find(
        (s) =>
            String(s.item_id) === form.data.item_id &&
            String(s.warehouse_id) === form.data.from_warehouse_id,
    )?.quantity;
    // Only items the chosen source warehouse actually holds.
    const sourceItems = form.data.from_warehouse_id
        ? items.filter((i) =>
              stocks.some(
                  (s) =>
                      s.item_id === i.id &&
                      String(s.warehouse_id) === form.data.from_warehouse_id,
              ),
          )
        : items;
    const required = <span className="text-destructive">*</span>;

    const columns: Column<Transfer>[] = [
        {
            key: 'product',
            label: 'Product',
            render: (tr) => (
                <div className="flex items-center gap-3">
                    <ItemThumb item={tr.item} />
                    <div>
                        <div className="font-medium">{tr.item.name}</div>
                        <IdBadge>
                            {t('SKU')}: {tr.item.sku}
                        </IdBadge>
                    </div>
                </div>
            ),
        },
        {
            key: 'from',
            label: 'From Warehouse',
            render: (tr) => <WarehouseBadge warehouse={tr.from_warehouse} />,
        },
        {
            key: 'to',
            label: 'To Warehouse',
            render: (tr) => <WarehouseBadge warehouse={tr.to_warehouse} />,
        },
        {
            key: 'quantity',
            label: 'Quantity',
            sortable: true,
            render: (tr) => <IdBadge>{Number(tr.quantity)}</IdBadge>,
        },
        {
            key: 'date',
            label: 'Date',
            sortable: true,
            render: (tr) => <DateCell value={tr.date} />,
        },
    ];

    return (
        <>
            <Head title={t('Transfers')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Transfers"
                    description="Manage and track stock transfers between warehouses."
                    action={
                        can('create-transfers') && (
                            <Button
                                onClick={() => {
                                    form.setData(blank);
                                    form.clearErrors();
                                    setFormOpen(true);
                                }}
                            >
                                <Plus /> {t('Add Transfer')}
                            </Button>
                        )
                    }
                />
                <DataTable
                    data={list}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <FilterSelect
                            url={url}
                            filters={filters}
                            name="warehouse_id"
                            label="All Warehouses"
                            options={warehouses}
                        />
                    }
                    actions={(tr) =>
                        can('delete-transfers') && (
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t('Delete')}
                                onClick={() => setDeleting(tr)}
                            >
                                <Trash2 className="text-destructive" />
                            </Button>
                        )
                    }
                />
            </div>

            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title="Add Transfer"
                description="Move stock from one warehouse to another."
                icon={ArrowLeftRight}
                processing={form.processing}
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post(transfers.store().url, {
                        preserveScroll: true,
                        onSuccess: () => setFormOpen(false),
                    });
                }}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="from_warehouse_id">
                            {t('From Warehouse')} {required}
                        </Label>
                        <SelectField
                            id="from_warehouse_id"
                            value={form.data.from_warehouse_id}
                            placeholder={t('Select Warehouse')}
                            onChange={(e) =>
                                form.setData({
                                    ...form.data,
                                    from_warehouse_id: e.target.value,
                                    item_id: '',
                                })
                            }
                        >
                            {warehouses.map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.name}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.from_warehouse_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="to_warehouse_id">
                            {t('To Warehouse')} {required}
                        </Label>
                        <SelectField
                            id="to_warehouse_id"
                            value={form.data.to_warehouse_id}
                            placeholder={t('Select Warehouse')}
                            onChange={(e) =>
                                form.setData('to_warehouse_id', e.target.value)
                            }
                        >
                            {warehouses
                                .filter(
                                    (w) =>
                                        String(w.id) !==
                                        form.data.from_warehouse_id,
                                )
                                .map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name}
                                    </option>
                                ))}
                        </SelectField>
                        <InputError message={form.errors.to_warehouse_id} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="item_id">
                            {t('Product')} {required}
                        </Label>
                        <SelectField
                            id="item_id"
                            value={form.data.item_id}
                            placeholder={t('Select Product')}
                            onChange={(e) =>
                                form.setData('item_id', e.target.value)
                            }
                        >
                            {sourceItems.map((i) => (
                                <option key={i.id} value={i.id}>
                                    {i.name} ({i.sku})
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.item_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="quantity">
                            {t('Quantity')} {required}
                        </Label>
                        <Input
                            id="quantity"
                            inputMode="decimal"
                            value={form.data.quantity}
                            onChange={(e) =>
                                form.setData('quantity', e.target.value)
                            }
                        />
                        {available !== undefined && (
                            <p className="text-xs text-muted-foreground">
                                {t(':quantity available', {
                                    quantity: Number(available),
                                })}
                            </p>
                        )}
                        <InputError message={form.errors.quantity} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="date">
                            {t('Date')} {required}
                        </Label>
                        <DatePicker
                            id="date"
                            name="date"
                            defaultValue={form.data.date}
                            onChange={(v) => form.setData('date', v)}
                        />
                        <InputError message={form.errors.date} />
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="The stock moves back to the source warehouse."
                onConfirm={() =>
                    deleting &&
                    router.delete(transfers.destroy(deleting.id), {
                        preserveScroll: true,
                        onFinish: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

Transfers.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Transfers', href: transfers.index() },
    ],
};
