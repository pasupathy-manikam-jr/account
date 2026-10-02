import { Head, Link } from '@inertiajs/react';
import {
    Activity,
    CircleAlert,
    CircleCheck,
    TrendingDown,
    Wallet,
} from 'lucide-react';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { SummaryCard } from '@/components/summary-card';
import { FilterSelect, StatusTabs } from '@/components/table-filters';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import goalRoutes from '@/routes/goal';
import type { Paginated, TableFilters } from '@/types';
import { ProgressBar } from '../goals/progress-bar';
import { titleCase } from '../goals/types';

type Tracking = {
    id: number;
    goal_id: number;
    goal_name: string;
    goal_type: string;
    date: string;
    days_left: number;
    amount: string;
    running_total: string;
    progress: number;
    status: 'ahead' | 'on_track' | 'behind' | 'critical';
};

export default function GoalTracking({
    trackings,
    counts,
    stats,
    goals,
    filters,
}: {
    trackings: Paginated<Tracking>;
    counts: Record<string, number>;
    stats: { total_contributions: string };
    goals: { id: number; goal_name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const url = goalRoutes.tracking.index();

    const columns: Column<Tracking>[] = [
        {
            key: 'goal',
            label: 'Goal',
            render: (r) => (
                <div>
                    <Link
                        href={goalRoutes.goals.show(r.goal_id)}
                        className="font-medium hover:underline"
                    >
                        {r.goal_name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                        {t('Goal Type')}: {t(titleCase(r.goal_type))}
                    </div>
                </div>
            ),
        },
        {
            key: 'date',
            label: 'Date',
            render: (r) => (
                <div className="whitespace-nowrap">
                    <div>{date(r.date)}</div>
                    <div className="text-xs text-muted-foreground">
                        {r.days_left >= 0
                            ? t(':days days left', { days: r.days_left })
                            : t(':days days past target', {
                                  days: -r.days_left,
                              })}
                    </div>
                </div>
            ),
        },
        {
            key: 'amount',
            label: 'Contribution / Current',
            render: (r) => (
                <div className="whitespace-nowrap tabular-nums">
                    <div className="font-medium">{money(Number(r.amount))}</div>
                    <div className="text-xs text-muted-foreground">
                        {money(Number(r.running_total))}
                    </div>
                </div>
            ),
        },
        {
            key: 'progress',
            label: 'Progress',
            render: (r) => <ProgressBar value={Math.round(r.progress)} />,
        },
        {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
        },
    ];

    return (
        <>
            <Head title={t('Tracking')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Tracking"
                    description="Each contribution with the goal's running total, progress and pace against the time elapsed."
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                    <SummaryCard
                        tone="blue"
                        icon={Activity}
                        label="Total Trackings"
                        value={counts.all}
                        caption="All records"
                    />
                    <SummaryCard
                        tone="green"
                        icon={CircleCheck}
                        label="On Track"
                        value={counts.ahead + counts.on_track}
                        caption="On track / Ahead"
                    />
                    <SummaryCard
                        tone="orange"
                        icon={TrendingDown}
                        label="Behind"
                        value={counts.behind}
                        caption="Requires focus"
                    />
                    <SummaryCard
                        tone="rose"
                        icon={CircleAlert}
                        label="Critical"
                        value={counts.critical}
                        caption="Immediate action"
                    />
                    <SummaryCard
                        tone="violet"
                        icon={Wallet}
                        label="Total Contributions"
                        value={money(Number(stats.total_contributions))}
                        caption="Cumulative contribution"
                    />
                </div>

                <DataTable
                    data={trackings}
                    columns={columns}
                    filters={filters}
                    url={url}
                    tabs={
                        <StatusTabs
                            url={url}
                            filters={filters}
                            counts={counts}
                        />
                    }
                    moreFilters={
                        <FilterSelect
                            url={url}
                            filters={filters}
                            name="goal_id"
                            label="All Goals"
                            options={goals.map((g) => ({
                                id: g.id,
                                name: g.goal_name,
                            }))}
                        />
                    }
                />
            </div>
        </>
    );
}

GoalTracking.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Goal', href: goalRoutes.goals.index() },
        { title: 'Tracking', href: goalRoutes.tracking.index() },
    ],
};
