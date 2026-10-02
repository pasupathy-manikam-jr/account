import { Head } from '@inertiajs/react';
import {
    BookOpen,
    CalendarRange,
    ChartColumn,
    FileText,
    Layers,
    Receipt,
    TrendingDown,
    Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { SummaryCard } from '@/components/summary-card';
import { DateCell, IdBadge } from '@/components/table-cells';
import { applyFilters, FilterSelect } from '@/components/table-filters';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import doubleEntry from '@/routes/double-entry';
import type { Paginated, TableFilters } from '@/types';
import { AccountLabel, Amount, DateFilters, StatementHeader } from './shared';

type Report =
    | 'general-ledger'
    | 'account-statement'
    | 'journal-entries'
    | 'cash-flow'
    | 'expense-report';

type LedgerLine = {
    id: number;
    date: string;
    number: string;
    reference: string;
    description: string;
    debit: string;
    credit: string;
    balance: string;
};

type LedgerAccount = {
    id: number;
    code: string;
    name: string;
    opening: string;
    lines: LedgerLine[];
    debit: string;
    credit: string;
    closing: string;
};

type Entry = {
    id: number;
    number: string;
    date: string;
    description: string;
    reference: string;
    total: string;
    lines: {
        id: number;
        code: string;
        name: string;
        description: string | null;
        debit: string;
        credit: string;
    }[];
};

type CashFlow = {
    sections: {
        key: 'operating' | 'investing' | 'financing';
        rows: { code: string; name: string; amount: string }[];
        inflow: string;
        outflow: string;
        net: string;
    }[];
    opening: string;
    net: string;
    closing: string;
};

type Expenses = {
    months: string[];
    rows: {
        code: string;
        name: string;
        months: string[];
        total: string;
        share: number;
    }[];
    month_totals: string[];
    total: string;
    largest: { name: string; amount: string } | null;
    average: string;
};

const TABS: { key: Report; label: string; icon: LucideIcon }[] = [
    { key: 'general-ledger', label: 'General Ledger', icon: BookOpen },
    { key: 'account-statement', label: 'Account Statement', icon: FileText },
    { key: 'journal-entries', label: 'Journal Entries', icon: Layers },
    { key: 'cash-flow', label: 'Cash Flow', icon: Wallet },
    { key: 'expense-report', label: 'Expense Report', icon: Receipt },
];

const SECTIONS = {
    operating: 'Operating Activities',
    investing: 'Investing Activities',
    financing: 'Financing Activities',
};

const th = 'px-4 py-3 font-medium whitespace-nowrap';
const head =
    'sticky top-0 z-10 bg-muted text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]';

export default function DoubleEntryReports({
    report,
    filters,
    data,
    accounts,
}: {
    report: Report;
    filters: TableFilters;
    data: unknown;
    accounts: { id: number; account_code: string; account_name: string }[];
}) {
    const { t } = useTranslation();
    const url = doubleEntry.reports.index();
    const withAccount =
        report === 'general-ledger' || report === 'account-statement';

    return (
        <>
            <Head title={t('Reports')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <StatementHeader
                    title="Reports"
                    description="The general ledger, account statements, journal entries, cash flow and expenses, straight from the books."
                    printUrl={doubleEntry.reports.print({ query: filters }).url}
                    printPermission={
                        report === 'general-ledger'
                            ? 'print-general-ledger'
                            : 'manage-double-entry-reports'
                    }
                />

                <div className="rounded-xl border bg-card shadow-sm">
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
                                    applyFilters(
                                        url,
                                        {},
                                        {
                                            report: key,
                                            date_from: filters.date_from,
                                            date_to: filters.date_to,
                                        },
                                    )
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
                    <div className="bg-muted/40 p-4">
                        <DateFilters
                            url={url}
                            filters={filters}
                            fields={[
                                ['date_from', 'From Date'],
                                ['date_to', 'To Date'],
                            ]}
                        >
                            {withAccount && (
                                <FilterSelect
                                    url={url}
                                    filters={filters}
                                    name="account_id"
                                    label={
                                        report === 'general-ledger'
                                            ? 'All Accounts'
                                            : 'Select Account'
                                    }
                                    options={accounts.map((a) => ({
                                        id: a.id,
                                        name: `${a.account_code} - ${a.account_name}`,
                                    }))}
                                />
                            )}
                        </DateFilters>
                    </div>
                </div>

                {report === 'general-ledger' && (
                    <GeneralLedger accounts={data as LedgerAccount[]} />
                )}
                {report === 'account-statement' && data !== null && (
                    <AccountStatement account={data as LedgerAccount} />
                )}
                {report === 'journal-entries' && (
                    <JournalEntries
                        entries={data as Paginated<Entry>}
                        filters={filters}
                    />
                )}
                {report === 'cash-flow' && (
                    <CashFlowReport flow={data as CashFlow} />
                )}
                {report === 'expense-report' && (
                    <ExpenseReport report={data as Expenses} />
                )}
            </div>
        </>
    );
}

/** One account's opening row, lines with a running balance, and closing row. */
function LedgerRows({ account }: { account: LedgerAccount }) {
    const { t } = useTranslation();
    const { date } = useFormat();

    return (
        <>
            <tr className="border-b bg-muted/30">
                <td colSpan={5} className="px-4 py-2 font-medium">
                    {t('Opening Balance')}
                </td>
                <td className="px-4 py-2 text-end font-medium">
                    <Amount value={account.opening} />
                </td>
            </tr>
            {account.lines.map((line) => (
                <tr key={line.id} className="border-b">
                    <td className="px-4 py-2 whitespace-nowrap">
                        {date(line.date)}
                    </td>
                    <td className="px-4 py-2">
                        <IdBadge>{line.number}</IdBadge>
                        <div className="mt-0.5 text-xs whitespace-nowrap text-muted-foreground">
                            {line.reference}
                        </div>
                    </td>
                    <td className="px-4 py-2">{line.description}</td>
                    <td className="px-4 py-2 text-end">
                        <Amount value={line.debit} dashZero />
                    </td>
                    <td className="px-4 py-2 text-end">
                        <Amount value={line.credit} dashZero />
                    </td>
                    <td className="px-4 py-2 text-end font-semibold">
                        <Amount value={line.balance} />
                    </td>
                </tr>
            ))}
            <tr className="border-b font-semibold">
                <td colSpan={3} className="px-4 py-2">
                    {t('Closing Balance')}
                </td>
                <td className="px-4 py-2 text-end">
                    <Amount value={account.debit} />
                </td>
                <td className="px-4 py-2 text-end">
                    <Amount value={account.credit} />
                </td>
                <td className="px-4 py-2 text-end">
                    <Amount value={account.closing} />
                </td>
            </tr>
        </>
    );
}

function LedgerHead() {
    const { t } = useTranslation();

    return (
        <thead className={head}>
            <tr>
                <th className={`${th} text-start`}>{t('Date')}</th>
                <th className={`${th} text-start`}>{t('Journal')}</th>
                <th className={`${th} text-start`}>{t('Description')}</th>
                <th className={`${th} text-end`}>{t('Debit')}</th>
                <th className={`${th} text-end`}>{t('Credit')}</th>
                <th className={`${th} text-end`}>{t('Balance')}</th>
            </tr>
        </thead>
    );
}

function GeneralLedger({ accounts }: { accounts: LedgerAccount[] }) {
    const { t } = useTranslation();

    return (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="max-h-[calc(100dvh-18rem)] overflow-auto">
                <table className="w-full text-sm">
                    <LedgerHead />
                    {accounts.length === 0 && (
                        <tbody>
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-12 text-center text-muted-foreground"
                                >
                                    {t('No transactions in this period.')}
                                </td>
                            </tr>
                        </tbody>
                    )}
                    {accounts.map((account) => (
                        <tbody key={account.id}>
                            <tr className="border-b bg-primary/5">
                                <td
                                    colSpan={6}
                                    className="px-4 py-2.5 font-semibold"
                                >
                                    <AccountLabel
                                        code={account.code}
                                        name={account.name}
                                    />
                                </td>
                            </tr>
                            <LedgerRows account={account} />
                        </tbody>
                    ))}
                </table>
            </div>
        </div>
    );
}

function AccountStatement({ account }: { account: LedgerAccount }) {
    const { money } = useFormat();

    return (
        <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    tone="gray"
                    icon={CalendarRange}
                    label="Opening Balance"
                    value={money(Number(account.opening))}
                    caption={`${account.code} · ${account.name}`}
                />
                <SummaryCard
                    tone="blue"
                    icon={TrendingDown}
                    label="Total Debit"
                    value={money(Number(account.debit))}
                    caption="Total debited amount"
                />
                <SummaryCard
                    tone="violet"
                    icon={ChartColumn}
                    label="Total Credit"
                    value={money(Number(account.credit))}
                    caption="Total credited amount"
                />
                <SummaryCard
                    tone="green"
                    icon={Wallet}
                    label="Closing Balance"
                    value={money(Number(account.closing))}
                    caption="Balance at the end of the period"
                />
            </div>
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="max-h-[calc(100dvh-24rem)] overflow-auto">
                    <table className="w-full text-sm">
                        <LedgerHead />
                        <tbody>
                            <LedgerRows account={account} />
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

function JournalEntries({
    entries,
    filters,
}: {
    entries: Paginated<Entry>;
    filters: TableFilters;
}) {
    const columns: Column<Entry>[] = [
        {
            key: 'journal_number',
            label: 'Journal #',
            sortable: true,
            render: (e) => <IdBadge>{e.number}</IdBadge>,
        },
        {
            key: 'journal_date',
            label: 'Date',
            sortable: true,
            render: (e) => <DateCell value={e.date} />,
        },
        {
            key: 'reference',
            label: 'Reference',
            render: (e) => (
                <span className="whitespace-nowrap">{e.reference}</span>
            ),
        },
        {
            key: 'description',
            label: 'Description',
            // The entry's lines sit under its description.
            render: (e) => (
                <div className="grid gap-2">
                    <div className="max-w-md">{e.description}</div>
                    <table className="w-full min-w-96 text-xs">
                        <tbody>
                            {e.lines.map((line) => (
                                <tr key={line.id}>
                                    <td
                                        className={cn(
                                            'py-0.5 pe-3',
                                            Number(line.credit) > 0 && 'ps-6',
                                        )}
                                    >
                                        <AccountLabel
                                            code={line.code}
                                            name={line.name}
                                        />
                                    </td>
                                    <td className="w-24 py-0.5 text-end">
                                        <Amount value={line.debit} dashZero />
                                    </td>
                                    <td className="w-24 py-0.5 text-end">
                                        <Amount value={line.credit} dashZero />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ),
        },
        {
            key: 'total_debit',
            label: 'Total Debit',
            render: (e) => <Amount value={e.total} className="font-semibold" />,
        },
        {
            key: 'total_credit',
            label: 'Total Credit',
            // Every posted entry balances, so credits equal debits.
            render: (e) => <Amount value={e.total} className="font-semibold" />,
        },
        {
            key: 'status',
            label: 'Status',
            render: () => <StatusBadge status="posted" />,
        },
    ];

    return (
        <DataTable
            data={entries}
            columns={columns}
            filters={filters}
            url={doubleEntry.reports.index()}
        />
    );
}

function CashFlowReport({ flow }: { flow: CashFlow }) {
    const { t } = useTranslation();
    const { money } = useFormat();

    return (
        <>
            <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard
                    tone="gray"
                    icon={CalendarRange}
                    label="Opening Cash"
                    value={money(Number(flow.opening))}
                    caption="Cash and bank at the start"
                />
                <SummaryCard
                    tone={Number(flow.net) >= 0 ? 'green' : 'rose'}
                    icon={ChartColumn}
                    label="Net Change in Cash"
                    value={money(Number(flow.net))}
                    caption="Inflows less outflows"
                />
                <SummaryCard
                    tone="blue"
                    icon={Wallet}
                    label="Closing Cash"
                    value={money(Number(flow.closing))}
                    caption="Cash and bank at the end"
                />
            </div>
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <table className="w-full text-sm">
                    <thead className={head}>
                        <tr>
                            <th className={`${th} text-start`}>
                                {t('Account')}
                            </th>
                            <th className={`${th} text-end`}>{t('Inflow')}</th>
                            <th className={`${th} text-end`}>{t('Outflow')}</th>
                        </tr>
                    </thead>
                    {flow.sections.map((section) => (
                        <tbody key={section.key}>
                            <tr className="border-b bg-primary/5">
                                <td
                                    colSpan={3}
                                    className="px-4 py-2.5 font-semibold"
                                >
                                    {t(SECTIONS[section.key])}
                                </td>
                            </tr>
                            {section.rows.length === 0 && (
                                <tr className="border-b">
                                    <td
                                        colSpan={3}
                                        className="px-4 py-2 ps-8 text-muted-foreground"
                                    >
                                        {t('No cash movement.')}
                                    </td>
                                </tr>
                            )}
                            {section.rows.map((row) => {
                                const amount = Number(row.amount);

                                return (
                                    <tr key={row.code} className="border-b">
                                        <td className="px-4 py-2 ps-8">
                                            <AccountLabel
                                                code={row.code}
                                                name={row.name}
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-end text-emerald-600">
                                            {amount > 0 && (
                                                <Amount value={amount} />
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-end text-rose-600">
                                            {amount < 0 && (
                                                <Amount value={-amount} />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="border-b font-semibold">
                                <td className="px-4 py-2">
                                    {t('Net Cash from :section', {
                                        section: t(SECTIONS[section.key]),
                                    })}
                                </td>
                                <td colSpan={2} className="px-4 py-2 text-end">
                                    <Amount value={section.net} />
                                </td>
                            </tr>
                        </tbody>
                    ))}
                    <tfoot className="bg-muted font-bold">
                        <tr>
                            <td className="px-4 py-3">
                                {t('Net Change in Cash')}
                            </td>
                            <td colSpan={2} className="px-4 py-3 text-end">
                                <Amount value={flow.net} />
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </>
    );
}

function ExpenseReport({ report }: { report: Expenses }) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const month = (m: string) =>
        new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, {
            month: 'short',
            year: '2-digit',
        });

    return (
        <>
            <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard
                    tone="rose"
                    icon={Receipt}
                    label="Total Expenses"
                    value={money(Number(report.total))}
                    caption="Spent in the selected period"
                />
                <SummaryCard
                    tone="orange"
                    icon={TrendingDown}
                    label="Largest Account"
                    value={
                        report.largest
                            ? money(Number(report.largest.amount))
                            : '-'
                    }
                    caption={report.largest?.name ?? 'No expenses'}
                />
                <SummaryCard
                    tone="violet"
                    icon={ChartColumn}
                    label="Monthly Average"
                    value={money(Number(report.average))}
                    caption="Total spread over the months"
                />
            </div>
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="max-h-[calc(100dvh-24rem)] overflow-auto">
                    <table className="w-full text-sm">
                        <thead className={head}>
                            <tr>
                                <th
                                    className={`${th} sticky start-0 bg-muted text-start`}
                                >
                                    {t('Account')}
                                </th>
                                {report.months.map((m) => (
                                    <th key={m} className={`${th} text-end`}>
                                        {month(m)}
                                    </th>
                                ))}
                                <th className={`${th} text-end`}>
                                    {t('Total')}
                                </th>
                                <th className={`${th} text-end`}>%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={report.months.length + 3}
                                        className="px-4 py-12 text-center text-muted-foreground"
                                    >
                                        {t('No transactions in this period.')}
                                    </td>
                                </tr>
                            )}
                            {report.rows.map((row) => (
                                <tr key={row.code} className="border-b">
                                    <td className="sticky start-0 bg-card px-4 py-2 whitespace-nowrap">
                                        <AccountLabel
                                            code={row.code}
                                            name={row.name}
                                        />
                                    </td>
                                    {row.months.map((amount, i) => (
                                        <td
                                            key={report.months[i]}
                                            className="px-4 py-2 text-end"
                                        >
                                            <Amount value={amount} dashZero />
                                        </td>
                                    ))}
                                    <td className="px-4 py-2 text-end font-semibold">
                                        <Amount value={row.total} />
                                    </td>
                                    <td className="px-4 py-2 text-end text-muted-foreground tabular-nums">
                                        {row.share.toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-muted font-semibold shadow-[inset_0_1px_0_var(--border)]">
                            <tr>
                                <td className="sticky start-0 bg-muted px-4 py-3">
                                    {t('Total')}
                                </td>
                                {report.month_totals.map((amount, i) => (
                                    <td
                                        key={report.months[i]}
                                        className="px-4 py-3 text-end"
                                    >
                                        <Amount value={amount} dashZero />
                                    </td>
                                ))}
                                <td className="px-4 py-3 text-end">
                                    <Amount value={report.total} />
                                </td>
                                <td className="px-4 py-3 text-end">100%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </>
    );
}

DoubleEntryReports.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Double Entry', href: doubleEntry.reports.index() },
        { title: 'Reports', href: doubleEntry.reports.index() },
    ],
};
