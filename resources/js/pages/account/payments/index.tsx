import { Head, Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { MonthFilter } from '@/components/month-filter';
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
import account from '@/routes/account';
import type { Paginated, TableFilters } from '@/types';
import { PaymentActions } from './actions';
import { kindConfig } from './types';
import type { Kind, Payment } from './types';

export default function Payments({
    kind,
    payments,
    counts,
    parties,
    bankAccounts,
    filters,
}: {
    kind: Kind;
    payments: Paginated<Payment>;
    counts: Record<string, number>;
    parties: { id: number; name: string }[];
    bankAccounts: { id: number; name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const can = useCan();
    const config = kindConfig(kind);
    const url = config.routes.index();

    const columns: Column<Payment>[] = [
        {
            key: 'payment_number',
            label: 'Payment Number',
            sortable: true,
            render: (p) => (
                <Link href={config.routes.show(p.id)}>
                    <IdBadge>{p.payment_number}</IdBadge>
                </Link>
            ),
        },
        {
            key: 'party',
            label: config.party,
            render: (p) => (
                <PersonCell name={p.party.name} detail={p.party.email} />
            ),
        },
        {
            key: 'payment_date',
            label: 'Payment Date',
            sortable: true,
            render: (p) => <DateCell value={p.payment_date} />,
        },
        {
            key: 'bank',
            label: 'Bank Account',
            render: (p) => (
                <div className="whitespace-nowrap">
                    <div>{p.bank_account.account_name}</div>
                    <div className="text-xs text-muted-foreground">
                        {p.bank_account.bank_name}
                    </div>
                </div>
            ),
        },
        {
            key: 'payment_amount',
            label: 'Amount',
            sortable: true,
            render: (p) => (
                <span className="font-semibold whitespace-nowrap">
                    {money(Number(p.payment_amount))}
                </span>
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
            <Head title={t(config.title)} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title={
                        kind === 'customer'
                            ? 'Manage Customer Payments'
                            : 'Manage Vendor Payments'
                    }
                    description={
                        kind === 'customer'
                            ? 'Record money received from customers against their invoices, and apply credit notes.'
                            : 'Record money paid to vendors against their bills, and apply debit notes.'
                    }
                    action={
                        can(`create-${config.perm}`) && (
                            <Button asChild>
                                <Link href={config.routes.create()}>
                                    <Plus /> {t('Add Payment')}
                                </Link>
                            </Button>
                        )
                    }
                />
                <MonthFilter url={url} filters={filters} />
                <DataTable
                    data={payments}
                    columns={columns}
                    filters={filters}
                    url={url}
                    tabs={
                        <StatusTabs
                            url={url}
                            filters={filters}
                            counts={counts}
                        />
                    }
                    moreFilters={
                        <>
                            {can(`manage-any-${kind}-payments`) && (
                                <FilterSelect
                                    url={url}
                                    filters={filters}
                                    name="party_id"
                                    label={
                                        kind === 'customer'
                                            ? 'All Customers'
                                            : 'All Vendors'
                                    }
                                    options={parties}
                                />
                            )}
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="bank_account_id"
                                label="All Bank Accounts"
                                options={bankAccounts}
                            />
                        </>
                    }
                    actions={(p) => <PaymentActions payment={p} />}
                />
            </div>
        </>
    );
}

Payments.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.chartOfAccounts.index() },
    ],
};
