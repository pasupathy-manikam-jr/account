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
import salesProposals from '@/routes/sales-proposals';
import type { Paginated, TableFilters } from '@/types';
import { ProposalActions } from './actions';
import type { CustomerOption, Proposal } from './types';

export default function SalesProposals({
    proposals,
    customers,
    filters,
}: {
    proposals: Paginated<Proposal>;
    customers: CustomerOption[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const url = salesProposals.index();
    const amount = (value: string, bold = false) => (
        <span
            className={
                bold ? 'font-semibold whitespace-nowrap' : 'whitespace-nowrap'
            }
        >
            {money(Number(value))}
        </span>
    );

    const columns: Column<Proposal>[] = [
        {
            key: 'proposal_number',
            label: 'Proposal Number',
            sortable: true,
            render: (p) => (
                <Link href={salesProposals.show(p.id)}>
                    <IdBadge>{p.proposal_number}</IdBadge>
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
            key: 'proposal_date',
            label: 'Proposal Date',
            sortable: true,
            render: (p) => <DateCell value={p.proposal_date} />,
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
            key: 'balance',
            label: 'Balance',
            // Unpaid until invoiced; then whatever is left on the invoice. Nothing is owed on a rejected one.
            render: (p) =>
                p.status === 'rejected' ? (
                    '-'
                ) : (
                    <div>
                        {amount(
                            p.invoice
                                ? p.invoice.balance_amount
                                : p.total_amount,
                            true,
                        )}
                        {p.invoice && (
                            <div className="text-xs text-muted-foreground">
                                {t('on invoice')}
                            </div>
                        )}
                    </div>
                ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (p) => <StatusBadge status={p.status} />,
        },
    ];

    return (
        <>
            <Head title={t('Proposals')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Proposals"
                    description="Manage and track your sales proposals, statuses, and values."
                    action={
                        can('create-sales-proposals') && (
                            <Button asChild>
                                <Link href={salesProposals.create()}>
                                    <Plus /> {t('Create Proposal')}
                                </Link>
                            </Button>
                        )
                    }
                />

                <DataTable
                    data={proposals}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <>
                            {can('manage-any-sales-proposals') && (
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
                                name="status"
                                label="All Statuses"
                                options={[
                                    'draft',
                                    'sent',
                                    'accepted',
                                    'rejected',
                                ].map((s) => ({
                                    id: s,
                                    name: t(
                                        s.charAt(0).toUpperCase() + s.slice(1),
                                    ),
                                }))}
                            />
                        </>
                    }
                    renderCard={(p, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <Link href={salesProposals.show(p.id)}>
                                    <IdBadge>{p.proposal_number}</IdBadge>
                                </Link>
                                <StatusBadge status={p.display_status} />
                            </div>
                            <PersonCell
                                name={p.customer.name}
                                detail={p.customer.email}
                            />
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Total Amount')}
                                    </div>
                                    <div className="font-semibold">
                                        {money(Number(p.total_amount))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Balance')}
                                    </div>
                                    <div className="font-semibold">
                                        {p.status === 'rejected'
                                            ? '-'
                                            : money(
                                                  Number(
                                                      p.invoice
                                                          ? p.invoice
                                                                .balance_amount
                                                          : p.total_amount,
                                                  ),
                                              )}
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {date(p.proposal_date)} · {t('Due')}{' '}
                                {date(p.due_date)}
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                    actions={(proposal) => (
                        <ProposalActions proposal={proposal} />
                    )}
                />
            </div>
        </>
    );
}

SalesProposals.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Proposals', href: salesProposals.index() },
    ],
};
