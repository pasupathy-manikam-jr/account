import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Download } from 'lucide-react';
import DatePicker from '@/components/date-picker';
import { PageHeader } from '@/components/page-header';
import { PersonCell } from '@/components/person-cell';
import { applyFilters } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import account from '@/routes/account';

type Row = {
    id: number;
    date: string;
    number: string;
    description: string;
    debit: string;
    credit: string;
    balance: string;
};

export default function Statement({
    kind,
    party,
    filters,
    opening,
    closing,
    debits,
    credits,
    rows,
}: {
    kind: 'customer' | 'vendor';
    party: { id: number; name: string; email: string };
    filters: { date_from: string; date_to: string };
    opening: string;
    closing: string;
    debits: string;
    credits: string;
    rows: Row[];
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const url = account.reports.statement(party.id);
    const customer = kind === 'customer';
    // A customer's charges are debits; a vendor's bills are credits.
    const [charge, settle] = customer
        ? (['debit', 'credit'] as const)
        : (['credit', 'debit'] as const);
    const summary: [string, string][] = [
        ['Opening Balance', opening],
        [customer ? 'Invoiced' : 'Billed', customer ? debits : credits],
        [
            customer ? 'Received & Credited' : 'Paid & Debited',
            customer ? credits : debits,
        ],
        ['Closing Balance', closing],
    ];

    return (
        <>
            <Head title={party.name} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title={
                        customer
                            ? 'Customer Detail Report'
                            : 'Vendor Detail Report'
                    }
                    description="Every invoice, note and payment for this account, with its running balance."
                    action={
                        <div className="flex gap-2">
                            {can(`print-${kind}-detail-report`) && (
                                <Button variant="outline" asChild>
                                    <a
                                        href={
                                            account.reports.statement.pdf(
                                                party.id,
                                                { query: filters },
                                            ).url
                                        }
                                    >
                                        <Download /> {t('Download PDF')}
                                    </a>
                                </Button>
                            )}
                            <Button variant="outline" asChild>
                                <Link
                                    href={account.reports.index({
                                        query: {
                                            report: `${kind}-balance`,
                                        },
                                    })}
                                >
                                    <ArrowLeft className="rtl:rotate-180" />
                                    {t('Back')}
                                </Link>
                            </Button>
                        </div>
                    }
                />

                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="flex flex-wrap items-end justify-between gap-4 border-b bg-muted/40 p-4">
                        <PersonCell name={party.name} detail={party.email} />
                        <div className="flex flex-wrap gap-4">
                            {(
                                [
                                    ['date_from', 'From Date'],
                                    ['date_to', 'To Date'],
                                ] as const
                            ).map(([name, label]) => (
                                <div key={name} className="grid gap-1.5">
                                    <Label htmlFor={name}>{t(label)}</Label>
                                    <DatePicker
                                        key={filters[name]}
                                        id={name}
                                        name={name}
                                        className="w-48"
                                        defaultValue={filters[name]}
                                        onChange={(value) =>
                                            applyFilters(url, filters, {
                                                [name]: value,
                                            })
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-px border-b bg-border lg:grid-cols-4">
                        {summary.map(([label, amount]) => (
                            <div key={label} className="bg-card p-4">
                                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    {t(label)}
                                </div>
                                <div className="mt-1 text-xl font-bold tabular-nums">
                                    {money(Number(amount))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="max-h-[calc(100dvh-24rem)] overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-muted text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
                                <tr>
                                    <th className="px-4 py-3 text-start font-medium">
                                        {t('Date')}
                                    </th>
                                    <th className="px-4 py-3 text-start font-medium">
                                        {t('Journal')}
                                    </th>
                                    <th className="px-4 py-3 text-start font-medium">
                                        {t('Description')}
                                    </th>
                                    <th className="px-4 py-3 text-end font-medium">
                                        {t(customer ? 'Charges' : 'Bills')}
                                    </th>
                                    <th className="px-4 py-3 text-end font-medium">
                                        {t(
                                            customer
                                                ? 'Payments & Credits'
                                                : 'Payments & Debits',
                                        )}
                                    </th>
                                    <th className="px-4 py-3 text-end font-medium">
                                        {t('Balance')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b bg-muted/30">
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        {date(filters.date_from)}
                                    </td>
                                    <td
                                        colSpan={4}
                                        className="px-4 py-2 font-medium"
                                    >
                                        {t('Opening Balance')}
                                    </td>
                                    <td className="px-4 py-2 text-end font-medium tabular-nums">
                                        {money(Number(opening))}
                                    </td>
                                </tr>
                                {rows.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-4 py-12 text-center text-muted-foreground"
                                        >
                                            {t(
                                                'No transactions in this period.',
                                            )}
                                        </td>
                                    </tr>
                                )}
                                {rows.map((row) => (
                                    <tr key={row.id} className="border-b">
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            {date(row.date)}
                                        </td>
                                        <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                                            {row.number}
                                        </td>
                                        <td className="px-4 py-2">
                                            {row.description}
                                        </td>
                                        {[charge, settle].map((side) => (
                                            <td
                                                key={side}
                                                className={cn(
                                                    'px-4 py-2 text-end whitespace-nowrap tabular-nums',
                                                    Number(row[side]) === 0 &&
                                                        'text-muted-foreground',
                                                )}
                                            >
                                                {Number(row[side]) === 0
                                                    ? '-'
                                                    : money(Number(row[side]))}
                                            </td>
                                        ))}
                                        <td className="px-4 py-2 text-end font-semibold whitespace-nowrap tabular-nums">
                                            {money(Number(row.balance))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

Statement.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Reports', href: account.reports.index() },
        { title: 'Detail Report', href: account.reports.index() },
    ],
};
