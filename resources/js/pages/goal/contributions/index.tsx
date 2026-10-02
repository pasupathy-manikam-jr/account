import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { CircleDollarSign, SquarePen, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import DatePicker from '@/components/date-picker';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { DateCell } from '@/components/table-cells';
import { FilterSelect } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import goalRoutes from '@/routes/goal';
import type { Paginated, TableFilters } from '@/types';

type Contribution = {
    id: number;
    goal_id: number;
    contribution_date: string;
    amount: string;
    contribution_type: 'manual' | 'automatic';
    notes: string | null;
    goal: { id: number; goal_name: string; status: string };
};

const today = () => new Date().toISOString().slice(0, 10);

export default function Contributions({
    contributions,
    goals,
    filters,
}: {
    contributions: Paginated<Contribution>;
    goals: { id: number; goal_name: string; status: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const can = useCan();
    const currency = usePage().props.globalSettings.currencySymbol;
    const url = goalRoutes.contributions.index();
    const activeGoals = goals.filter((g) => g.status === 'active');
    const blank = {
        goal_id: filters.goal_id ? String(filters.goal_id) : '',
        contribution_date: today(),
        amount: '',
        contribution_type: 'manual',
        notes: '',
    };
    const form = useForm(blank);
    const [editing, setEditing] = useState<Contribution | null>(null);
    const [deleting, setDeleting] = useState<Contribution | null>(null);
    const required = <span className="text-destructive">*</span>;

    const openForm = (c: Contribution | null) => {
        setEditing(c);
        form.clearErrors();
        form.setData(
            c
                ? {
                      goal_id: String(c.goal_id),
                      contribution_date: c.contribution_date,
                      amount: c.amount,
                      contribution_type: c.contribution_type,
                      notes: c.notes ?? '',
                  }
                : blank,
        );
    };
    // The side card adds a contribution; Edit on a row turns it into that contribution's editor.
    const canSave = editing
        ? can('edit-goal-contributions')
        : can('create-goal-contributions');

    const columns: Column<Contribution>[] = [
        {
            key: 'goal',
            label: 'Goal',
            render: (c) => (
                <div className="flex max-w-72 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950">
                        <CircleDollarSign className="size-4" />
                    </span>
                    <div className="min-w-0">
                        <Link
                            href={goalRoutes.goals.show(c.goal_id)}
                            className="font-medium hover:underline"
                        >
                            {c.goal.goal_name}
                        </Link>
                        {c.notes && (
                            <div className="truncate text-xs text-muted-foreground">
                                {c.notes}
                            </div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'contribution_date',
            label: 'Date',
            sortable: true,
            render: (c) => <DateCell value={c.contribution_date} />,
        },
        {
            key: 'amount',
            label: 'Amount',
            sortable: true,
            render: (c) => (
                <span className="font-semibold whitespace-nowrap text-emerald-600 tabular-nums dark:text-emerald-400">
                    {money(Number(c.amount))}
                </span>
            ),
        },
        {
            key: 'contribution_type',
            label: 'Type',
            render: (c) => <StatusBadge status={c.contribution_type} />,
        },
    ];

    return (
        <>
            <Head title={t('Contributions')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Contributions"
                    description="Track and manage financial contributions, deposit amounts, notes, and contribution dates for organization goals."
                />
                <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
                    {(can('create-goal-contributions') || editing) && (
                        <form
                            noValidate
                            className={cn(
                                'rounded-xl border bg-card p-6 shadow-sm lg:sticky lg:top-20',
                                editing && 'ring-2 ring-primary/30',
                            )}
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.submit(
                                    editing
                                        ? goalRoutes.contributions.update(
                                              editing.id,
                                          )
                                        : goalRoutes.contributions.store(),
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => openForm(null),
                                    },
                                );
                            }}
                        >
                            <h2 className="text-lg font-semibold">
                                {t(
                                    editing
                                        ? 'Edit Contribution'
                                        : 'Add New Contribution',
                                )}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t(
                                    editing
                                        ? 'Change this contribution.'
                                        : 'Fill in the details to create a new contribution',
                                )}
                            </p>
                            <div className="mt-6 grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="goal_id">
                                        {t('Goal')} {required}
                                    </Label>
                                    <SelectField
                                        id="goal_id"
                                        value={form.data.goal_id}
                                        placeholder={t('Select Goal')}
                                        onChange={(e) =>
                                            form.setData(
                                                'goal_id',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        {activeGoals.map((g) => (
                                            <option key={g.id} value={g.id}>
                                                {g.goal_name}
                                            </option>
                                        ))}
                                    </SelectField>
                                    <InputError message={form.errors.goal_id} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="contribution_date">
                                        {t('Date')} {required}
                                    </Label>
                                    <DatePicker
                                        key={editing?.id ?? 'new'}
                                        id="contribution_date"
                                        name="contribution_date"
                                        defaultValue={
                                            form.data.contribution_date
                                        }
                                        invalid={
                                            !!form.errors.contribution_date
                                        }
                                        onChange={(v) =>
                                            form.setData('contribution_date', v)
                                        }
                                    />
                                    <InputError
                                        message={form.errors.contribution_date}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="amount">
                                        {t('Amount')} {required}
                                    </Label>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                            {currency}
                                        </span>
                                        <Input
                                            id="amount"
                                            className="ps-10"
                                            inputMode="decimal"
                                            value={form.data.amount}
                                            onChange={(e) =>
                                                form.setData(
                                                    'amount',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <InputError message={form.errors.amount} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="contribution_type">
                                        {t('Type')} {required}
                                    </Label>
                                    <SelectField
                                        id="contribution_type"
                                        value={form.data.contribution_type}
                                        onChange={(e) =>
                                            form.setData(
                                                'contribution_type',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="manual">
                                            {t('Manual')}
                                        </option>
                                        <option value="automatic">
                                            {t('Automatic')}
                                        </option>
                                    </SelectField>
                                    <InputError
                                        message={form.errors.contribution_type}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="notes">{t('Notes')}</Label>
                                    <Textarea
                                        id="notes"
                                        value={form.data.notes}
                                        onChange={(e) =>
                                            form.setData(
                                                'notes',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={form.errors.notes} />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={form.processing || !canSave}
                                >
                                    {t(
                                        editing
                                            ? 'Update Contribution'
                                            : 'Add Contribution',
                                    )}
                                </Button>
                                {editing && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => openForm(null)}
                                    >
                                        {t('Cancel')}
                                    </Button>
                                )}
                            </div>
                        </form>
                    )}
                    <div className="min-w-0">
                        <DataTable
                            data={contributions}
                            columns={columns}
                            filters={filters}
                            url={url}
                            moreFilters={
                                <>
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
                                    <FilterSelect
                                        url={url}
                                        filters={filters}
                                        name="contribution_type"
                                        label="All Types"
                                        options={[
                                            { id: 'manual', name: t('Manual') },
                                            {
                                                id: 'automatic',
                                                name: t('Automatic'),
                                            },
                                        ]}
                                    />
                                </>
                            }
                            actions={(c) =>
                                c.goal.status === 'active' && (
                                    <>
                                        {can('edit-goal-contributions') && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={t('Edit')}
                                                onClick={() => openForm(c)}
                                            >
                                                <SquarePen className="text-blue-600" />
                                            </Button>
                                        )}
                                        {can('delete-goal-contributions') && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={t('Delete')}
                                                onClick={() => setDeleting(c)}
                                            >
                                                <Trash2 className="text-destructive" />
                                            </Button>
                                        )}
                                    </>
                                )
                            }
                        />
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This contribution will be permanently deleted and the goal's milestones rechecked."
                onConfirm={() =>
                    deleting &&
                    router.delete(
                        goalRoutes.contributions.destroy(deleting.id),
                        {
                            preserveScroll: true,
                            onFinish: () => setDeleting(null),
                        },
                    )
                }
            />
        </>
    );
}

Contributions.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Goal', href: goalRoutes.goals.index() },
        { title: 'Contributions', href: goalRoutes.contributions.index() },
    ],
};
