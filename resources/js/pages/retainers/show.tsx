import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Copy,
    CalendarDays,
    Check,
    Clock,
    Download,
    FileText,
    Receipt,
    RefreshCw,
    Send,
    User,
    Warehouse,
    X,
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
import salesInvoices from '@/routes/sales-invoices';
import retainerRoutes from '@/routes/retainers';
import type { Retainer } from './types';

type ShownRetainer = Retainer & {
    warehouse: { id: number; name: string };
    customer: Retainer['customer'] & {
        customer: {
            company_name: string;
            contact_person_mobile: string | null;
        } | null;
    };
};

export default function RetainerShow({
    retainer,
}: {
    retainer: ShownRetainer;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const put = (route: ReturnType<typeof retainerRoutes.send>) =>
        router.put(route, {}, { preserveScroll: true });
    const overdue = retainer.display_status === 'overdue';

    return (
        <>
            <Head title={retainer.retainer_number} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">
                            {t('Retainer')} #{retainer.retainer_number}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'View details, items, payments, and conversion options for this retainer.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={retainerRoutes.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard icon={CalendarDays} title="Retainer Details">
                            <div className="grid gap-6 sm:grid-cols-2">
                                <Fact icon={CalendarDays} label="Retainer Date">
                                    {date(retainer.retainer_date)}
                                </Fact>
                                <Fact icon={Warehouse} label="Warehouse">
                                    <IdBadge>{retainer.warehouse.name}</IdBadge>
                                </Fact>
                                <Fact icon={CalendarDays} label="Due Date">
                                    <span
                                        className={
                                            overdue
                                                ? 'text-destructive'
                                                : undefined
                                        }
                                    >
                                        {date(retainer.due_date)}
                                        {overdue && ` · ${t('Overdue')}`}
                                    </span>
                                </Fact>
                                <Fact icon={Clock} label="Terms">
                                    {retainer.payment_terms || '-'}
                                </Fact>
                            </div>
                        </DocCard>

                        <DocCard icon={Receipt} title="Retainer Items">
                            <LineItemsTable lines={retainer.items ?? []} />
                            <TotalsList
                                className="ms-auto mt-4 grid max-w-xs gap-2 text-sm"
                                subtotal={Number(retainer.subtotal)}
                                discount={Number(retainer.discount_amount)}
                                tax={Number(retainer.tax_amount)}
                                total={Number(retainer.total_amount)}
                                paid={Number(retainer.paid_amount)}
                                balance={Number(retainer.balance_amount)}
                            />
                        </DocCard>

                        {retainer.notes && (
                            <DocCard icon={FileText} title="Additional Notes">
                                <p className="text-sm whitespace-pre-line">
                                    {retainer.notes}
                                </p>
                            </DocCard>
                        )}
                    </div>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={Receipt} title="Summary & Actions">
                            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t('Retainer Total')}
                            </div>
                            <div className="mt-1 text-3xl font-bold">
                                {money(Number(retainer.total_amount))}
                            </div>
                            <div className="mt-2">
                                <StatusBadge status={retainer.display_status} />
                            </div>
                            <div className="mt-6 grid gap-2">
                                {can('print-retainer') && (
                                    <Button variant="outline" asChild>
                                        <a
                                            href={
                                                retainerRoutes.pdf(retainer.id)
                                                    .url
                                            }
                                        >
                                            <Download /> {t('Download PDF')}
                                        </a>
                                    </Button>
                                )}
                                {retainer.status === 'draft' &&
                                    can('sent-retainer') && (
                                        <Button
                                            onClick={() =>
                                                put(
                                                    retainerRoutes.send(
                                                        retainer.id,
                                                    ),
                                                )
                                            }
                                        >
                                            <Send /> {t('Mark as Sent')}
                                        </Button>
                                    )}
                                {retainer.status === 'sent' &&
                                    can('accept-retainer') && (
                                        <Button
                                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                                            onClick={() =>
                                                put(
                                                    retainerRoutes.accept(
                                                        retainer.id,
                                                    ),
                                                )
                                            }
                                        >
                                            <Check /> {t('Accept')}
                                        </Button>
                                    )}
                                {retainer.status === 'sent' &&
                                    can('reject-retainer') && (
                                        <Button
                                            variant="destructive"
                                            onClick={() =>
                                                put(
                                                    retainerRoutes.reject(
                                                        retainer.id,
                                                    ),
                                                )
                                            }
                                        >
                                            <X /> {t('Reject')}
                                        </Button>
                                    )}
                                {['accepted', 'partial', 'paid'].includes(
                                    retainer.status,
                                ) &&
                                    !retainer.invoice_id &&
                                    can('convert-to-invoice-retainer') && (
                                        <Button
                                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                                            onClick={() =>
                                                router.post(
                                                    retainerRoutes.convert(
                                                        retainer.id,
                                                    ),
                                                )
                                            }
                                        >
                                            <RefreshCw />{' '}
                                            {t('Convert to Invoice')}
                                        </Button>
                                    )}
                                {retainer.invoice_id &&
                                    can('view-sales-invoices') && (
                                        <Button variant="outline" asChild>
                                            <Link
                                                href={salesInvoices.show(
                                                    retainer.invoice_id,
                                                )}
                                            >
                                                <Receipt /> {t('View Invoice')}
                                            </Link>
                                        </Button>
                                    )}
                                {can('duplicate-retainer') && (
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            router.post(
                                                retainerRoutes.duplicate(
                                                    retainer.id,
                                                ),
                                            )
                                        }
                                    >
                                        <Copy /> {t('Duplicate')}
                                    </Button>
                                )}
                                {retainer.status === 'draft' &&
                                    can('edit-retainer') && (
                                        <Button variant="outline" asChild>
                                            <Link
                                                href={retainerRoutes.edit(
                                                    retainer.id,
                                                )}
                                            >
                                                {t('Edit')}
                                            </Link>
                                        </Button>
                                    )}
                            </div>
                        </DocCard>
                        <DocCard icon={User} title="Customer Info">
                            <PersonCell
                                name={retainer.customer.name}
                                detail={retainer.customer.email}
                            />
                            {retainer.customer.customer && (
                                <div className="mt-3 text-sm text-muted-foreground">
                                    {retainer.customer.customer.company_name}
                                    {retainer.customer.customer
                                        .contact_person_mobile && (
                                        <div>
                                            {
                                                retainer.customer.customer
                                                    .contact_person_mobile
                                            }
                                        </div>
                                    )}
                                </div>
                            )}
                        </DocCard>
                    </div>
                </div>
            </div>
        </>
    );
}

RetainerShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Retainers', href: retainerRoutes.index() },
        { title: 'Retainer Details', href: retainerRoutes.index() },
    ],
};
