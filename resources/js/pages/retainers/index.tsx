import { Head, Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { PersonCell } from '@/components/person-cell';
import { StatusBadge } from '@/components/status-badge';
import { DateCell, IdBadge } from '@/components/table-cells';
import { FilterSelect, StatusTabs } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import retainerRoutes from '@/routes/retainers';
import type { Paginated, TableFilters } from '@/types';
import { RetainerActions } from './actions';
import type { CustomerOption, Retainer } from './types';

export default function Retainers({
    retainers,
    counts,
    customers,
    filters,
}: {
    retainers: Paginated<Retainer>;
    counts: Record<string, number>;
    customers: CustomerOption[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const url = retainerRoutes.index();
    const amount = (value: string, bold = false) => (
        <span
            className={
                bold ? 'font-semibold whitespace-nowrap' : 'whitespace-nowrap'
            }
        >
            {money(Number(value))}
        </span>
    );

    const columns: Column<Retainer>[] = [
        {
            key: 'retainer_number',
            label: 'Retainer Number',
            sortable: true,
            render: (p) => (
                <Link href={retainerRoutes.show(p.id)}>
                    <IdBadge>{p.retainer_number}</IdBadge>
                </Link>
            ),
        },
        {
            key: 'customer',
            label: 'Customer',
            render: (p) => (
                <div className="max-w-32">
                    <PersonCell
                        name={p.customer.name}
                        detail={p.customer.email}
                    />
                </div>
            ),
        },
        {
            key: 'retainer_date',
            label: 'Retainer Date',
            sortable: true,
            render: (p) => <DateCell value={p.retainer_date} />,
        },
        {
            key: 'due_date',
            label: 'Due Date',
            sortable: true,
            render: (p) =>
                p.display_status === 'overdue' ? (
                    <div className="text-destructive">
                        <DateCell value={p.due_date} />
                        <div className="text-xs">{t('Overdue')}</div>
                    </div>
                ) : (
                    <DateCell value={p.due_date} />
                ),
        },
        {
            key: 'subtotal',
            label: 'Subtotal',
            sortable: true,
            render: (p) => amount(p.subtotal),
        },
        {
            key: 'tax_amount',
            label: 'Tax',
            sortable: true,
            render: (p) => amount(p.tax_amount),
        },
        {
            key: 'total_amount',
            label: 'Total Amount',
            sortable: true,
            render: (p) => amount(p.total_amount, true),
        },
        {
            key: 'status',
            label: 'Status',
            render: (p) => <StatusBadge status={p.status} />,
        },
    ];

    return (
        <>
            <Head title={t('Retainers')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Retainers"
                    description="Manage and track your retainers, advance payments, and conversions."
                    action={
                        can('create-retainer') && (
                            <Button asChild>
                                <Link href={retainerRoutes.create()}>
                                    <Plus /> {t('Create Retainer')}
                                </Link>
                            </Button>
                        )
                    }
                />

                <DataTable
                    data={retainers}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <>
                            {can('manage-any-retainer') && (
                                <FilterSelect
                                    url={url}
                                    filters={filters}
                                    name="customer_id"
                                    label="All Customers"
                                    options={customers}
                                />
                            )}
                        </>
                    }
                    tabs={
                        <StatusTabs
                            url={url}
                            filters={filters}
                            counts={counts}
                        />
                    }
                    actions={(retainer) => (
                        <RetainerActions retainer={retainer} />
                    )}
                    renderCard={(r, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <Link href={retainerRoutes.show(r.id)}>
                                    <IdBadge>{r.retainer_number}</IdBadge>
                                </Link>
                                <StatusBadge status={r.display_status} />
                            </div>
                            <PersonCell
                                name={r.customer.name}
                                detail={r.customer.email}
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
                                        {t('Balance')}
                                    </div>
                                    <div className="font-semibold">
                                        {money(Number(r.balance_amount))}
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {date(r.retainer_date)} · {t('Due')}{' '}
                                {date(r.due_date)}
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

Retainers.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Retainers', href: retainerRoutes.index() },
    ],
};
