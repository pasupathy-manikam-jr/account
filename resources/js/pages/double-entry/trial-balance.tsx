import { SummaryCard } from '@/components/summary-card';
import { Head } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowUpRight,
    CircleAlert,
    CircleCheck,
    Scale,
} from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import doubleEntry from '@/routes/double-entry';
import type { TableFilters } from '@/types';
import { Amount, DateFilters, StatementHeader } from './shared';

type Report = {
    rows: { code: string; name: string; debit: string; credit: string }[];
    debit: string;
    credit: string;
};

export default function TrialBalance({
    report,
    filters,
}: {
    report: Report;
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const balanced = report.debit === report.credit;
    const th = 'px-4 py-3 font-medium';

    return (
        <>
            <Head title={t('Trial Balance')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <StatementHeader
                    title="Trial Balance"
                    description="Every account's balance on the date, as a debit or credit. Total debits must equal total credits."
                    printUrl={
                        doubleEntry.trialBalance.print({ query: filters }).url
                    }
                    printPermission="print-trial-balance"
                />
                <DateFilters
                    url={doubleEntry.trialBalance.index()}
                    filters={filters}
                    fields={[['date_to', 'As Of Date']]}
                />
                <div className="grid gap-4 md:grid-cols-3">
                    <SummaryCard
                        label="Total Debit"
                        icon={ArrowDownLeft}
                        value={<Amount value={report.debit} />}
                        caption="Total debited amount"
                        tone="blue"
                    />
                    <SummaryCard
                        label="Total Credit"
                        icon={ArrowUpRight}
                        value={<Amount value={report.credit} />}
                        caption="Total credited amount"
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
                        caption={
                            balanced
                                ? 'All accounts are balanced'
                                : 'Debits and credits differ'
                        }
                        tone={balanced ? 'green' : 'rose'}
                    />
                </div>
                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="max-h-[calc(100dvh-22rem)] overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-muted text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
                                <tr>
                                    <th className={`${th} text-start`}>
                                        {t('Account Code')}
                                    </th>
                                    <th className={`${th} text-start`}>
                                        {t('Account Name')}
                                    </th>
                                    <th className={`${th} text-end`}>
                                        {t('Debit')}
                                    </th>
                                    <th className={`${th} text-end`}>
                                        {t('Credit')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.rows.map((row) => (
                                    <tr
                                        key={row.code || row.name}
                                        className="border-b"
                                    >
                                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                                            {row.code || '-'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {row.name}
                                        </td>
                                        <td className="px-4 py-2.5 text-end">
                                            <Amount
                                                value={row.debit}
                                                dashZero
                                            />
                                        </td>
                                        <td className="px-4 py-2.5 text-end">
                                            <Amount
                                                value={row.credit}
                                                dashZero
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="sticky bottom-0 bg-muted font-semibold shadow-[inset_0_1px_0_var(--border)]">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3">
                                        {t('Total')}
                                    </td>
                                    <td className="px-4 py-3 text-end">
                                        <Amount value={report.debit} />
                                    </td>
                                    <td className="px-4 py-3 text-end">
                                        <Amount value={report.credit} />
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

TrialBalance.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Double Entry', href: doubleEntry.trialBalance.index() },
        { title: 'Trial Balance', href: doubleEntry.trialBalance.index() },
    ],
};
