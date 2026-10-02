import { Head, router, useForm } from '@inertiajs/react';
import { CalendarRange, Plus, SquarePen, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import DatePicker from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { PersonCell } from '@/components/person-cell';
import { StatusBadge } from '@/components/status-badge';
import { DateCell } from '@/components/table-cells';
import { StatusTabs } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import budgetPlanner from '@/routes/budget-planner';
import type { Paginated, TableFilters } from '@/types';
import { useWorkflow } from '../workflow';

type Period = {
    id: number;
    period_name: string;
    financial_year: number;
    start_date: string;
    end_date: string;
    status: string;
    budgets_count: number;
    approver: { id: number; name: string; email: string } | null;
};

const blank = {
    period_name: '',
    financial_year: String(new Date().getFullYear()),
    start_date: '',
    end_date: '',
};

export default function BudgetPeriods({
    periods,
    counts,
    filters,
}: {
    periods: Paginated<Period>;
    counts: Record<string, number>;
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const routes = budgetPlanner.budgetPeriods;
    const url = routes.index();
    const form = useForm(blank);
    const [editing, setEditing] = useState<Period | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Period | null>(null);
    const workflow = useWorkflow('budget-periods', (action, id) =>
        routes[action](id),
    );
    const required = <span className="text-destructive">*</span>;

    const openForm = (period: Period | null) => {
        setEditing(period);
        form.clearErrors();
        form.setData(
            period
                ? {
                      period_name: period.period_name,
                      financial_year: String(period.financial_year),
                      start_date: period.start_date,
                      end_date: period.end_date,
                  }
                : blank,
        );
        setFormOpen(true);
    };

    const columns: Column<Period>[] = [
        {
            key: 'period_name',
            label: 'Period Name',
            sortable: true,
            render: (p) => (
                <div>
                    <div className="font-medium">{p.period_name}</div>
                    <div className="text-xs text-muted-foreground">
                        {t('Budgets: :count', { count: p.budgets_count })}
                    </div>
                </div>
            ),
        },
        {
            key: 'financial_year',
            label: 'Financial Year',
            sortable: true,
            render: (p) => p.financial_year,
        },
        {
            key: 'start_date',
            label: 'Start Date',
            sortable: true,
            render: (p) => <DateCell value={p.start_date} />,
        },
        {
            key: 'end_date',
            label: 'End Date',
            sortable: true,
            render: (p) => <DateCell value={p.end_date} />,
        },
        {
            key: 'status',
            label: 'Status',
            render: (p) => <StatusBadge status={p.status} />,
        },
        {
            key: 'approver',
            label: 'Approved By',
            render: (p) =>
                p.approver ? (
                    <PersonCell
                        name={p.approver.name}
                        detail={p.approver.email}
                    />
                ) : (
                    '-'
                ),
        },
    ];

    return (
        <>
            <Head title={t('Budget Periods')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Budget Periods"
                    description="Manage and configure budget periods, financial years, and approval workflows."
                    action={
                        can('create-budget-periods') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Budget Period')}
                            </Button>
                        )
                    }
                />
                <DataTable
                    data={periods}
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
                    actions={(p) => (
                        <>
                            {workflow.buttons(p)}
                            {p.status === 'draft' &&
                                can('edit-budget-periods') && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('Edit')}
                                        onClick={() => openForm(p)}
                                    >
                                        <SquarePen className="text-blue-600" />
                                    </Button>
                                )}
                            {p.status === 'draft' &&
                                p.budgets_count === 0 &&
                                can('delete-budget-periods') && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('Delete')}
                                        onClick={() => setDeleting(p)}
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
                title={editing ? 'Edit Budget Period' : 'Add Budget Period'}
                description="The dates budgets in this period are planned and measured over."
                icon={CalendarRange}
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
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="period_name">
                            {t('Period Name')} {required}
                        </Label>
                        <Input
                            id="period_name"
                            value={form.data.period_name}
                            onChange={(e) =>
                                form.setData('period_name', e.target.value)
                            }
                        />
                        <InputError message={form.errors.period_name} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="financial_year">
                            {t('Financial Year')} {required}
                        </Label>
                        <Input
                            id="financial_year"
                            inputMode="numeric"
                            value={form.data.financial_year}
                            onChange={(e) =>
                                form.setData('financial_year', e.target.value)
                            }
                        />
                        <InputError message={form.errors.financial_year} />
                    </div>
                    {(
                        [
                            ['start_date', 'Start Date'],
                            ['end_date', 'End Date'],
                        ] as const
                    ).map(([name, label]) => (
                        <div
                            key={`${name}-${editing?.id}`}
                            className="grid gap-2"
                        >
                            <Label htmlFor={name}>
                                {t(label)} {required}
                            </Label>
                            <DatePicker
                                id={name}
                                name={name}
                                defaultValue={form.data[name]}
                                onChange={(v) => form.setData(name, v)}
                            />
                            <InputError message={form.errors[name]} />
                        </div>
                    ))}
                </div>
            </FormDialog>

            {workflow.dialog}
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This budget period will be permanently deleted."
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

BudgetPeriods.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Budget Planner', href: budgetPlanner.budgetPeriods.index() },
        { title: 'Budget Periods', href: budgetPlanner.budgetPeriods.index() },
    ],
};
