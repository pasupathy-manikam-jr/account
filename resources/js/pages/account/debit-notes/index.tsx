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
import purchaseReturns from '@/routes/purchase-returns';
import type { Paginated, TableFilters } from '@/types';
import { DebitNoteActions } from './actions';
import type { DebitNote } from './types';

export default function DebitNotes({
    debitNotes,
    counts,
    vendors,
    returns,
    filters,
}: {
    debitNotes: Paginated<DebitNote>;
    counts: Record<string, number>;
    vendors: { id: number; name: string }[];
    returns: { id: number; name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const { money } = useFormat();
    const url = account.debitNotes.index();
    const amount = (value: string, className = '') => (
        <span className={`whitespace-nowrap ${className}`}>
            {money(Number(value))}
        </span>
    );

    const columns: Column<DebitNote>[] = [
        {
            key: 'debit_note_number',
            label: 'Debit Note Number',
            sortable: true,
            render: (n) => (
                <Link href={account.debitNotes.show(n.id)}>
                    <IdBadge>{n.debit_note_number}</IdBadge>
                </Link>
            ),
        },
        {
            key: 'return',
            label: 'Purchase Return',
            render: (n) =>
                n.purchase_return ? (
                    <Link href={purchaseReturns.show(n.purchase_return.id)}>
                        <IdBadge>{n.purchase_return.return_number}</IdBadge>
                    </Link>
                ) : (
                    <span className="text-muted-foreground">-</span>
                ),
        },
        {
            key: 'vendor',
            label: 'Vendor',
            render: (n) => (
                <PersonCell name={n.vendor.name} detail={n.vendor.email} />
            ),
        },
        {
            key: 'debit_note_date',
            label: 'Date',
            sortable: true,
            render: (n) => <DateCell value={n.debit_note_date} />,
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
            <Head title={t('Debit Notes')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Debit Notes"
                    description="Debit notes raised from completed purchase returns, and how much of each has been applied."
                />
                <MonthFilter url={url} filters={filters} />
                <DataTable
                    data={debitNotes}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <>
                            {can('manage-any-debit-notes') && (
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
                    actions={(n) => <DebitNoteActions note={n} />}
                />
            </div>
        </>
    );
}

DebitNotes.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.chartOfAccounts.index() },
        { title: 'Debit Notes', href: account.debitNotes.index() },
    ],
};
