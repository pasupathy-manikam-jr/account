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
import salesInvoices from '@/routes/sales-invoices';
import type { CustomerOption } from '@/pages/sales-proposals/types';
import type { Paginated, TableFilters } from '@/types';
import { InvoiceActions } from './actions';
import type { Invoice } from './types';

const ucfirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function SalesInvoices({
    invoices,
    customers,
    warehouses,
    filters,
}: {
    invoices: Paginated<Invoice>;
    customers: CustomerOption[];
    warehouses: { id: number; name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const url = salesInvoices.index();
    const amount = (value: string, className = '') => (
        <span className={`whitespace-nowrap ${className}`}>
            {money(Number(value))}
        </span>
    );

    const columns: Column<Invoice>[] = [
        {
            key: 'invoice_number',
            label: 'Invoice Number',
            sortable: true,
            render: (i) => (
                <Link href={salesInvoices.show(i.id)}>
                    <IdBadge>{i.invoice_number}</IdBadge>
                </Link>
            ),
        },
        {
            key: 'customer',
            label: 'Customer',
            render: (i) => (
                <div className="max-w-32">
                    <PersonCell
                        name={i.customer.name}
                        detail={i.customer.email}
                    />
                </div>
            ),
        },
        {
            key: 'invoice_date',
            label: 'Invoice Date',
            sortable: true,
            render: (i) => <DateCell value={i.invoice_date} />,
        },
        {
            key: 'due_date',
            label: 'Due Date',
            sortable: true,
            render: (i) =>
                i.display_status === 'overdue' ? (
                    <div className="text-destructive">
                        <DateCell value={i.due_date} />
                        <div className="text-xs">{t('Overdue')}</div>
                    </div>
                ) : (
                    <DateCell value={i.due_date} />
                ),
        },
        {
            key: 'subtotal',
            label: 'Subtotal',
            sortable: true,
            render: (i) => amount(i.subtotal),
        },
        {
            key: 'tax_amount',
            label: 'Tax',
            sortable: true,
            render: (i) => amount(i.tax_amount),
        },
        {
            key: 'total_amount',
            label: 'Total Amount',
            sortable: true,
            render: (i) => amount(i.total_amount, 'font-semibold'),
        },
        {
            key: 'balance',
            label: 'Balance',
            render: (i) => amount(i.balance_amount, 'font-semibold'),
        },
        {
            key: 'status',
            label: 'Status',
            render: (i) => <StatusBadge status={i.status} />,
        },
    ];

    return (
        <>
            <Head title={t('Sales Invoices')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Sales Invoices"
                    description="Manage and track your sales invoices, payments, and balances."
                    action={
                        can('create-sales-invoices') && (
                            <Button asChild>
                                <Link href={salesInvoices.create()}>
                                    <Plus /> {t('Create Invoice')}
                                </Link>
                            </Button>
                        )
                    }
                />

                <DataTable
                    data={invoices}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <>
                            {can('manage-any-sales-invoices') && (
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
                                name="warehouse_id"
                                label="All Warehouses"
                                options={warehouses}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="status"
                                label="All Statuses"
                                options={[
                                    'draft',
                                    'posted',
                                    'partial',
                                    'paid',
                                ].map((s) => ({ id: s, name: t(ucfirst(s)) }))}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="type"
                                label="All Types"
                                options={['product', 'service'].map((s) => ({
                                    id: s,
                                    name: t(ucfirst(s)),
                                }))}
                            />
                        </>
                    }
                    renderCard={(i, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <Link href={salesInvoices.show(i.id)}>
                                    <IdBadge>{i.invoice_number}</IdBadge>
                                </Link>
                                <StatusBadge status={i.display_status} />
                            </div>
                            <PersonCell
                                name={i.customer.name}
                                detail={i.customer.email}
                            />
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Total Amount')}
                                    </div>
                                    <div className="font-semibold">
                                        {money(Number(i.total_amount))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Balance')}
                                    </div>
                                    <div className="font-semibold">
                                        {money(Number(i.balance_amount))}
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {date(i.invoice_date)} · {t('Due')}{' '}
                                {date(i.due_date)}
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                    actions={(invoice) => <InvoiceActions invoice={invoice} />}
                />
            </div>
        </>
    );
}

SalesInvoices.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Sales Invoice', href: salesInvoices.index() },
    ],
};
