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
import retainerPayments from '@/routes/retainer-payments';
import type { Paginated, TableFilters } from '@/types';
import { PaymentActions } from './actions';
import type { RetainerPayment } from './types';

export default function RetainerPayments({
    payments,
    counts,
    customers,
    bankAccounts,
    filters,
}: {
    payments: Paginated<RetainerPayment>;
    counts: Record<string, number>;
    customers: { id: number; name: string }[];
    bankAccounts: { id: number; name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const can = useCan();
    const url = retainerPayments.index();

    const columns: Column<RetainerPayment>[] = [
        {
            key: 'payment_number',
            label: 'Payment Number',
            sortable: true,
            render: (p) => (
                <Link href={retainerPayments.show(p.id)}>
                    <IdBadge>{p.payment_number}</IdBadge>
                </Link>
            ),
        },
        {
            key: 'customer',
            label: 'Customer',
            render: (p) => (
                <PersonCell name={p.customer.name} detail={p.customer.email} />
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
            <Head title={t('Retainer Payments')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Retainer Payments"
                    description="Record advance payments against retainers and clear them once the money is banked."
                    action={
                        can('create-retainer-payments') && (
                            <Button asChild>
                                <Link href={retainerPayments.create()}>
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
                            {can('manage-any-retainer-payments') && (
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

RetainerPayments.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Retainer Payments', href: retainerPayments.index() },
    ],
};
