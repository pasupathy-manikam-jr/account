import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    FileText,
    Receipt,
    RotateCcw,
    User,
    Warehouse,
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
import { ReturnActions } from './actions';
import { reasonLabel } from './types';
import type { PurchaseReturn } from './types';

export default function ReturnShow({
    purchaseReturn: r,
}: {
    purchaseReturn: PurchaseReturn;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();

    return (
        <>
            <Head title={r.return_number} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">
                            {t('Purchase Return')} #{r.return_number}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'View the returned items, their value, and the return status.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={purchaseReturns.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard
                            icon={RotateCcw}
                            title="Purchase Return Details"
                        >
                            <div className="grid gap-6 sm:grid-cols-2">
                                <Fact icon={CalendarDays} label="Return Date">
                                    {date(r.return_date)}
                                </Fact>
                                <Fact icon={Warehouse} label="Warehouse">
                                    <IdBadge>{r.warehouse.name}</IdBadge>
                                </Fact>
                                <Fact icon={Receipt} label="Original Invoice">
                                    {r.original_invoice &&
                                    can('view-purchase-invoices') ? (
                                        <Link
                                            href={purchaseInvoices.show(
                                                r.original_invoice.id,
                                            )}
                                        >
                                            <IdBadge>
                                                {
                                                    r.original_invoice
                                                        .invoice_number
                                                }
                                            </IdBadge>
                                        </Link>
                                    ) : (
                                        r.original_invoice?.invoice_number
                                    )}
                                </Fact>
                                <Fact icon={FileText} label="Return Reason">
                                    {t(reasonLabel(r.reason))}
                                </Fact>
                            </div>
                        </DocCard>
                        <DocCard icon={Receipt} title="Return Items">
                            <LineItemsTable lines={r.items} />
                            <TotalsList
                                className="ms-auto mt-4 grid max-w-xs gap-2 text-sm"
                                subtotal={Number(r.subtotal)}
                                discount={Number(r.discount_amount)}
                                tax={Number(r.tax_amount)}
                                total={Number(r.total_amount)}
                            />
                        </DocCard>
                        {r.notes && (
                            <DocCard icon={FileText} title="Additional Notes">
                                <p className="text-sm whitespace-pre-line">
                                    {r.notes}
                                </p>
                            </DocCard>
                        )}
                    </div>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={Receipt} title="Summary & Actions">
                            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t('Return Total')}
                            </div>
                            <div className="mt-1 text-3xl font-bold">
                                {money(Number(r.total_amount))}
                            </div>
                            <div className="mt-2">
                                <StatusBadge status={r.status} />
                            </div>
                            <div className="mt-6 flex flex-wrap justify-center gap-1 rounded-lg border p-1 empty:hidden">
                                <ReturnActions
                                    purchaseReturn={r}
                                    showView={false}
                                />
                            </div>
                            {r.debit_note && can('view-debit-notes') && (
                                <Button
                                    variant="outline"
                                    className="mt-3 w-full"
                                    asChild
                                >
                                    <Link
                                        href={account.debitNotes.show(
                                            r.debit_note.id,
                                        )}
                                    >
                                        <FileText /> {t('View Debit Note')}{' '}
                                        {r.debit_note.debit_note_number}
                                    </Link>
                                </Button>
                            )}
                        </DocCard>
                        <DocCard icon={User} title="Vendor Info">
                            <PersonCell
                                name={r.vendor.name}
                                detail={r.vendor.email}
                            />
                        </DocCard>
                    </div>
                </div>
            </div>
        </>
    );
}

ReturnShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Purchase Returns', href: purchaseReturns.index() },
        { title: 'Purchase Return Details', href: purchaseReturns.index() },
    ],
};
