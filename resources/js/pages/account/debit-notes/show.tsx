import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    FileText,
    Receipt,
    RotateCcw,
    User,
} from 'lucide-react';
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
import purchaseInvoices from '@/routes/purchase-invoices';
import purchaseReturns from '@/routes/purchase-returns';
import { DebitNoteActions } from './actions';
import type { DebitNote } from './types';

export default function DebitNoteShow({
    debitNote: n,
}: {
    debitNote: DebitNote;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();

    return (
        <>
            <Head title={n.debit_note_number} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">
                            {t('Debit Note')} #{n.debit_note_number}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'View details, applied payments, items, and validation history for this debit note.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={account.debitNotes.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard icon={Receipt} title="Debit Note Items">
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
                                <DebitNoteActions note={n} showView={false} />
                            </div>
                        </DocCard>
                        <DocCard icon={User} title="Vendor Info">
                            <PersonCell
                                name={n.vendor.name}
                                detail={n.vendor.email}
                            />
                        </DocCard>
                        <DocCard icon={CalendarDays} title="Debit Note Details">
                            <div className="grid gap-5">
                                <Fact icon={CalendarDays} label="Date">
                                    {date(n.debit_note_date)}
                                </Fact>
                                <Fact icon={Receipt} label="Invoice">
                                    {can('view-purchase-invoices') ? (
                                        <Link
                                            href={purchaseInvoices.show(
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
                                {n.purchase_return && (
                                    <Fact
                                        icon={RotateCcw}
                                        label="Purchase Return"
                                    >
                                        {can(
                                            'view-purchase-return-invoices',
                                        ) ? (
                                            <Link
                                                href={purchaseReturns.show(
                                                    n.purchase_return.id,
                                                )}
                                            >
                                                <IdBadge>
                                                    {
                                                        n.purchase_return
                                                            .return_number
                                                    }
                                                </IdBadge>
                                            </Link>
                                        ) : (
                                            n.purchase_return.return_number
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

DebitNoteShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Debit Notes', href: account.debitNotes.index() },
        { title: 'Debit Note Details', href: account.debitNotes.index() },
    ],
};
