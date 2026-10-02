import { Head, Link, router } from '@inertiajs/react';
import {
    Boxes,
    CircleCheck,
    Eye,
    Plus,
    SquarePen,
    Trash2,
    Wallet,
    Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { SummaryCard } from '@/components/summary-card';
import { DateCell, IdBadge } from '@/components/table-cells';
import { FilterSelect } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import assetRoutes from '@/routes/assets';
import type { Paginated, TableFilters } from '@/types';
import { useAssetForm } from './asset-form';
import type { Asset, Option } from './asset-form';

export default function Assets({
    assets,
    counts,
    stats,
    categories,
    locations,
    filters,
}: {
    assets: Paginated<Asset>;
    counts: Record<string, number>;
    stats: { total_cost: string };
    categories: Option[];
    locations: Option[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const can = useCan();
    const url = assetRoutes.index();
    const assetForm = useAssetForm(categories, locations);
    const [deleting, setDeleting] = useState<Asset | null>(null);

    const columns: Column<Asset>[] = [
        {
            key: 'name',
            label: 'Asset',
            sortable: true,
            render: (a) => (
                <div>
                    <Link
                        href={assetRoutes.show(a.id)}
                        className="font-medium hover:underline"
                    >
                        {a.name}
                    </Link>
                    <div>
                        <IdBadge>{a.serial_code}</IdBadge>
                    </div>
                </div>
            ),
        },
        { key: 'category', label: 'Category', render: (a) => a.category.name },
        {
            key: 'purchase_date',
            label: 'Purchase Date',
            sortable: true,
            render: (a) => <DateCell value={a.purchase_date} />,
        },
        {
            key: 'quantity',
            label: 'Quantity',
            sortable: true,
            render: (a) => (
                <span className="tabular-nums">
                    {a.quantity}
                    {a.out_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                            {' '}
                            · {t(':count out', { count: a.out_count })}
                        </span>
                    )}
                </span>
            ),
        },
        {
            key: 'unit_price',
            label: 'Unit Price',
            sortable: true,
            render: (a) => (
                <span className="whitespace-nowrap">
                    {money(Number(a.unit_price))}
                </span>
            ),
        },
        {
            key: 'cost',
            label: 'Purchase Cost',
            render: (a) => (
                <span className="font-semibold whitespace-nowrap">
                    {money(Number(a.purchase_cost))}
                </span>
            ),
        },
        {
            key: 'location',
            label: 'Location',
            render: (a) => a.location?.name ?? '-',
        },
        {
            key: 'status',
            label: 'Status',
            render: (a) => <StatusBadge status={a.status} />,
        },
    ];

    return (
        <>
            <Head title={t('Assets')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Assets"
                    description="View, filter, manage, track quantities, unit prices, locations and depreciation values of your company assets."
                    action={
                        can('create-assets') && (
                            <Button onClick={() => assetForm.openForm(null)}>
                                <Plus /> {t('Add Asset')}
                            </Button>
                        )
                    }
                />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        tone="blue"
                        icon={Boxes}
                        label="Total Assets"
                        value={counts.all}
                        caption="All time"
                    />
                    <SummaryCard
                        tone="green"
                        icon={CircleCheck}
                        label="Available Assets"
                        value={counts.available}
                        caption="Ready for use"
                    />
                    <SummaryCard
                        tone="orange"
                        icon={Wrench}
                        label="Under Maintenance"
                        value={counts.maintenance}
                        caption="Active maintenance"
                    />
                    <SummaryCard
                        tone="violet"
                        icon={Wallet}
                        label="Total Purchase Cost"
                        value={money(Number(stats.total_cost))}
                        caption="Total investment"
                    />
                </div>
                <DataTable
                    data={assets}
                    columns={columns}
                    filters={filters}
                    url={url}
                    toolbar={
                        <>
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="category_id"
                                label="All Categories"
                                options={categories}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="status"
                                label="All Statuses"
                                options={[
                                    { id: 'available', name: t('Available') },
                                    { id: 'assigned', name: t('Assigned') },
                                    {
                                        id: 'maintenance',
                                        name: t('Under Maintenance'),
                                    },
                                ]}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="location_id"
                                label="All Locations"
                                options={locations}
                            />
                        </>
                    }
                    renderCard={(a, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <Link
                                        href={assetRoutes.show(a.id)}
                                        className="font-semibold hover:underline"
                                    >
                                        {a.name}
                                    </Link>
                                    <div className="mt-1">
                                        <IdBadge>{a.serial_code}</IdBadge>
                                    </div>
                                </div>
                                <StatusBadge status={a.status} />
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Purchase Cost')}
                                    </div>
                                    <div className="font-semibold">
                                        {money(Number(a.purchase_cost))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Quantity')}
                                    </div>
                                    <div>
                                        {a.quantity} ×{' '}
                                        {money(Number(a.unit_price))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                                <span className="truncate">
                                    {a.category.name}
                                </span>
                                <span className="truncate">
                                    {a.location?.name ?? '-'}
                                </span>
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                    actions={(a) => (
                        <>
                            {can('view-assets') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('View')}
                                    asChild
                                >
                                    <Link href={assetRoutes.show(a.id)}>
                                        <Eye className="text-violet-600" />
                                    </Link>
                                </Button>
                            )}
                            {can('edit-assets') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Edit')}
                                    onClick={() => assetForm.openForm(a)}
                                >
                                    <SquarePen className="text-blue-600" />
                                </Button>
                            )}
                            {can('delete-assets') && a.out_count === 0 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Delete')}
                                    onClick={() => setDeleting(a)}
                                >
                                    <Trash2 className="text-destructive" />
                                </Button>
                            )}
                        </>
                    )}
                />
            </div>

            {assetForm.dialog}
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This asset and its assignment, maintenance and depreciation records will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(assetRoutes.destroy(deleting.id), {
                        preserveScroll: true,
                        onFinish: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

Assets.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Assets', href: assetRoutes.index() },
    ],
};
