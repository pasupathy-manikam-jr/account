import { Head, Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { PersonCell } from '@/components/person-cell';
import { StatusBadge } from '@/components/status-badge';
import { DateCell, IdBadge } from '@/components/table-cells';
import { DateRangeFilter, FilterSelect } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import purchaseInvoices from '@/routes/purchase-invoices';
import type { CustomerOption as VendorOption } from '@/pages/sales-proposals/types';
import type { Paginated, TableFilters } from '@/types';
import { InvoiceActions } from './actions';
import type { Invoice } from './types';

const ucfirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function PurchaseInvoices({
    invoices,
    vendors,
    warehouses,
    filters,
}: {
    invoices: Paginated<Invoice>;
    vendors: VendorOption[];
    warehouses: { id: number; name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const url = purchaseInvoices.index();
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
                <Link href={purchaseInvoices.show(i.id)}>
                    <IdBadge>{i.invoice_number}</IdBadge>
                </Link>
            ),
        },
        {
            key: 'vendor',
            label: 'Vendor',
            render: (i) => (
                <div className="max-w-32">
                    <PersonCell name={i.vendor.name} detail={i.vendor.email} />
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
            <Head title={t('Purchase Invoices')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Purchase Invoices"
                    description="Manage and track your purchase invoices, payments, and balances."
                    action={
                        can('create-purchase-invoices') && (
                            <Button asChild>
                                <Link href={purchaseInvoices.create()}>
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
                            {can('manage-any-purchase-invoices') && (
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
                            <DateRangeFilter url={url} filters={filters} />
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
                        </>
                    }
                    actions={(invoice) => <InvoiceActions invoice={invoice} />}
                    renderCard={(i, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <Link href={purchaseInvoices.show(i.id)}>
                                    <IdBadge>{i.invoice_number}</IdBadge>
                                </Link>
                                <StatusBadge status={i.display_status} />
                            </div>
                            <PersonCell
                                name={i.vendor.name}
                                detail={i.vendor.email}
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
                                    <div
                                        className={
                                            Number(i.balance_amount) > 0
                                                ? 'font-semibold text-rose-600'
                                                : 'font-semibold text-emerald-600'
                                        }
                                    >
                                        {money(Number(i.balance_amount))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>
                                    {date(i.invoice_date)} · {t('Due')}{' '}
                                    {date(i.due_date)}
                                </span>
                                {i.warehouse && (
                                    <span className="truncate">
                                        {i.warehouse.name}
                                    </span>
                                )}
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

PurchaseInvoices.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Purchase Invoice', href: purchaseInvoices.index() },
    ],
};
