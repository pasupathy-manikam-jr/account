import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Building2,
    CalendarDays,
    Clock,
    Download,
    FileText,
    Receipt,
    User,
    Warehouse,
} from 'lucide-react';
import { EInvoiceCard } from '@/components/einvoice-card';
import type { EInvoiceSummary } from '@/components/einvoice-card';
import { PersonCell } from '@/components/person-cell';
import {
    DocCard,
    Fact,
    LineItemsTable,
    TotalsList,
} from '@/components/sales-document';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import salesInvoices from '@/routes/sales-invoices';
import { InvoiceActions } from './actions';
import type { Invoice } from './types';

type Address = Partial<
    Record<
        | 'name'
        | 'address_line_1'
        | 'address_line_2'
        | 'city'
        | 'state'
        | 'country'
        | 'zip_code',
        string | null
    >
>;

type ShownInvoice = Invoice & {
    warehouse: { id: number; name: string } | null;
    customer: Invoice['customer'] & {
        customer: {
            company_name: string;
            contact_person_mobile: string | null;
            billing_address: Address | null;
            shipping_address: Address | null;
        } | null;
    };
};

function AddressBlock({
    label,
    address,
}: {
    label: string;
    address: Address | null | undefined;
}) {
    const { t } = useTranslation();

    if (!address) {
        return null;
    }

    return (
        <div>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t(label)}
            </div>
            <div className="mt-1 text-sm">
                {[
                    address.name,
                    address.address_line_1,
                    address.address_line_2,
                    [address.zip_code, address.city].filter(Boolean).join(' '),
                    address.state,
                    address.country,
                ]
                    .filter(Boolean)
                    .map((line) => (
                        <div key={line}>{line}</div>
                    ))}
            </div>
        </div>
    );
}

export default function InvoiceShow({
    invoice,
    company,
    einvoice,
}: {
    invoice: ShownInvoice;
    company: { name: string };
    einvoice: EInvoiceSummary;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const overdue = invoice.display_status === 'overdue';
    const record = invoice.customer.customer;

    return (
        <>
            <Head title={invoice.invoice_number} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">
                            {t('Sales Invoice')} #{invoice.invoice_number}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'View details, items, payment status, and actions for this sales invoice.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={salesInvoices.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard icon={Building2} title="Billing & Addresses">
                            <div className="grid gap-6 md:grid-cols-2">
                                <div>
                                    <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                        {t('Billed From')}
                                    </div>
                                    <div className="mt-1 text-lg font-semibold">
                                        {company.name}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                        {t('Billed To')}
                                    </div>
                                    <div className="mt-1 text-lg font-semibold">
                                        {record?.company_name ??
                                            invoice.customer.name}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {invoice.customer.name} ·{' '}
                                        {invoice.customer.email}
                                    </div>
                                    <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
                                        <AddressBlock
                                            label="Billing Address"
                                            address={record?.billing_address}
                                        />
                                        <AddressBlock
                                            label="Shipping Address"
                                            address={
                                                record?.shipping_address ??
                                                record?.billing_address
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        </DocCard>

                        <DocCard icon={Receipt} title="Invoice Items">
                            <LineItemsTable lines={invoice.items ?? []} />
                            <TotalsList
                                className="ms-auto mt-4 grid max-w-xs gap-2 text-sm"
                                subtotal={Number(invoice.subtotal)}
                                discount={Number(invoice.discount_amount)}
                                tax={Number(invoice.tax_amount)}
                                total={Number(invoice.total_amount)}
                                paid={Number(invoice.paid_amount)}
                                balance={Number(invoice.balance_amount)}
                            />
                        </DocCard>

                        {invoice.notes && (
                            <DocCard icon={FileText} title="Additional Notes">
                                <p className="text-sm whitespace-pre-line">
                                    {invoice.notes}
                                </p>
                            </DocCard>
                        )}
                    </div>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={Receipt} title="Summary & Actions">
                            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t('Balance Due')}
                            </div>
                            <div className="mt-1 text-3xl font-bold">
                                {money(Number(invoice.balance_amount))}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <StatusBadge status={invoice.status} />
                                {overdue && <StatusBadge status="overdue" />}
                            </div>
                            <div className="mt-6 grid gap-2">
                                {can('print-sales-invoices') && (
                                    <Button variant="outline" asChild>
                                        <a
                                            href={
                                                salesInvoices.pdf(invoice.id)
                                                    .url
                                            }
                                        >
                                            <Download /> {t('Download PDF')}
                                        </a>
                                    </Button>
                                )}
                                {invoice.status === 'draft' && (
                                    <div className="flex flex-wrap justify-center gap-1 rounded-lg border p-1">
                                        <InvoiceActions invoice={invoice} />
                                    </div>
                                )}
                            </div>
                        </DocCard>
                        <EInvoiceCard
                            einvoice={einvoice}
                            type="sales-invoices"
                            documentId={invoice.id}
                            ready={invoice.status !== 'draft'}
                            permission="post-sales-invoices"
                        />
                        <DocCard icon={User} title="Customer Info">
                            <PersonCell
                                name={invoice.customer.name}
                                detail={invoice.customer.email}
                            />
                            {record?.contact_person_mobile && (
                                <div className="mt-3 text-sm text-muted-foreground">
                                    {record.contact_person_mobile}
                                </div>
                            )}
                        </DocCard>
                        <DocCard icon={CalendarDays} title="Invoice Details">
                            <div className="grid gap-5">
                                <Fact icon={CalendarDays} label="Invoice Date">
                                    {date(invoice.invoice_date)}
                                </Fact>
                                <Fact icon={CalendarDays} label="Due Date">
                                    <span
                                        className={
                                            overdue
                                                ? 'text-destructive'
                                                : undefined
                                        }
                                    >
                                        {date(invoice.due_date)}
                                    </span>
                                </Fact>
                                <Fact
                                    icon={Warehouse}
                                    label={
                                        invoice.warehouse ? 'Warehouse' : 'Type'
                                    }
                                >
                                    {invoice.warehouse ? (
                                        <IdBadge>
                                            {invoice.warehouse.name}
                                        </IdBadge>
                                    ) : (
                                        <StatusBadge status={invoice.type} />
                                    )}
                                </Fact>
                                <Fact icon={Clock} label="Terms">
                                    {invoice.payment_terms || '-'}
                                </Fact>
                            </div>
                        </DocCard>
                    </div>
                </div>
            </div>
        </>
    );
}

InvoiceShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Sales Invoice', href: salesInvoices.index() },
        { title: 'Sales Invoice Details', href: salesInvoices.index() },
    ],
};
