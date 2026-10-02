import { Head, Link, router, useForm } from '@inertiajs/react';
import { PiggyBank, Plus, SquarePen, Trash2, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { PersonCell } from '@/components/person-cell';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { FilterSelect, StatusTabs } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import budgetPlanner from '@/routes/budget-planner';
import type { Paginated, TableFilters } from '@/types';
import { useWorkflow } from '../workflow';

type Budget = {
    id: number;
    budget_name: string;
    budget_period_id: number;
    budget_type: string;
    status: string;
    total_allocated: string | null;
    period: { id: number; period_name: string; financial_year: number };
    approver: { id: number; name: string; email: string } | null;
};

const BUDGET_TYPES: Record<string, string> = {
    operational: 'Operational',
    capital: 'Capital',
    cash_flow: 'Cash Flow',
};

const blank = { budget_name: '', budget_period_id: '', budget_type: '' };

export default function Budgets({
    budgets,
    counts,
    periods,
    allPeriods,
    filters,
}: {
    budgets: Paginated<Budget>;
    counts: Record<string, number>;
    periods: { id: number; period_name: string; financial_year: number }[];
    allPeriods: { id: number; name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const can = useCan();
    const routes = budgetPlanner.budgets;
    const url = routes.index();
    const form = useForm(blank);
    const [editing, setEditing] = useState<Budget | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Budget | null>(null);
    const workflow = useWorkflow('budgets', (action, id) => routes[action](id));
    const required = <span className="text-destructive">*</span>;

    const openForm = (budget: Budget | null) => {
        setEditing(budget);
        form.clearErrors();
        form.setData(
            budget
                ? {
                      budget_name: budget.budget_name,
                      budget_period_id: String(budget.budget_period_id),
                      budget_type: budget.budget_type,
                  }
                : blank,
        );
        setFormOpen(true);
    };

    const columns: Column<Budget>[] = [
        {
            key: 'budget_name',
            label: 'Budget',
            sortable: true,
            render: (b) => (
                <div>
                    <div className="font-medium">{b.budget_name}</div>
                    <div className="text-xs text-muted-foreground">
                        {t(BUDGET_TYPES[b.budget_type])}
                    </div>
                </div>
            ),
        },
        {
            key: 'period',
            label: 'Period',
            render: (b) => b.period.period_name,
        },
        {
            key: 'total_allocated',
            label: 'Amount',
            render: (b) => (
                <span className="font-semibold whitespace-nowrap">
                    {money(Number(b.total_allocated ?? 0))}
                </span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (b) => <StatusBadge status={b.status} />,
        },
        {
            key: 'approver',
            label: 'Approved By',
            render: (b) =>
                b.approver ? (
                    <PersonCell
                        name={b.approver.name}
                        detail={b.approver.email}
                    />
                ) : (
                    '-'
                ),
        },
    ];

    return (
        <>
            <Head title={t('Budget')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Budget"
                    description="Plan, track, and manage all your organization budgets. Create new budgets, assign periods and types, and get approvals."
                    action={
                        can('create-budgets') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Budget')}
                            </Button>
                        )
                    }
                />
                <DataTable
                    data={budgets}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <>
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="budget_period_id"
                                label="All Periods"
                                options={allPeriods}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="status"
                                label="All Statuses"
                                options={[
                                    'draft',
                                    'approved',
                                    'active',
                                    'closed',
                                ].map((st) => ({
                                    id: st,
                                    name: t(
                                        st.charAt(0).toUpperCase() +
                                            st.slice(1),
                                    ),
                                }))}
                            />
                        </>
                    }
                    renderCard={(b, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate font-semibold">
                                        {b.budget_name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {t(BUDGET_TYPES[b.budget_type])}
                                    </div>
                                </div>
                                <StatusBadge status={b.status} />
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">
                                    {t('Amount')}
                                </div>
                                <div className="text-xl font-bold text-primary">
                                    {money(Number(b.total_allocated ?? 0))}
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {b.period.period_name}
                            </div>
                            {b.approver && (
                                <PersonCell
                                    name={b.approver.name}
                                    detail={b.approver.email}
                                />
                            )}
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                    tabs={
                        <StatusTabs
                            url={url}
                            filters={filters}
                            counts={counts}
                            name="type"
                        />
                    }
                    actions={(b) => (
                        <>
                            {workflow.buttons(b)}
                            {can('manage-budget-allocations') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Allocations')}
                                    title={t('Allocations')}
                                    asChild
                                >
                                    <Link
                                        href={budgetPlanner.budgetAllocations.index(
                                            { query: { budget_id: b.id } },
                                        )}
                                    >
                                        <WalletCards className="text-violet-600" />
                                    </Link>
                                </Button>
                            )}
                            {b.status === 'draft' && can('edit-budgets') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Edit')}
                                    onClick={() => openForm(b)}
                                >
                                    <SquarePen className="text-blue-600" />
                                </Button>
                            )}
                            {b.status === 'draft' && can('delete-budgets') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Delete')}
                                    onClick={() => setDeleting(b)}
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
                title={editing ? 'Edit Budget' : 'Add Budget'}
                description="Name the budget and pick its period; split it across accounts under Budget Allocations."
                icon={PiggyBank}
                processing={form.processing}
                onSubmit={(e) => {
                    e.preventDefault();
                    form.submit(
                        editing ? routes.update(editing.id) : routes.store(),
                        {
                            preserveScroll: true,
                            onSuccess: () => setFormOpen(false),
                        },
                    );
                }}
            >
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="budget_name">
                            {t('Budget Name')} {required}
                        </Label>
                        <Input
                            id="budget_name"
                            value={form.data.budget_name}
                            onChange={(e) =>
                                form.setData('budget_name', e.target.value)
                            }
                        />
                        <InputError message={form.errors.budget_name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="budget_period_id">
                            {t('Budget Period')} {required}
                        </Label>
                        <SelectField
                            id="budget_period_id"
                            value={form.data.budget_period_id}
                            placeholder={t('Select Budget Period')}
                            onChange={(e) =>
                                form.setData('budget_period_id', e.target.value)
                            }
                        >
                            {periods.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.period_name} ({p.financial_year})
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.budget_period_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="budget_type">
                            {t('Budget Type')} {required}
                        </Label>
                        <SelectField
                            id="budget_type"
                            value={form.data.budget_type}
                            placeholder={t('Select Budget Type')}
                            onChange={(e) =>
                                form.setData('budget_type', e.target.value)
                            }
                        >
                            {Object.entries(BUDGET_TYPES).map(
                                ([value, label]) => (
                                    <option key={value} value={value}>
                                        {t(label)}
                                    </option>
                                ),
                            )}
                        </SelectField>
                        <InputError message={form.errors.budget_type} />
                    </div>
                </div>
            </FormDialog>

            {workflow.dialog}
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This budget and its allocations will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(routes.destroy(deleting.id), {
                        preserveScroll: true,
                        onFinish: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

Budgets.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Budget Planner', href: budgetPlanner.budgets.index() },
        { title: 'Budget', href: budgetPlanner.budgets.index() },
    ],
};
