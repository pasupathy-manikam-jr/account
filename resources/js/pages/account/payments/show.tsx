import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    FileMinus,
    FileText,
    Hash,
    Landmark,
    Receipt,
    User,
} from 'lucide-react';
import { PersonCell } from '@/components/person-cell';
import { DocCard, Fact } from '@/components/sales-document';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import { PaymentActions } from './actions';
import { kindConfig } from './types';
import type { Kind, Payment } from './types';

export default function PaymentShow({
    kind,
    payment,
}: {
    kind: Kind;
    payment: Payment;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const config = kindConfig(kind);
    const applications = payment.note_applications ?? [];

    return (
        <>
            <Head title={payment.payment_number} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">
                            {t(
                                kind === 'customer'
                                    ? 'Customer Payment'
                                    : 'Vendor Payment',
                            )}{' '}
                            #{payment.payment_number}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'The payment, the invoices it settles and any notes applied.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={config.routes.index()}>
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
                        <DocCard icon={Receipt} title="Allocations">
                            <table className="w-full text-sm">
                                <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                                    <tr className="border-b">
                                        <th className="py-3 pe-3 text-start font-medium">
                                            {t('Invoice')}
                                        </th>
                                        <th className="px-3 py-3 text-end font-medium">
                                            {t('Invoice Total')}
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
                                                <IdBadge>
                                                    {a.invoice.invoice_number}
                                                </IdBadge>
                                            </td>
                                            <td className="px-3 py-3 text-end whitespace-nowrap">
                                                {money(
                                                    Number(
                                                        a.invoice.total_amount,
                                                    ),
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <StatusBadge
                                                    status={a.invoice.status}
                                                />
                                            </td>
                                            <td className="py-3 ps-3 text-end font-semibold whitespace-nowrap">
                                                {money(
                                                    Number(a.allocated_amount),
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </DocCard>
                        {applications.length > 0 && (
                            <DocCard icon={FileMinus} title={config.note}>
                                <ul className="grid gap-2 text-sm">
                                    {applications.map((a) => (
                                        <li
                                            key={a.id}
                                            className="flex items-center justify-between gap-4"
                                        >
                                            <IdBadge>
                                                {a.note.credit_note_number ??
                                                    a.note.debit_note_number}
                                            </IdBadge>
                                            <span className="font-semibold">
                                                {money(
                                                    Number(a.applied_amount),
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </DocCard>
                        )}
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
                        <DocCard
                            icon={User}
                            title={
                                kind === 'customer'
                                    ? 'Customer Info'
                                    : 'Vendor Info'
                            }
                        >
                            <PersonCell
                                name={payment.party.name}
                                detail={payment.party.email}
                            />
                        </DocCard>
                    </div>
                </div>
            </div>
        </>
    );
}

PaymentShow.layout = {
    breadcrumbs: [{ title: 'Dashboard', href: dashboard() }],
};
