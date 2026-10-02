import { Head } from '@inertiajs/react';
import { PageHeader } from '@/components/page-header';
import { FilterSelect } from '@/components/table-filters';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import budgetPlanner from '@/routes/budget-planner';
import type { TableFilters } from '@/types';
import { SpendCards, Utilization } from '../utilization';

type Row = {
    key: string;
    budget_id: number;
    budget_name: string;
    date: string;
    allocated: string;
    planned: string;
    spent: string;
    variance: string;
    variance_percentage: number;
};

export default function BudgetMonitoring({
    rows,
    stats,
    budgets,
    filters,
}: {
    rows: Row[];
    stats: { budgets: number; allocated: string; spent: string };
    budgets: { id: number; name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const url = budgetPlanner.budgetMonitoring.index();
    const th = 'px-4 py-3 font-medium whitespace-nowrap';

    return (
        <>
            <Head title={t('Budget Monitoring')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Budget Monitoring"
                    description="Month by month, what each live budget planned to spend by then against what the ledger shows was spent."
                />
                <SpendCards
                    count={stats.budgets}
                    countLabel="Monitored Budgets"
                    countHint="Active and closed budgets"
                    allocated={Number(stats.allocated)}
                    spent={Number(stats.spent)}
                />

                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <FilterSelect
                            url={url}
                            filters={filters}
                            name="budget_id"
                            label="All Budgets"
                            options={budgets}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t(
                                'Planned to date spreads each budget evenly over its period. A negative variance means spending is ahead of plan.',
                            )}
                        </p>
                    </div>
                    <div className="max-h-[calc(100dvh-24rem)] overflow-auto border-t">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-muted text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
                                <tr>
                                    <th className={cn(th, 'text-start')}>
                                        {t('Budget')}
                                    </th>
                                    <th className={cn(th, 'text-start')}>
                                        {t('Date')}
                                    </th>
                                    <th className={cn(th, 'text-start')}>
                                        {t('Utilization')}
                                    </th>
                                    <th className={cn(th, 'text-end')}>
                                        {t('Planned to Date')}
                                    </th>
                                    <th className={cn(th, 'text-end')}>
                                        {t('Variance')}
                                    </th>
                                    <th className={cn(th, 'text-end')}>
                                        {t('Variance Percentage')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-4 py-12 text-center text-muted-foreground"
                                        >
                                            {t(
                                                'No active or closed budgets yet.',
                                            )}
                                        </td>
                                    </tr>
                                )}
                                {rows.map((row) => {
                                    const variance = Number(row.variance);

                                    return (
                                        <tr key={row.key} className="border-b">
                                            <td className="px-4 py-2 font-medium">
                                                {row.budget_name}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                {date(row.date)}
                                            </td>
                                            <td className="px-4 py-2">
                                                <Utilization
                                                    total={Number(
                                                        row.allocated,
                                                    )}
                                                    spent={Number(row.spent)}
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-end whitespace-nowrap tabular-nums">
                                                {money(Number(row.planned))}
                                            </td>
                                            <td
                                                className={cn(
                                                    'px-4 py-2 text-end font-semibold whitespace-nowrap tabular-nums',
                                                    variance < 0
                                                        ? 'text-rose-600'
                                                        : 'text-emerald-600',
                                                )}
                                            >
                                                {money(variance)}
                                            </td>
                                            <td className="px-4 py-2 text-end whitespace-nowrap tabular-nums">
                                                {row.variance_percentage.toFixed(
                                                    2,
                                                )}
                                                %
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

BudgetMonitoring.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Budget Planner', href: budgetPlanner.budgets.index() },
        {
            title: 'Budget Monitoring',
            href: budgetPlanner.budgetMonitoring.index(),
        },
    ],
};
