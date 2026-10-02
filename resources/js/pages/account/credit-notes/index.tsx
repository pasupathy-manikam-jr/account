import { Head, Link } from '@inertiajs/react';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { MonthFilter } from '@/components/month-filter';
import { PageHeader } from '@/components/page-header';
import { PersonCell } from '@/components/person-cell';
import { StatusBadge } from '@/components/status-badge';
import { DateCell, IdBadge } from '@/components/table-cells';
import { FilterSelect, StatusTabs } from '@/components/table-filters';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import account from '@/routes/account';
import salesReturns from '@/routes/sales-returns';
import type { Paginated, TableFilters } from '@/types';
import { CreditNoteActions } from './actions';
import type { CreditNote } from './types';

export default function CreditNotes({
    creditNotes,
    counts,
    customers,
    returns,
    filters,
}: {
    creditNotes: Paginated<CreditNote>;
    counts: Record<string, number>;
    customers: { id: number; name: string }[];
    returns: { id: number; name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const { money } = useFormat();
    const url = account.creditNotes.index();
    const amount = (value: string, className = '') => (
        <span className={`whitespace-nowrap ${className}`}>
            {money(Number(value))}
        </span>
    );

    const columns: Column<CreditNote>[] = [
        {
            key: 'credit_note_number',
            label: 'Credit Note Number',
            sortable: true,
            render: (n) => (
                <Link href={account.creditNotes.show(n.id)}>
                    <IdBadge>{n.credit_note_number}</IdBadge>
                </Link>
            ),
        },
        {
            key: 'return',
            label: 'Sales Return',
            render: (n) =>
                n.sales_return ? (
                    <Link href={salesReturns.show(n.sales_return.id)}>
                        <IdBadge>{n.sales_return.return_number}</IdBadge>
                    </Link>
                ) : (
                    <span className="text-muted-foreground">-</span>
                ),
        },
        {
            key: 'customer',
            label: 'Customer',
            render: (n) => (
                <PersonCell name={n.customer.name} detail={n.customer.email} />
            ),
        },
        {
            key: 'credit_note_date',
            label: 'Date',
            sortable: true,
            render: (n) => <DateCell value={n.credit_note_date} />,
        },
        {
            key: 'total_amount',
            label: 'Total Amount',
            sortable: true,
            render: (n) => amount(n.total_amount, 'font-semibold'),
        },
        {
            key: 'balance',
            label: 'Balance',
            render: (n) => amount(n.balance_amount, 'font-semibold'),
        },
        {
            key: 'status',
            label: 'Status',
            render: (n) => <StatusBadge status={n.status} />,
        },
        {
            key: 'approver',
            label: 'Approved By',
            render: (n) =>
                n.approver ? (
                    <span>{n.approver.name}</span>
                ) : (
                    <span className="text-muted-foreground">-</span>
                ),
        },
    ];

    return (
        <>
            <Head title={t('Credit Notes')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Credit Notes"
                    description="Credit notes raised from completed sales returns, and how much of each has been applied."
                />
                <MonthFilter url={url} filters={filters} />
                <DataTable
                    data={creditNotes}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <>
                            {can('manage-any-credit-notes') && (
                                <FilterSelect
                                    url={url}
                                    filters={filters}
                                    name="customer_id"
                                    label="All Customers"
                                    options={customers}
                                />
                            )}
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="return_id"
                                label="All Returns"
                                options={returns}
                            />
                        </>
                    }
                    tabs={
                        <StatusTabs
                            url={url}
                            filters={filters}
                            counts={counts}
                        />
                    }
                    actions={(n) => <CreditNoteActions note={n} />}
                />
            </div>
        </>
    );
}

CreditNotes.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.chartOfAccounts.index() },
        { title: 'Credit Notes', href: account.creditNotes.index() },
    ],
};
