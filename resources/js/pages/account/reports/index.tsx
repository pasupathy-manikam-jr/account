import { Head, Link } from '@inertiajs/react';
import {
    Clock,
    Download,
    FileClock,
    Percent,
    Truck,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import DatePicker from '@/components/date-picker';
import { PersonCell } from '@/components/person-cell';
import { PageHeader } from '@/components/page-header';
import { applyFilters } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import account from '@/routes/account';
import type { TableFilters } from '@/types';

type Report =
    | 'invoice-aging'
    | 'bill-aging'
    | 'tax-summary'
    | 'customer-balance'
    | 'vendor-balance';

type PartyRow = {
    party_id: number;
    name: string;
    email: string;
} & Record<string, string | number>;

type PartyData = { rows: PartyRow[]; totals: Record<string, string> };

type TaxData = {
    collected: { name: string; amount: string }[];
    paid: { name: string; amount: string }[];
    total_collected: string;
    total_paid: string;
    net: string;
};

const TABS: { key: Report; label: string; icon: LucideIcon }[] = [
    { key: 'invoice-aging', label: 'Invoice Aging', icon: FileClock },
    { key: 'bill-aging', label: 'Bill Aging', icon: Clock },
    { key: 'tax-summary', label: 'Tax Summary', icon: Percent },
    { key: 'customer-balance', label: 'Customer Balance', icon: Users },
    { key: 'vendor-balance', label: 'Vendor Balance', icon: Truck },
];

const TITLES: Record<Report, string> = {
    'invoice-aging': 'Invoice Aging Report',
    'bill-aging': 'Bill Aging Report',
    'tax-summary': 'Tax Summary Report',
    'customer-balance': 'Customer Balance Summary',
    'vendor-balance': 'Vendor Balance Summary',
};

const AGING_COLUMNS: [string, string][] = [
    ['current', 'Current'],
    ['1_30', '1-30 Days'],
    ['31_60', '31-60 Days'],
    ['61_90', '61-90 Days'],
    ['over_90', '>90 Days'],
    ['total', 'Total'],
];

export default function Reports({
    report,
    filters,
    data,
}: {
    report: Report;
    filters: {
        as_of?: string;
        date_from?: string;
        date_to?: string;
        zero?: boolean;
    };
    data: PartyData | TaxData;
}) {
    const { t } = useTranslation();
    const { date } = useFormat();
    const url = account.reports.index();
    const query = { report, ...filters, zero: filters.zero ? 1 : undefined };
    const apply = (changes: TableFilters) =>
        applyFilters(url, query as TableFilters, changes);
    const customer =
        report === 'invoice-aging' || report === 'customer-balance';

    return (
        <>
            <Head title={t('Reports')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Reports"
                    description="Generate and analyze aging reports, tax summaries, and customer/vendor balances to track cash flows."
                />

                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div
                        role="tablist"
                        className="flex flex-wrap gap-x-2 border-b px-4"
                    >
                        {TABS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={report === key}
                                onClick={() =>
                                    applyFilters(url, {}, { report: key })
                                }
                                className={cn(
                                    '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                                    report === key
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Icon className="size-4" />
                                {t(label)}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-end gap-4 border-b bg-muted/40 p-4">
                        {report === 'tax-summary' ? (
                            (
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
                                            apply({ [name]: value })
                                        }
                                    />
                                </div>
                            ))
                        ) : (
                            <div className="grid gap-1.5">
                                <Label htmlFor="as_of">{t('As Of Date')}</Label>
                                <DatePicker
                                    key={filters.as_of}
                                    id="as_of"
                                    name="as_of"
                                    className="w-48"
                                    defaultValue={filters.as_of}
                                    onChange={(value) =>
                                        apply({ as_of: value })
                                    }
                                />
                            </div>
                        )}
                        {report.endsWith('balance') && (
                            <div className="flex h-9 items-center gap-2">
                                <Switch
                                    id="zero"
                                    checked={!!filters.zero}
                                    onCheckedChange={(on) =>
                                        apply({ zero: on ? '1' : undefined })
                                    }
                                />
                                <Label htmlFor="zero">
                                    {t('Show Zero Balances')}
                                </Label>
                            </div>
                        )}
                        <Button variant="outline" className="ms-auto" asChild>
                            <a
                                href={
                                    account.reports.pdf({
                                        query: query as Record<
                                            string,
                                            string | number
                                        >,
                                    }).url
                                }
                            >
                                <Download /> {t('Download PDF')}
                            </a>
                        </Button>
                    </div>

                    <div className="px-4 py-4">
                        <h2 className="text-lg font-semibold">
                            {t(TITLES[report])}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {report === 'tax-summary'
                                ? `${date(filters.date_from ?? '')} – ${date(filters.date_to ?? '')}`
                                : t('As of :date', {
                                      date: date(filters.as_of ?? ''),
                                  })}
                        </p>
                    </div>

                    {report === 'tax-summary' ? (
                        <TaxTable data={data as TaxData} />
                    ) : (
                        <PartyTable
                            data={data as PartyData}
                            partyLabel={customer ? 'Customer' : 'Vendor'}
                            columns={
                                report.endsWith('aging')
                                    ? AGING_COLUMNS
                                    : [
                                          ['invoiced', 'Total Invoiced'],
                                          [
                                              'notes',
                                              customer
                                                  ? 'Total Returns & Credit Notes'
                                                  : 'Total Returns & Debit Notes',
                                          ],
                                          ['paid', 'Total Paid'],
                                          ['balance', 'Balance'],
                                      ]
                            }
                        />
                    )}
                </div>
            </div>
        </>
    );
}

function PartyTable({
    data,
    partyLabel,
    columns,
}: {
    data: PartyData;
    partyLabel: string;
    columns: [string, string][];
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const last = columns[columns.length - 1][0];

    return (
        <div className="max-h-[calc(100dvh-22rem)] overflow-auto border-t">
            <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
                    <tr>
                        <th className="px-4 py-3 text-start font-medium">
                            {t(partyLabel)}
                        </th>
                        {columns.map(([key, label]) => (
                            <th
                                key={key}
                                className="px-4 py-3 text-end font-medium whitespace-nowrap"
                            >
                                {t(label)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.rows.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length + 1}
                                className="px-4 py-12 text-center text-muted-foreground"
                            >
                                {t('Nothing outstanding.')}
                            </td>
                        </tr>
                    ) : (
                        data.rows.map((row) => (
                            <tr key={row.party_id} className="border-b">
                                <td className="px-4 py-2">
                                    <Link
                                        href={account.reports.statement(
                                            row.party_id,
                                        )}
                                        className="hover:underline"
                                    >
                                        <PersonCell
                                            name={row.name}
                                            detail={row.email}
                                        />
                                    </Link>
                                </td>
                                {columns.map(([key]) => (
                                    <td
                                        key={key}
                                        className={cn(
                                            'px-4 py-2 text-end whitespace-nowrap tabular-nums',
                                            key === last && 'font-semibold',
                                            Number(row[key]) === 0 &&
                                                'text-muted-foreground',
                                        )}
                                    >
                                        {money(Number(row[key]))}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
                <tfoot className="sticky bottom-0 bg-muted font-semibold shadow-[inset_0_1px_0_var(--border)]">
                    <tr>
                        <td className="px-4 py-3">{t('Total')}</td>
                        {columns.map(([key]) => (
                            <td
                                key={key}
                                className="px-4 py-3 text-end whitespace-nowrap tabular-nums"
                            >
                                {money(Number(data.totals[key]))}
                            </td>
                        ))}
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function TaxTable({ data }: { data: TaxData }) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const sections = [
        [
            'Tax Collected (Sales)',
            data.collected,
            'Total Tax Collected',
            data.total_collected,
        ],
        ['Tax Paid (Purchases)', data.paid, 'Total Tax Paid', data.total_paid],
    ] as const;
    const net = Number(data.net);

    return (
        <table className="w-full border-t text-sm">
            {sections.map(([heading, taxes, totalLabel, total]) => (
                <tbody key={heading}>
                    <tr className="bg-muted text-muted-foreground">
                        <th
                            colSpan={2}
                            className="px-4 py-3 text-start font-medium"
                        >
                            {t(heading)}
                        </th>
                    </tr>
                    {taxes.length === 0 ? (
                        <tr className="border-b">
                            <td
                                colSpan={2}
                                className="px-4 py-3 text-muted-foreground"
                            >
                                {t('No tax in this period.')}
                            </td>
                        </tr>
                    ) : (
                        taxes.map((tax) => (
                            <tr key={tax.name} className="border-b">
                                <td className="px-4 py-2 ps-8">{tax.name}</td>
                                <td className="px-4 py-2 text-end tabular-nums">
                                    {money(Number(tax.amount))}
                                </td>
                            </tr>
                        ))
                    )}
                    <tr className="border-b font-semibold">
                        <td className="px-4 py-3">{t(totalLabel)}</td>
                        <td className="px-4 py-3 text-end tabular-nums">
                            {money(Number(total))}
                        </td>
                    </tr>
                </tbody>
            ))}
            <tfoot>
                <tr className="bg-primary/5 text-base font-bold">
                    <td className="px-4 py-4">
                        {t('Net Tax Liability')}
                        <div className="text-xs font-normal text-muted-foreground">
                            {t(
                                net < 0
                                    ? 'More tax paid than collected: a refundable position.'
                                    : 'Tax collected less tax paid: payable to the tax authority.',
                            )}
                        </div>
                    </td>
                    <td
                        className={cn(
                            'px-4 py-4 text-end tabular-nums',
                            net < 0 ? 'text-emerald-600' : 'text-rose-600',
                        )}
                    >
                        {money(net)}
                    </td>
                </tr>
            </tfoot>
        </table>
    );
}

Reports.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: dashboard() },
        { title: 'Reports', href: account.reports.index() },
    ],
};
