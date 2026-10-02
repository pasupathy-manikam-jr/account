import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    FileText,
    Hash,
    Landmark,
    PiggyBank,
    Receipt,
    User,
} from 'lucide-react';
import { PersonCell } from '@/components/person-cell';
import { DocCard, Fact } from '@/components/sales-document';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import retainerPayments from '@/routes/retainer-payments';
import retainerRoutes from '@/routes/retainers';
import { PaymentActions } from './actions';
import type { RetainerPayment } from './types';

export default function RetainerPaymentShow({
    payment,
}: {
    payment: RetainerPayment;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();

    return (
        <>
            <Head title={payment.payment_number} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">
                            {t('Retainer Payment')} #{payment.payment_number}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'The advance payment and the retainers it pays towards.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={retainerPayments.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard icon={CalendarDays} title="Payment Details">
                            <div className="grid gap-6 sm:grid-cols-2">
                                <Fact icon={CalendarDays} label="Payment Date">
                                    {date(payment.payment_date)}
                                </Fact>
                                <Fact icon={Landmark} label="Bank Account">
                                    {payment.bank_account.account_name} ·{' '}
                                    {payment.bank_account.bank_name}
                                </Fact>
                                <Fact icon={Hash} label="Reference Number">
                                    {payment.reference_number ?? '-'}
                                </Fact>
                            </div>
                        </DocCard>
                        <DocCard icon={PiggyBank} title="Allocations">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                                        <tr className="border-b">
                                            <th className="py-3 pe-3 text-start font-medium">
                                                {t('Retainer')}
                                            </th>
                                            <th className="px-3 py-3 text-end font-medium">
                                                {t('Retainer Total')}
                                            </th>
                                            <th className="px-3 py-3 text-start font-medium">
                                                {t('Status')}
                                            </th>
                                            <th className="py-3 ps-3 text-end font-medium">
                                                {t('Allocated')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payment.allocations.map((a) => (
                                            <tr
                                                key={a.id}
                                                className="border-b last:border-0"
                                            >
                                                <td className="py-3 pe-3">
                                                    {can('view-retainer') ? (
                                                        <Link
                                                            href={retainerRoutes.show(
                                                                a.retainer.id,
                                                            )}
                                                        >
                                                            <IdBadge>
                                                                {
                                                                    a.retainer
                                                                        .retainer_number
                                                                }
                                                            </IdBadge>
                                                        </Link>
                                                    ) : (
                                                        <IdBadge>
                                                            {
                                                                a.retainer
                                                                    .retainer_number
                                                            }
                                                        </IdBadge>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-end whitespace-nowrap">
                                                    {money(
                                                        Number(
                                                            a.retainer
                                                                .total_amount,
                                                        ),
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {a.retainer.status && (
                                                        <StatusBadge
                                                            status={
                                                                a.retainer
                                                                    .status
                                                            }
                                                        />
                                                    )}
                                                </td>
                                                <td className="py-3 ps-3 text-end font-semibold whitespace-nowrap">
                                                    {money(
                                                        Number(
                                                            a.allocated_amount,
                                                        ),
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </DocCard>
                        {payment.notes && (
                            <DocCard icon={FileText} title="Additional Notes">
                                <p className="text-sm whitespace-pre-line">
                                    {payment.notes}
                                </p>
                            </DocCard>
                        )}
                    </div>
                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={Receipt} title="Summary & Actions">
                            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t('Payment Amount')}
                            </div>
                            <div className="mt-1 text-3xl font-bold">
                                {money(Number(payment.payment_amount))}
                            </div>
                            <div className="mt-2">
                                <StatusBadge status={payment.status} />
                            </div>
                            <div className="mt-6 flex flex-wrap justify-center gap-1 rounded-lg border p-1 empty:hidden">
                                <PaymentActions
                                    payment={payment}
                                    showView={false}
                                />
                            </div>
                        </DocCard>
                        <DocCard icon={User} title="Customer Info">
                            <PersonCell
                                name={payment.customer.name}
                                detail={payment.customer.email}
                            />
                        </DocCard>
                    </div>
                </div>
            </div>
        </>
    );
}

RetainerPaymentShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Retainer Payments', href: retainerPayments.index() },
        { title: 'Retainer Payment Details', href: retainerPayments.index() },
    ],
};
