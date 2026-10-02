import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { SummaryCard } from '@/components/summary-card';
import { Head } from '@inertiajs/react';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import doubleEntry from '@/routes/double-entry';
import type { TableFilters } from '@/types';
import { AccountLabel, Amount, DateFilters, StatementHeader } from './shared';

type Line = { code: string; name: string; amount: string };
type Report = {
    revenue: Line[];
    expenses: Line[];
    total_revenue: string;
    total_expenses: string;
    net: string;
};

export default function ProfitLoss({
    report,
    filters,
}: {
    report: Report;
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const profit = Number(report.net) >= 0;
    const sections = [
        ['Revenue', report.revenue, 'Total Revenue', report.total_revenue],
        ['Expenses', report.expenses, 'Total Expenses', report.total_expenses],
    ] as const;

    return (
        <>
            <Head title={t('Profit & Loss')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <StatementHeader
                    title="Profit & Loss Statement"
                    description="Revenue earned and expenses incurred in the period, and the profit they leave."
                    printUrl={
                        doubleEntry.profitLoss.print({ query: filters }).url
                    }
                    printPermission="print-profit-loss"
                />
                <DateFilters
                    url={doubleEntry.profitLoss.index()}
                    filters={filters}
                    fields={[
                        ['date_from', 'From Date'],
                        ['date_to', 'To Date'],
                    ]}
                />
                <div className="grid gap-4 md:grid-cols-3">
                    <SummaryCard
                        label="Total Revenue"
                        icon={TrendingUp}
                        value={<Amount value={report.total_revenue} />}
                        caption="Earned income streams"
                        tone="green"
                    />
                    <SummaryCard
                        label="Total Expenses"
                        icon={TrendingDown}
                        value={<Amount value={report.total_expenses} />}
                        caption="Operational and capital costs"
                        tone="rose"
                    />
                    <SummaryCard
                        label={profit ? 'Net Profit' : 'Net Loss'}
                        icon={Wallet}
                        value={<Amount value={report.net} />}
                        caption={
                            profit
                                ? 'Positive net earnings'
                                : 'Expenses exceeded revenue'
                        }
                        tone={profit ? 'blue' : 'orange'}
                    />
                </div>
                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="border-b px-5 py-4">
                        <h2 className="text-lg font-semibold">
                            {t('Statement of Profit or Loss')}
                        </h2>
                    </div>
                    <table className="w-full text-sm">
                        {sections.map(([heading, lines, totalLabel, total]) => (
                            <tbody key={heading}>
                                <tr className="bg-muted text-muted-foreground">
                                    <th
                                        colSpan={2}
                                        className="px-5 py-2.5 text-start font-medium"
                                    >
                                        {t(heading)}
                                    </th>
                                </tr>
                                {lines.length === 0 && (
                                    <tr className="border-b">
                                        <td
                                            colSpan={2}
                                            className="px-5 py-3 text-muted-foreground"
                                        >
                                            {t(
                                                'Nothing posted in this period.',
                                            )}
                                        </td>
                                    </tr>
                                )}
                                {lines.map((line) => (
                                    <tr key={line.code} className="border-b">
                                        <td className="px-5 py-2.5 ps-8">
                                            <AccountLabel
                                                code={line.code}
                                                name={line.name}
                                            />
                                        </td>
                                        <td className="px-5 py-2.5 text-end">
                                            <Amount value={line.amount} />
                                        </td>
                                    </tr>
                                ))}
                                <tr className="border-b font-semibold">
                                    <td className="px-5 py-3">
                                        {t(totalLabel)}
                                    </td>
                                    <td className="px-5 py-3 text-end">
                                        <Amount value={total} />
                                    </td>
                                </tr>
                            </tbody>
                        ))}
                        <tfoot>
                            <tr className="bg-primary/5 text-base font-bold">
                                <td className="px-5 py-4">
                                    {t(profit ? 'Net Profit' : 'Net Loss')}
                                </td>
                                <td
                                    className={cn(
                                        'px-5 py-4 text-end',
                                        profit
                                            ? 'text-emerald-600'
                                            : 'text-rose-600',
                                    )}
                                >
                                    <Amount value={report.net} />
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </>
    );
}

ProfitLoss.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Double Entry', href: doubleEntry.profitLoss.index() },
        { title: 'Profit & Loss', href: doubleEntry.profitLoss.index() },
    ],
};
