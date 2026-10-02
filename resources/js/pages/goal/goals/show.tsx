import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    BookOpen,
    CalendarDays,
    CircleCheck,
    Flag,
    HandCoins,
    Layers,
    Play,
    SquarePen,
    Tag,
    Target,
    Trash2,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DocCard, Fact } from '@/components/sales-document';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import goalRoutes from '@/routes/goal';
import { GoalForm } from './goal-form';
import { ProgressBar } from './progress-bar';
import { progressOf, titleCase } from './types';
import type { Goal, GoalOptions } from './types';

type ShownGoal = Goal & {
    chart_of_account: {
        id: number;
        account_code: string;
        account_name: string;
    } | null;
    milestones: {
        id: number;
        milestone_name: string;
        target_amount: string;
        target_date: string;
        achieved_date: string | null;
        status: string;
    }[];
    contributions: {
        id: number;
        contribution_date: string;
        amount: string;
        contribution_type: string;
        notes: string | null;
    }[];
};

export default function GoalShow({
    goal,
    categories,
    chartOfAccounts,
}: GoalOptions & { goal: ShownGoal }) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const [editing, setEditing] = useState(false);
    const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
    const progress = progressOf(goal);
    const current = Number(goal.current_amount ?? 0);
    const remaining = Math.max(0, Number(goal.target_amount) - current);
    const put = (route: ReturnType<typeof goalRoutes.goals.activate>) =>
        router.put(route, {}, { preserveScroll: true });

    return (
        <>
            <Head title={goal.goal_name} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">{goal.goal_name}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'Progress, milestones and contributions for this goal.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={goalRoutes.goals.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard icon={Target} title="Goal Details">
                            <div className="grid gap-6 sm:grid-cols-2">
                                <Fact icon={Tag} label="Category">
                                    {goal.category?.category_name ?? '-'}
                                </Fact>
                                <Fact icon={Layers} label="Goal Type">
                                    {t(titleCase(goal.goal_type))}
                                </Fact>
                                <Fact icon={CalendarDays} label="Start Date">
                                    {date(goal.start_date)}
                                </Fact>
                                <Fact icon={CalendarDays} label="Target Date">
                                    {date(goal.target_date)}
                                </Fact>
                                <Fact icon={Flag} label="Priority">
                                    <StatusBadge status={goal.priority} />
                                </Fact>
                                <Fact icon={BookOpen} label="Chart of Account">
                                    {goal.chart_of_account
                                        ? `${goal.chart_of_account.account_code} - ${goal.chart_of_account.account_name}`
                                        : '-'}
                                </Fact>
                            </div>
                            {goal.description && (
                                <p className="mt-6 text-sm whitespace-pre-line text-muted-foreground">
                                    {goal.description}
                                </p>
                            )}
                        </DocCard>

                        <DocCard icon={Flag} title="Milestones">
                            {goal.milestones.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t('No milestones yet.')}
                                </p>
                            ) : (
                                <ul className="grid gap-3">
                                    {goal.milestones.map((m) => (
                                        <li
                                            key={m.id}
                                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                                        >
                                            <div className="min-w-0">
                                                <div className="font-medium">
                                                    {m.milestone_name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {t('Target Date')}:{' '}
                                                    {date(m.target_date)}
                                                    {m.achieved_date &&
                                                        ` · ${t('Achieved')}: ${date(m.achieved_date)}`}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-semibold tabular-nums">
                                                    {money(
                                                        Number(m.target_amount),
                                                    )}
                                                </span>
                                                <StatusBadge
                                                    status={m.status}
                                                />
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </DocCard>

                        <DocCard icon={HandCoins} title="Contributions">
                            {goal.contributions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t('No contributions yet.')}
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-muted-foreground">
                                            <tr className="border-b">
                                                <th className="py-2 text-start font-medium">
                                                    {t('Date')}
                                                </th>
                                                <th className="py-2 text-start font-medium">
                                                    {t('Notes')}
                                                </th>
                                                <th className="py-2 text-start font-medium">
                                                    {t('Type')}
                                                </th>
                                                <th className="py-2 text-end font-medium">
                                                    {t('Amount')}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {goal.contributions.map((c) => (
                                                <tr
                                                    key={c.id}
                                                    className="border-b last:border-0"
                                                >
                                                    <td className="py-2 whitespace-nowrap">
                                                        {date(
                                                            c.contribution_date,
                                                        )}
                                                    </td>
                                                    <td className="py-2 text-muted-foreground">
                                                        {c.notes ?? '-'}
                                                    </td>
                                                    <td className="py-2">
                                                        <StatusBadge
                                                            status={
                                                                c.contribution_type
                                                            }
                                                        />
                                                    </td>
                                                    <td className="py-2 text-end font-medium whitespace-nowrap tabular-nums">
                                                        {money(
                                                            Number(c.amount),
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </DocCard>
                    </div>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={Target} title="Summary & Actions">
                            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t('Current Amount')}
                            </div>
                            <div className="mt-1 text-3xl font-bold tabular-nums">
                                {money(current)}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                                {t('of :target target', {
                                    target: money(Number(goal.target_amount)),
                                })}
                            </div>
                            <ProgressBar value={progress} className="mt-4" />
                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {t('Remaining')}
                                </span>
                                <span className="font-medium tabular-nums">
                                    {money(remaining)}
                                </span>
                            </div>
                            <div className="mt-3">
                                <StatusBadge status={goal.status} />
                            </div>
                            <div className="mt-6 grid gap-2">
                                {goal.status === 'draft' &&
                                    can('active-goals') && (
                                        <Button
                                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                                            onClick={() =>
                                                put(
                                                    goalRoutes.goals.activate(
                                                        goal.id,
                                                    ),
                                                )
                                            }
                                        >
                                            <Play /> {t('Activate')}
                                        </Button>
                                    )}
                                {goal.status === 'active' &&
                                    can('edit-goals') && (
                                        <Button
                                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                                            onClick={() =>
                                                put(
                                                    goalRoutes.goals.complete(
                                                        goal.id,
                                                    ),
                                                )
                                            }
                                        >
                                            <CircleCheck />{' '}
                                            {t('Mark as Completed')}
                                        </Button>
                                    )}
                                {goal.status === 'active' &&
                                    can('manage-goal-contributions') && (
                                        <Button variant="outline" asChild>
                                            <Link
                                                href={goalRoutes.contributions.index(
                                                    {
                                                        query: {
                                                            goal_id: goal.id,
                                                        },
                                                    },
                                                )}
                                            >
                                                <HandCoins />{' '}
                                                {t('Contributions')}
                                            </Link>
                                        </Button>
                                    )}
                                {['draft', 'active'].includes(goal.status) &&
                                    can('edit-goals') && (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() => setEditing(true)}
                                            >
                                                <SquarePen /> {t('Edit')}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="text-destructive"
                                                onClick={() =>
                                                    setConfirm('cancel')
                                                }
                                            >
                                                <X /> {t('Cancel Goal')}
                                            </Button>
                                        </>
                                    )}
                                {['draft', 'cancelled'].includes(goal.status) &&
                                    can('delete-goals') && (
                                        <Button
                                            variant="destructive"
                                            onClick={() => setConfirm('delete')}
                                        >
                                            <Trash2 /> {t('Delete')}
                                        </Button>
                                    )}
                            </div>
                        </DocCard>
                    </div>
                </div>
            </div>

            {editing && (
                <GoalForm
                    goal={goal}
                    categories={categories}
                    chartOfAccounts={chartOfAccounts}
                    onClose={() => setEditing(false)}
                />
            )}

            <ConfirmDialog
                open={confirm === 'cancel'}
                onOpenChange={(open) => !open && setConfirm(null)}
                icon={X}
                title="Cancel this goal?"
                description="A cancelled goal takes no more contributions and can no longer be edited."
                confirmLabel="Cancel Goal"
                onConfirm={() =>
                    router.put(
                        goalRoutes.goals.cancel(goal.id),
                        {},
                        {
                            preserveScroll: true,
                            onFinish: () => setConfirm(null),
                        },
                    )
                }
            />
            <ConfirmDialog
                open={confirm === 'delete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                description="This goal, its milestones and contributions will be permanently deleted."
                onConfirm={() =>
                    router.delete(goalRoutes.goals.destroy(goal.id))
                }
            />
        </>
    );
}

GoalShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Goals', href: goalRoutes.goals.index() },
        { title: 'Goal Details', href: goalRoutes.goals.index() },
    ],
};
