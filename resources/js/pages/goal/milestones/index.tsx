import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    CircleAlert,
    CircleCheck,
    Clock,
    Flag,
    Plus,
    SquarePen,
    Trash2,
    TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import DatePicker from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { SummaryCard } from '@/components/summary-card';
import { FilterSelect, StatusTabs } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import goalRoutes from '@/routes/goal';
import { ProgressBar } from '../goals/progress-bar';
import type { Paginated, TableFilters } from '@/types';

type Milestone = {
    id: number;
    goal_id: number;
    milestone_name: string;
    description: string | null;
    target_amount: string;
    target_date: string;
    achieved_date: string | null;
    status: string;
    goal: {
        id: number;
        goal_name: string;
        status: string;
        current_amount: string | null;
    };
};

const blank = {
    goal_id: '',
    milestone_name: '',
    target_amount: '',
    target_date: '',
    description: '',
};

export default function Milestones({
    milestones,
    counts,
    stats,
    goals,
    filters,
}: {
    milestones: Paginated<Milestone>;
    counts: Record<string, number>;
    stats: {
        total: number;
        achieved: number;
        pending: number;
        overdue: number;
        achieved_amount: string;
        ratio: number;
    };
    goals: { id: number; goal_name: string; target_amount: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const url = goalRoutes.milestones.index();
    const form = useForm(blank);
    const [editing, setEditing] = useState<Milestone | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Milestone | null>(null);
    const required = <span className="text-destructive">*</span>;

    const openForm = (m: Milestone | null) => {
        setEditing(m);
        form.clearErrors();
        form.setData(
            m
                ? {
                      goal_id: String(m.goal_id),
                      milestone_name: m.milestone_name,
                      target_amount: m.target_amount,
                      target_date: m.target_date,
                      description: m.description ?? '',
                  }
                : blank,
        );
        setFormOpen(true);
    };

    // Contributions count towards each milestone up to its own target.
    const achieved = (m: Milestone) =>
        Math.min(Number(m.goal.current_amount ?? 0), Number(m.target_amount));

    const columns: Column<Milestone>[] = [
        {
            key: 'milestone_name',
            label: 'Milestone / Goal',
            sortable: true,
            render: (m) => (
                <div>
                    <div className="font-medium">{m.milestone_name}</div>
                    <Link
                        href={goalRoutes.goals.show(m.goal_id)}
                        className="text-xs text-muted-foreground hover:underline"
                    >
                        {m.goal.goal_name}
                    </Link>
                </div>
            ),
        },
        {
            key: 'target_amount',
            label: 'Target / Achieved',
            sortable: true,
            render: (m) => (
                <div className="whitespace-nowrap tabular-nums">
                    <div className="font-medium">
                        {money(Number(m.target_amount))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {money(achieved(m))}
                    </div>
                </div>
            ),
        },
        {
            key: 'progress',
            label: 'Progress',
            render: (m) => (
                <ProgressBar
                    className="min-w-32"
                    value={
                        Number(m.target_amount) > 0
                            ? Math.min(
                                  100,
                                  Math.round(
                                      (achieved(m) / Number(m.target_amount)) *
                                          100,
                                  ),
                              )
                            : 0
                    }
                />
            ),
        },
        {
            key: 'achieved_date',
            label: 'Achieved Date',
            sortable: true,
            render: (m) => (m.achieved_date ? date(m.achieved_date) : '-'),
        },
        {
            key: 'target_date',
            label: 'Target Date',
            sortable: true,
            render: (m) => (
                <span className="whitespace-nowrap">{date(m.target_date)}</span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (m) => <StatusBadge status={m.status} />,
        },
    ];

    return (
        <>
            <Head title={t('Milestones')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Milestones"
                    description="Checkpoints on the way to each goal. A milestone is achieved when the goal's contributions reach its amount."
                    action={
                        can('create-goal-milestones') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Create Milestone')}
                            </Button>
                        )
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                    <SummaryCard
                        tone="blue"
                        icon={Flag}
                        label="Total Milestones"
                        value={stats.total}
                        caption="All time"
                    />
                    <SummaryCard
                        tone="green"
                        icon={CircleCheck}
                        label="Achieved"
                        value={stats.achieved}
                        caption="Reached by contributions"
                    />
                    <SummaryCard
                        tone="orange"
                        icon={Clock}
                        label="Pending"
                        value={stats.pending}
                        caption="Still on schedule"
                    />
                    <SummaryCard
                        tone="rose"
                        icon={CircleAlert}
                        label="Overdue"
                        value={stats.overdue}
                        caption="Requires action"
                    />
                    <SummaryCard
                        tone="violet"
                        icon={TrendingUp}
                        label="Achieved Amount"
                        value={money(Number(stats.achieved_amount))}
                        caption={t(':percent% of milestone targets', {
                            percent: stats.ratio,
                        })}
                    />
                </div>

                <DataTable
                    data={milestones}
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
                    actions={(m) => (
                        <>
                            {can('edit-goal-milestones') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Edit')}
                                    onClick={() => openForm(m)}
                                >
                                    <SquarePen className="text-blue-600" />
                                </Button>
                            )}
                            {can('delete-goal-milestones') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Delete')}
                                    onClick={() => setDeleting(m)}
                                >
                                    <Trash2 className="text-destructive" />
                                </Button>
                            )}
                        </>
                    )}
                />
            </div>

            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title={editing ? 'Edit Milestone' : 'Create Milestone'}
                description="The total contributed to the goal that marks this milestone."
                icon={Flag}
                processing={form.processing}
                onSubmit={(e) => {
                    e.preventDefault();
                    form.submit(
                        editing
                            ? goalRoutes.milestones.update(editing.id)
                            : goalRoutes.milestones.store(),
                        {
                            preserveScroll: true,
                            onSuccess: () => setFormOpen(false),
                        },
                    );
                }}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="goal_id">
                            {t('Goal')} {required}
                        </Label>
                        <SelectField
                            id="goal_id"
                            value={form.data.goal_id}
                            placeholder={t('Select Goal')}
                            onChange={(e) =>
                                form.setData('goal_id', e.target.value)
                            }
                        >
                            {goals.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.goal_name} (
                                    {money(Number(g.target_amount))})
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.goal_id} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="milestone_name">
                            {t('Milestone Name')} {required}
                        </Label>
                        <Input
                            id="milestone_name"
                            value={form.data.milestone_name}
                            onChange={(e) =>
                                form.setData('milestone_name', e.target.value)
                            }
                        />
                        <InputError message={form.errors.milestone_name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="target_amount">
                            {t('Target Amount')} {required}
                        </Label>
                        <Input
                            id="target_amount"
                            inputMode="decimal"
                            value={form.data.target_amount}
                            onChange={(e) =>
                                form.setData('target_amount', e.target.value)
                            }
                        />
                        <InputError message={form.errors.target_amount} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="target_date">
                            {t('Target Date')} {required}
                        </Label>
                        <DatePicker
                            key={`${editing?.id ?? 'new'}-${formOpen}`}
                            id="target_date"
                            name="target_date"
                            defaultValue={form.data.target_date}
                            placeholder={t('Select target date')}
                            invalid={!!form.errors.target_date}
                            onChange={(v) => form.setData('target_date', v)}
                        />
                        <InputError message={form.errors.target_date} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="description">{t('Description')}</Label>
                        <Textarea
                            id="description"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                        />
                        <InputError message={form.errors.description} />
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This milestone will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(goalRoutes.milestones.destroy(deleting.id), {
                        preserveScroll: true,
                        onFinish: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

Milestones.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Goal', href: goalRoutes.goals.index() },
        { title: 'Milestones', href: goalRoutes.milestones.index() },
    ],
};
