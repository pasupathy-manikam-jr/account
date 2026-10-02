import { Head, Link, router } from '@inertiajs/react';
import {
    CircleCheck,
    Eye,
    FileText,
    Flag,
    Play,
    Plus,
    SquarePen,
    Target,
    Trash2,
    TrendingUp,
} from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { SummaryCard } from '@/components/summary-card';
import { FilterSelect, StatusTabs } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import goalRoutes from '@/routes/goal';
import type { Paginated, TableFilters } from '@/types';
import { GoalForm } from './goal-form';
import { ProgressBar } from './progress-bar';
import { GOAL_TYPES, PRIORITIES, progressOf, titleCase } from './types';
import type { Goal, GoalOptions } from './types';

export default function Goals({
    goals,
    counts,
    stats,
    categories,
    chartOfAccounts,
    filters,
}: GoalOptions & {
    goals: Paginated<Goal>;
    counts: Record<string, number>;
    stats: {
        total: number;
        active: number;
        completed: number;
        draft: number;
        target: string;
        current: string;
    };
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const url = goalRoutes.goals.index();
    const [editing, setEditing] = useState<{ goal: Goal | null } | null>(null);
    const [deleting, setDeleting] = useState<Goal | null>(null);
    const share = (n: number) =>
        stats.total ? Math.round((n / stats.total) * 100) : 0;
    const overall = progressOf({
        current_amount: stats.current,
        target_amount: stats.target,
    });

    const action = (
        label: string,
        icon: ReactNode,
        props: ComponentProps<typeof Button>,
    ) => (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t(label)}
                    {...props}
                >
                    {icon}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{t(label)}</TooltipContent>
        </Tooltip>
    );

    const columns: Column<Goal>[] = [
        {
            key: 'goal_name',
            label: 'Goal',
            sortable: true,
            render: (g) => (
                <div className="max-w-52">
                    <Link
                        href={goalRoutes.goals.show(g.id)}
                        className="font-medium hover:underline"
                    >
                        {g.goal_name}
                    </Link>
                    {g.description && (
                        <div className="truncate text-xs text-muted-foreground">
                            {g.description}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'category',
            label: 'Category',
            render: (g) => <span>{g.category?.category_name ?? '-'}</span>,
        },
        {
            key: 'goal_type',
            label: 'Type',
            render: (g) => <span>{t(titleCase(g.goal_type))}</span>,
        },
        {
            key: 'target_amount',
            label: 'Target / Current',
            sortable: true,
            render: (g) => (
                <div className="whitespace-nowrap tabular-nums">
                    <div className="font-medium">
                        {money(Number(g.target_amount))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {money(Number(g.current_amount ?? 0))}
                    </div>
                </div>
            ),
        },
        {
            key: 'progress',
            label: 'Progress',
            render: (g) => (
                <ProgressBar value={progressOf(g)} className="w-32" />
            ),
        },
        {
            key: 'target_date',
            label: 'Target Date',
            sortable: true,
            render: (g) => (
                <div className="whitespace-nowrap">
                    <div>{date(g.target_date)}</div>
                    {g.status === 'active' &&
                        g.target_date <
                            new Date().toISOString().slice(0, 10) && (
                            <div className="text-xs text-destructive">
                                {t('Overdue')}
                            </div>
                        )}
                </div>
            ),
        },
        {
            key: 'priority',
            label: 'Priority',
            render: (g) => <StatusBadge status={g.priority} />,
        },
        {
            key: 'status',
            label: 'Status',
            render: (g) => <StatusBadge status={g.status} />,
        },
    ];

    return (
        <>
            <Head title={t('Goals')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Goals"
                    description="Set, track, and manage organization goals, milestones, target dates, and progress metrics."
                    action={
                        can('create-goals') && (
                            <Button onClick={() => setEditing({ goal: null })}>
                                <Plus /> {t('Create Goal')}
                            </Button>
                        )
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <SummaryCard
                        tone="blue"
                        icon={Target}
                        label="Total Goals"
                        value={stats.total}
                        caption="All time"
                    />
                    <SummaryCard
                        tone="green"
                        icon={Play}
                        label="Active"
                        value={stats.active}
                        caption={t(':percent% of total', {
                            percent: share(stats.active),
                        })}
                    />
                    <SummaryCard
                        tone="teal"
                        icon={CircleCheck}
                        label="Completed"
                        value={stats.completed}
                        caption={t(':percent% of total', {
                            percent: share(stats.completed),
                        })}
                    />
                    <SummaryCard
                        tone="gray"
                        icon={FileText}
                        label="Draft"
                        value={stats.draft}
                        caption={t(':percent% of total', {
                            percent: share(stats.draft),
                        })}
                    />
                    <SummaryCard
                        tone="violet"
                        icon={Flag}
                        label="Total Target"
                        value={money(Number(stats.target))}
                        caption="Total target value"
                    />
                    <SummaryCard
                        tone="orange"
                        icon={TrendingUp}
                        label="Current Progress"
                        value={money(Number(stats.current))}
                        caption={t(':percent% of total target', {
                            percent: overall,
                        })}
                    />
                </div>

                <DataTable
                    data={goals}
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
                        <>
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="category_id"
                                label="All Categories"
                                options={categories.map((c) => ({
                                    id: c.id,
                                    name: c.category_name,
                                }))}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="priority"
                                label="All Priorities"
                                options={PRIORITIES.map((p) => ({
                                    id: p,
                                    name: t(titleCase(p)),
                                }))}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="goal_type"
                                label="All Types"
                                options={GOAL_TYPES.map((type) => ({
                                    id: type,
                                    name: t(titleCase(type)),
                                }))}
                            />
                        </>
                    }
                    actions={(g) => (
                        <>
                            {can('view-goals') &&
                                action(
                                    'View',
                                    <Eye className="text-emerald-600" />,
                                    {
                                        onClick: () =>
                                            router.visit(
                                                goalRoutes.goals.show(g.id),
                                            ),
                                    },
                                )}
                            {g.status === 'draft' &&
                                can('active-goals') &&
                                action(
                                    'Activate',
                                    <Play className="text-emerald-600" />,
                                    {
                                        onClick: () =>
                                            router.put(
                                                goalRoutes.goals.activate(g.id),
                                                {},
                                                { preserveScroll: true },
                                            ),
                                    },
                                )}
                            {['draft', 'active'].includes(g.status) &&
                                can('edit-goals') &&
                                action(
                                    'Edit',
                                    <SquarePen className="text-blue-600" />,
                                    { onClick: () => setEditing({ goal: g }) },
                                )}
                            {['draft', 'cancelled'].includes(g.status) &&
                                can('delete-goals') &&
                                action(
                                    'Delete',
                                    <Trash2 className="text-destructive" />,
                                    { onClick: () => setDeleting(g) },
                                )}
                        </>
                    )}
                />
            </div>

            {editing && (
                <GoalForm
                    goal={editing.goal}
                    categories={categories}
                    chartOfAccounts={chartOfAccounts}
                    onClose={() => setEditing(null)}
                />
            )}

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This goal, its milestones and contributions will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(goalRoutes.goals.destroy(deleting.id), {
                        preserveScroll: true,
                        onFinish: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

Goals.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Goal', href: goalRoutes.goals.index() },
        { title: 'Goals', href: goalRoutes.goals.index() },
    ],
};
