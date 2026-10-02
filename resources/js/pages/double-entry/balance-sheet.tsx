import { SummaryCard } from '@/components/summary-card';
import { Head, router, useForm } from '@inertiajs/react';
import {
    CalendarCheck,
    CircleAlert,
    CircleCheck,
    HandCoins,
    Landmark,
    PieChart,
    Scale,
    X,
} from 'lucide-react';
import { useState } from 'react';
import DatePicker from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { applyFilters } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import doubleEntry from '@/routes/double-entry';
import type { TableFilters } from '@/types';
import { AccountLabel, Amount, DateFilters, StatementHeader } from './shared';

type Group = {
    type: string;
    rows: { code: string; name: string; amount: string }[];
    total: string;
};
type Sheet = {
    assets: Group[];
    liabilities: Group[];
    equity: Group[];
    total_assets: string;
    total_liabilities: string;
    total_equity: string;
};
type Closing = {
    id: number;
    closing_date: string;
    net_profit: string;
    closer: { id: number; name: string } | null;
};

export default function BalanceSheet({
    report,
    comparison,
    closings,
    filters,
}: {
    report: Sheet;
    comparison: Sheet | null;
    closings: Closing[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { date } = useFormat();
    const can = useCan();
    const url = doubleEntry.balanceSheets.index();
    const [closeOpen, setCloseOpen] = useState(false);
    const form = useForm({ closing_date: '' });
    const equityAndLiabilities =
        Number(report.total_liabilities) + Number(report.total_equity);
    const balanced =
        Math.abs(Number(report.total_assets) - equityAndLiabilities) < 0.005;

    // The comparison amount for the same line, matched by code (or name for computed lines).
    const previous = (section: keyof Sheet, key: string) => {
        if (!comparison) {
            return undefined;
        }

        for (const group of comparison[section] as Group[]) {
            const row = group.rows.find((r) => (r.code || r.name) === key);

            if (row) {
                return row.amount;
            }
        }

        return '0';
    };

    const section = (
        key: 'assets' | 'liabilities' | 'equity',
        heading: string,
        total: string,
        compareTotal?: string,
    ) => (
        <tbody>
            <tr className="bg-muted text-muted-foreground">
                <th className="px-5 py-2.5 text-start font-medium">
                    {t(heading)}
                </th>
                <th className="px-5 py-2.5 text-end font-medium">
                    {date(String(filters.date_to))}
                </th>
                {comparison && (
                    <th className="px-5 py-2.5 text-end font-medium">
                        {date(String(filters.compare_to))}
                    </th>
                )}
            </tr>
            {report[key].map((group) => (
                <GroupRows
                    key={group.type}
                    group={group}
                    compare={(k) => previous(key, k)}
                    comparing={!!comparison}
                />
            ))}
            <tr className="border-b bg-primary/5 font-bold">
                <td className="px-5 py-3">
                    {t('Total :type', { type: t(heading) })}
                </td>
                <td className="px-5 py-3 text-end">
                    <Amount value={total} />
                </td>
                {comparison && (
                    <td className="px-5 py-3 text-end">
                        <Amount value={compareTotal ?? 0} />
                    </td>
                )}
            </tr>
        </tbody>
    );

    return (
        <>
            <Head title={t('Balance Sheet')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <StatementHeader
                    title="Balance Sheet"
                    description="What the business owns, what it owes, and the owners' equity on a date."
                    printUrl={
                        doubleEntry.balanceSheets.print({
                            query: { date_to: filters.date_to },
                        }).url
                    }
                    printPermission="print-balance-sheets"
                />
                <DateFilters
                    url={url}
                    filters={filters}
                    fields={[
                        ['date_to', 'As Of Date'],
                        ['compare_to', 'Compare With'],
                    ]}
                >
                    {filters.compare_to && (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                applyFilters(url, filters, {
                                    compare_to: undefined,
                                })
                            }
                        >
                            <X /> {t('Clear Comparison')}
                        </Button>
                    )}
                    {can('year-end-close') && (
                        <Button
                            variant="outline"
                            className="ms-auto"
                            onClick={() => {
                                form.reset();
                                form.clearErrors();
                                setCloseOpen(true);
                            }}
                        >
                            <CalendarCheck /> {t('Year-End Close')}
                        </Button>
                    )}
                </DateFilters>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        label="Total Assets"
                        icon={Landmark}
                        value={<Amount value={report.total_assets} />}
                        caption="Organization resources"
                        tone="blue"
                    />
                    <SummaryCard
                        label="Total Liabilities"
                        icon={HandCoins}
                        value={<Amount value={report.total_liabilities} />}
                        caption="Amounts owed to creditors"
                        tone="rose"
                    />
                    <SummaryCard
                        label="Total Equity"
                        icon={PieChart}
                        value={<Amount value={report.total_equity} />}
                        caption="Owner/Shareholder value"
                        tone="violet"
                    />
                    <SummaryCard
                        label="Balance Status"
                        icon={Scale}
                        value={
                            <span className="flex items-center gap-2">
                                {balanced ? (
                                    <CircleCheck className="size-6" />
                                ) : (
                                    <CircleAlert className="size-6" />
                                )}
                                {t(balanced ? 'Balanced' : 'Out of Balance')}
                            </span>
                        }
                        caption="Assets match liabilities + equity"
                        tone={balanced ? 'green' : 'orange'}
                    />
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-2">
                    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                        <table className="w-full text-sm">
                            {section(
                                'assets',
                                'Assets',
                                report.total_assets,
                                comparison?.total_assets,
                            )}
                        </table>
                    </div>
                    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                        <table className="w-full text-sm">
                            {section(
                                'liabilities',
                                'Liabilities',
                                report.total_liabilities,
                                comparison?.total_liabilities,
                            )}
                            {section(
                                'equity',
                                'Equity',
                                report.total_equity,
                                comparison?.total_equity,
                            )}
                            <tfoot>
                                <tr className="bg-muted font-bold">
                                    <td className="px-5 py-3">
                                        {t('Total Liabilities & Equity')}
                                    </td>
                                    <td className="px-5 py-3 text-end">
                                        <Amount value={equityAndLiabilities} />
                                    </td>
                                    {comparison && (
                                        <td className="px-5 py-3 text-end">
                                            <Amount
                                                value={
                                                    Number(
                                                        comparison.total_liabilities,
                                                    ) +
                                                    Number(
                                                        comparison.total_equity,
                                                    )
                                                }
                                            />
                                        </td>
                                    )}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {closings.length > 0 && (
                    <div className="rounded-xl border bg-card p-5 shadow-sm">
                        <h2 className="mb-3 font-semibold">
                            {t('Year-End Closings')}
                        </h2>
                        <ul className="grid gap-2 text-sm">
                            {closings.map((c) => (
                                <li
                                    key={c.id}
                                    className="flex flex-wrap justify-between gap-2 rounded-lg border px-4 py-2"
                                >
                                    <span>
                                        {t('Closed to :date', {
                                            date: date(c.closing_date),
                                        })}
                                        {c.closer && (
                                            <span className="text-muted-foreground">
                                                {' '}
                                                · {c.closer.name}
                                            </span>
                                        )}
                                    </span>
                                    <span>
                                        {t('Net to Retained Earnings')}:{' '}
                                        <Amount
                                            value={c.net_profit}
                                            className="font-semibold"
                                        />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <FormDialog
                open={closeOpen}
                onOpenChange={setCloseOpen}
                title="Year-End Close"
                description="Brings every revenue and expense account back to zero on the closing date and moves the net profit or loss into Retained Earnings, with one journal entry."
                icon={CalendarCheck}
                processing={form.processing}
                submitLabel="Close the Books"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post(doubleEntry.balanceSheets.yearEndClose().url, {
                        preserveScroll: true,
                        onSuccess: () => {
                            setCloseOpen(false);
                            router.reload();
                        },
                    });
                }}
            >
                <div className="grid gap-2">
                    <Label htmlFor="closing_date">
                        {t('Closing Date')}{' '}
                        <span className="text-destructive">*</span>
                    </Label>
                    <DatePicker
                        id="closing_date"
                        name="closing_date"
                        defaultValue={form.data.closing_date}
                        onChange={(v) => form.setData('closing_date', v)}
                    />
                    <InputError message={form.errors.closing_date} />
                </div>
            </FormDialog>
        </>
    );
}

function GroupRows({
    group,
    compare,
    comparing,
}: {
    group: Group;
    compare: (key: string) => string | undefined;
    comparing: boolean;
}) {
    const { t } = useTranslation();

    return (
        <>
            <tr className="border-b">
                <td
                    colSpan={comparing ? 3 : 2}
                    className="px-5 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                    {t(group.type)}
                </td>
            </tr>
            {group.rows.map((row) => (
                <tr key={row.code || row.name} className="border-b">
                    <td className="px-5 py-2 ps-8">
                        <AccountLabel code={row.code} name={row.name} />
                    </td>
                    <td className="px-5 py-2 text-end">
                        <Amount value={row.amount} />
                    </td>
                    {comparing && (
                        <td className="px-5 py-2 text-end text-muted-foreground">
                            <Amount
                                value={compare(row.code || row.name) ?? 0}
                            />
                        </td>
                    )}
                </tr>
            ))}
            <tr className="border-b font-semibold">
                <td className="px-5 py-2">
                    {t('Total :type', { type: t(group.type) })}
                </td>
                <td className="px-5 py-2 text-end">
                    <Amount value={group.total} />
                </td>
                {comparing && <td />}
            </tr>
        </>
    );
}

BalanceSheet.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Double Entry', href: doubleEntry.balanceSheets.index() },
        { title: 'Balance Sheet', href: doubleEntry.balanceSheets.index() },
    ],
};
