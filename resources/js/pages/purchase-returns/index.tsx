import { Head, Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { PersonCell } from '@/components/person-cell';
import { StatusBadge } from '@/components/status-badge';
import { DateCell, IdBadge } from '@/components/table-cells';
import { FilterSelect } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import purchaseReturns from '@/routes/purchase-returns';
import type { Paginated, TableFilters } from '@/types';
import { ReturnActions } from './actions';
import { reasonLabel } from './types';
import type { PurchaseReturn } from './types';

const REASONS = [
    'defective',
    'damaged',
    'wrong_item',
    'excess_quantity',
    'other',
];

export default function PurchaseReturns({
    returns,
    vendors,
    warehouses,
    filters,
}: {
    returns: Paginated<PurchaseReturn>;
    vendors: { id: number; name: string }[];
    warehouses: { id: number; name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const url = purchaseReturns.index();

    const columns: Column<PurchaseReturn>[] = [
        {
            key: 'return_number',
            label: 'Return Number',
            sortable: true,
            render: (r) => (
                <Link href={purchaseReturns.show(r.id)}>
                    <IdBadge>{r.return_number}</IdBadge>
                </Link>
            ),
        },
        {
            key: 'vendor',
            label: 'Vendor',
            render: (r) => (
                <PersonCell name={r.vendor.name} detail={r.vendor.email} />
            ),
        },
        {
            key: 'warehouse',
            label: 'Warehouse',
            render: (r) => (
                <span className="inline-block rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300">
                    {r.warehouse.name}
                </span>
            ),
        },
        {
            key: 'return_date',
            label: 'Return Date',
            sortable: true,
            render: (r) => <DateCell value={r.return_date} />,
        },
        {
            key: 'total_amount',
            label: 'Total Amount',
            sortable: true,
            render: (r) => (
                <span className="font-semibold whitespace-nowrap">
                    {money(Number(r.total_amount))}
                </span>
            ),
        },
        {
            key: 'items',
            label: 'Items',
            render: (r) => (
                <div className="grid gap-0.5 text-sm">
                    {r.items.map((line) => (
                        <div
                            key={line.id}
                            className="flex justify-between gap-3 whitespace-nowrap"
                        >
                            <span>{line.item.name}</span>
                            <span className="text-muted-foreground">
                                ×{Number(line.quantity)}
                            </span>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
        },
    ];

    return (
        <>
            <Head title={t('Purchase Returns')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Purchase Returns"
                    description="Manage and track your purchase returns, processing statuses, and item refund details."
                    action={
                        can('create-purchase-return-invoices') && (
                            <Button asChild>
                                <Link href={purchaseReturns.create()}>
                                    <Plus /> {t('Create Return')}
                                </Link>
                            </Button>
                        )
                    }
                />
                <DataTable
                    data={returns}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <>
                            {can('manage-any-purchase-return-invoices') && (
                                <FilterSelect
                                    url={url}
                                    filters={filters}
                                    name="vendor_id"
                                    label="All Vendors"
                                    options={vendors}
                                />
                            )}
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="warehouse_id"
                                label="All Warehouses"
                                options={warehouses}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="status"
                                label="All Statuses"
                                options={['draft', 'approved', 'completed'].map(
                                    (s) => ({ id: s, name: t(reasonLabel(s)) }),
                                )}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="reason"
                                label="All Reasons"
                                options={REASONS.map((r) => ({
                                    id: r,
                                    name: t(reasonLabel(r)),
                                }))}
                            />
                        </>
                    }
                    actions={(r) => <ReturnActions purchaseReturn={r} />}
                    renderCard={(r, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <Link href={purchaseReturns.show(r.id)}>
                                    <IdBadge>{r.return_number}</IdBadge>
                                </Link>
                                <StatusBadge status={r.status} />
                            </div>
                            <PersonCell
                                name={r.vendor.name}
                                detail={r.vendor.email}
                            />
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Total Amount')}
                                    </div>
                                    <div className="font-semibold">
                                        {money(Number(r.total_amount))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Reason')}
                                    </div>
                                    <div className="truncate">
                                        {t(reasonLabel(r.reason))}
                                    </div>
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {r.items
                                    .map(
                                        (line) =>
                                            `${line.item.name} ×${Number(line.quantity)}`,
                                    )
                                    .join(', ')}
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{date(r.return_date)}</span>
                                <span className="truncate">
                                    {r.warehouse.name}
                                </span>
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                />
            </div>
        </>
    );
}

PurchaseReturns.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Purchase Returns', href: purchaseReturns.index() },
    ],
};
