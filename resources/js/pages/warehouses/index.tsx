import { Head, router, useForm } from '@inertiajs/react';
import {
    MapPin,
    Phone,
    Plus,
    SquarePen,
    Trash2,
    Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import { FilterSelect } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import warehouseRoutes from '@/routes/warehouses';
import type { Paginated, TableFilters } from '@/types';

type Warehouse = {
    id: number;
    name: string;
    address: string | null;
    city: string | null;
    zip_code: string | null;
    phone: string | null;
    email: string | null;
    is_active: boolean;
};

const FIELDS = [
    ['name', 'Name', true],
    ['email', 'Email', false],
    ['phone', 'Phone', false],
    ['address', 'Address', false],
    ['city', 'City', false],
    ['zip_code', 'Zip Code', false],
] as const;

const blank = {
    name: '',
    address: '',
    city: '',
    zip_code: '',
    phone: '',
    email: '',
    is_active: true,
};

export default function Warehouses({
    warehouses,
    filters,
}: {
    warehouses: Paginated<Warehouse>;
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const [editing, setEditing] = useState<Warehouse | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Warehouse | null>(null);
    const form = useForm(blank);
    const url = warehouseRoutes.index();

    const openForm = (warehouse: Warehouse | null) => {
        setEditing(warehouse);
        form.clearErrors();
        form.setData(
            warehouse
                ? {
                      name: warehouse.name,
                      address: warehouse.address ?? '',
                      city: warehouse.city ?? '',
                      zip_code: warehouse.zip_code ?? '',
                      phone: warehouse.phone ?? '',
                      email: warehouse.email ?? '',
                      is_active: warehouse.is_active,
                  }
                : blank,
        );
        setFormOpen(true);
    };

    const nameCell = (w: Warehouse) => (
        <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <WarehouseIcon className="size-5" />
            </span>
            <div className="min-w-0">
                <div className="font-medium">{w.name}</div>
                <div className="truncate text-muted-foreground">{w.email}</div>
            </div>
        </div>
    );

    const columns: Column<Warehouse>[] = [
        { key: 'name', label: 'Name', sortable: true, render: nameCell },
        {
            key: 'address',
            label: 'Address',
            render: (w) =>
                w.address ? (
                    <span className="flex items-center gap-2">
                        <MapPin className="size-4 shrink-0 text-orange-500" />
                        {w.address}
                    </span>
                ) : (
                    '—'
                ),
        },
        { key: 'city', label: 'City', sortable: true, render: (w) => w.city },
        {
            key: 'zip_code',
            label: 'Zip Code',
            render: (w) => (w.zip_code ? <IdBadge>{w.zip_code}</IdBadge> : '—'),
        },
        {
            key: 'phone',
            label: 'Phone',
            render: (w) =>
                w.phone ? (
                    <span className="flex items-center gap-2 whitespace-nowrap">
                        <Phone className="size-4 shrink-0 text-blue-500" />
                        {w.phone}
                    </span>
                ) : (
                    '—'
                ),
        },
        {
            key: 'is_active',
            label: 'Status',
            sortable: true,
            render: (w) => (
                <StatusBadge status={w.is_active ? 'active' : 'inactive'} />
            ),
        },
    ];

    const actions = (warehouse: Warehouse) => (
        <>
            {can('edit-warehouses') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Edit')}
                    onClick={() => openForm(warehouse)}
                >
                    <SquarePen className="text-blue-600" />
                </Button>
            )}
            {can('delete-warehouses') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Delete')}
                    onClick={() => setDeleting(warehouse)}
                >
                    <Trash2 className="text-destructive" />
                </Button>
            )}
        </>
    );

    return (
        <>
            <Head title={t('Warehouses')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Warehouses"
                    description="Manage warehouse locations, addresses, and contacts."
                    action={
                        can('create-warehouses') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Warehouse')}
                            </Button>
                        )
                    }
                />

                <DataTable
                    data={warehouses}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <FilterSelect
                            url={url}
                            filters={filters}
                            name="status"
                            label="All Statuses"
                            options={[
                                { id: 'active', name: t('Active') },
                                { id: 'inactive', name: t('Inactive') },
                            ]}
                        />
                    }
                    actions={actions}
                    renderCard={(w, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                {nameCell(w)}
                                <StatusBadge
                                    status={w.is_active ? 'active' : 'inactive'}
                                />
                            </div>
                            <div className="grid gap-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-2">
                                    <MapPin className="size-4 shrink-0 text-orange-500" />
                                    {[w.address, w.city, w.zip_code]
                                        .filter(Boolean)
                                        .join(', ') || '—'}
                                </span>
                                <span className="flex items-center gap-2">
                                    <Phone className="size-4 shrink-0 text-blue-500" />
                                    {w.phone || '—'}
                                </span>
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                />
            </div>

            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title={editing ? 'Edit Warehouse' : 'Add Warehouse'}
                description="Where stock is kept, and who to contact there."
                icon={WarehouseIcon}
                onSubmit={(e) => {
                    e.preventDefault();
                    form.submit(
                        editing
                            ? warehouseRoutes.update(editing.id)
                            : warehouseRoutes.store(),
                        {
                            preserveScroll: true,
                            onSuccess: () => setFormOpen(false),
                        },
                    );
                }}
                processing={form.processing}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    {FIELDS.map(([key, label, required]) => (
                        <div
                            key={key}
                            className={
                                key === 'address'
                                    ? 'grid gap-2 sm:col-span-2'
                                    : 'grid gap-2'
                            }
                        >
                            <Label htmlFor={`warehouse-${key}`}>
                                {t(label)}{' '}
                                {required && (
                                    <span className="text-destructive">*</span>
                                )}
                            </Label>
                            <Input
                                id={`warehouse-${key}`}
                                value={form.data[key]}
                                onChange={(e) =>
                                    form.setData(key, e.target.value)
                                }
                            />
                            <InputError message={form.errors[key]} />
                        </div>
                    ))}
                    <div className="flex items-center gap-3 self-end pb-2">
                        <Switch
                            id="warehouse-active"
                            checked={form.data.is_active}
                            onCheckedChange={(checked) =>
                                form.setData('is_active', checked)
                            }
                        />
                        <Label htmlFor="warehouse-active">
                            {t('Is Active')}
                        </Label>
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This warehouse will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(warehouseRoutes.destroy(deleting.id), {
                        preserveScroll: true,
                        onSuccess: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

Warehouses.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Warehouses', href: warehouseRoutes.index() },
    ],
};
