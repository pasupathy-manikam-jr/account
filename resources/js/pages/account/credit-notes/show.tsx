import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    FileText,
    Receipt,
    RotateCcw,
    User,
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
import account from '@/routes/account';
import salesInvoices from '@/routes/sales-invoices';
import salesReturns from '@/routes/sales-returns';
import { CreditNoteActions } from './actions';
import type { CreditNote } from './types';

export default function CreditNoteShow({
    creditNote: n,
    einvoice,
}: {
    creditNote: CreditNote;
    einvoice: EInvoiceSummary;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();

    return (
        <>
            <Head title={n.credit_note_number} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">
                            {t('Credit Note')} #{n.credit_note_number}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'View details, applied payments, items, and validation history for this credit note.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={account.creditNotes.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard icon={Receipt} title="Credit Note Items">
                            <LineItemsTable lines={n.items ?? []} />
                            <TotalsList
                                className="ms-auto mt-4 grid max-w-xs gap-2 text-sm"
                                subtotal={Number(n.subtotal)}
                                discount={Number(n.discount_amount)}
                                tax={Number(n.tax_amount)}
                                total={Number(n.total_amount)}
                                paid={Number(n.applied_amount)}
                                balance={Number(n.balance_amount)}
                                paidLabel="Applied Amount"
                                balanceLabel="Balance Amount"
                            />
                        </DocCard>
                        {n.notes && (
                            <DocCard icon={FileText} title="Additional Notes">
                                <p className="text-sm whitespace-pre-line">
                                    {n.notes}
                                </p>
                            </DocCard>
                        )}
                    </div>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={Receipt} title="Summary & Actions">
                            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t('Balance Amount')}
                            </div>
                            <div className="mt-1 text-3xl font-bold">
                                {money(Number(n.balance_amount))}
                            </div>
                            <div className="mt-2">
                                <StatusBadge status={n.status} />
                            </div>
                            <div className="mt-6 flex flex-wrap justify-center gap-1 rounded-lg border p-1 empty:hidden">
                                <CreditNoteActions note={n} showView={false} />
                            </div>
                        </DocCard>
                        <EInvoiceCard
                            einvoice={einvoice}
                            type="credit-notes"
                            documentId={n.id}
                            ready={n.status !== 'draft'}
                            permission="approve-credit-notes"
                        />
                        <DocCard icon={User} title="Customer Info">
                            <PersonCell
                                name={n.customer.name}
                                detail={n.customer.email}
                            />
                        </DocCard>
                        <DocCard
                            icon={CalendarDays}
                            title="Credit Note Details"
                        >
                            <div className="grid gap-5">
                                <Fact icon={CalendarDays} label="Date">
                                    {date(n.credit_note_date)}
                                </Fact>
                                <Fact icon={Receipt} label="Invoice">
                                    {can('view-sales-invoices') ? (
                                        <Link
                                            href={salesInvoices.show(
                                                n.invoice.id,
                                            )}
                                        >
                                            <IdBadge>
                                                {n.invoice.invoice_number}
                                            </IdBadge>
                                        </Link>
                                    ) : (
                                        n.invoice.invoice_number
                                    )}
                                </Fact>
                                {n.sales_return && (
                                    <Fact icon={RotateCcw} label="Sales Return">
                                        {can('view-sales-return-invoices') ? (
                                            <Link
                                                href={salesReturns.show(
                                                    n.sales_return.id,
                                                )}
                                            >
                                                <IdBadge>
                                                    {
                                                        n.sales_return
                                                            .return_number
                                                    }
                                                </IdBadge>
                                            </Link>
                                        ) : (
                                            n.sales_return.return_number
                                        )}
                                    </Fact>
                                )}
                                <Fact icon={FileText} label="Reason">
                                    {n.reason}
                                </Fact>
                                {n.approver && (
                                    <Fact icon={User} label="Approved By">
                                        {n.approver.name}
                                    </Fact>
                                )}
                            </div>
                        </DocCard>
                    </div>
                </div>
            </div>
        </>
    );
}

CreditNoteShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Credit Notes', href: account.creditNotes.index() },
        { title: 'Credit Note Details', href: account.creditNotes.index() },
    ],
};
