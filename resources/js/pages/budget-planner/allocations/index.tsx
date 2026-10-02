import { Head, router, useForm } from '@inertiajs/react';
import { Plus, SquarePen, Trash2, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { FilterSelect } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import budgetPlanner from '@/routes/budget-planner';
import type { Paginated, TableFilters } from '@/types';
import { SpendCards, Utilization } from '../utilization';

type Allocation = {
    id: number;
    budget_id: number;
    account_id: number;
    allocated_amount: string;
    spent_amount: string;
    budget: {
        id: number;
        budget_name: string;
        status: string;
        period: { id: number; period_name: string };
    };
    account: { id: number; account_code: string; account_name: string };
};

type BudgetOption = { id: number; budget_name: string; status: string };

export default function BudgetAllocations({
    allocations,
    stats,
    budgets,
    accounts,
    filters,
}: {
    allocations: Paginated<Allocation>;
    stats: { count: number; allocated: string; spent: string };
    budgets: BudgetOption[];
    accounts: { id: number; account_code: string; account_name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const routes = budgetPlanner.budgetAllocations;
    const url = routes.index();
    const blank = {
        budget_id: filters.budget_id ? String(filters.budget_id) : '',
        account_id: '',
        allocated_amount: '',
    };
    const form = useForm(blank);
    const [editing, setEditing] = useState<Allocation | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Allocation | null>(null);
    const required = <span className="text-destructive">*</span>;
    // Allocations are the plan under approval, so only draft budgets take changes.
    const drafts = budgets.filter((b) => b.status === 'draft');

    const openForm = (allocation: Allocation | null) => {
        setEditing(allocation);
        form.clearErrors();
        form.setData(
            allocation
                ? {
                      budget_id: String(allocation.budget_id),
                      account_id: String(allocation.account_id),
                      allocated_amount: allocation.allocated_amount,
                  }
                : blank,
        );
        setFormOpen(true);
    };

    const columns: Column<Allocation>[] = [
        {
            key: 'budget',
            label: 'Budget',
            render: (a) => (
                <div>
                    <div className="font-medium">{a.budget.budget_name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {a.budget.period.period_name}
                        <StatusBadge status={a.budget.status} />
                    </div>
                </div>
            ),
        },
        {
            key: 'account',
            label: 'Account',
            render: (a) => (
                <div className="whitespace-nowrap">
                    <span className="font-mono text-xs text-muted-foreground">
                        {a.account.account_code}
                    </span>{' '}
                    {a.account.account_name}
                </div>
            ),
        },
        {
            key: 'allocated_amount',
            label: 'Utilization',
            sortable: true,
            render: (a) => (
                <Utilization
                    total={Number(a.allocated_amount)}
                    spent={Number(a.spent_amount)}
                />
            ),
        },
    ];

    return (
        <>
            <Head title={t('Budget Allocations')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Budget Allocations"
                    description="Allocate budgets across expense accounts and watch real spending from the ledger against each one."
                    action={
                        can('create-budget-allocations') &&
                        drafts.length > 0 && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Allocation')}
                            </Button>
                        )
                    }
                />
                <SpendCards
                    count={stats.count}
                    countLabel="Total Allocations"
                    countHint="Account allocations"
                    allocated={Number(stats.allocated)}
                    spent={Number(stats.spent)}
                />
                <DataTable
                    data={allocations}
                    columns={columns}
                    filters={filters}
                    url={url}
                    toolbar={
                        <FilterSelect
                            url={url}
                            filters={filters}
                            name="budget_id"
                            label="All Budgets"
                            options={budgets.map((b) => ({
                                id: b.id,
                                name: b.budget_name,
                            }))}
                        />
                    }
                    moreFilters={
                        <FilterSelect
                            url={url}
                            filters={filters}
                            name="account_id"
                            label="All Accounts"
                            options={accounts.map((a) => ({
                                id: a.id,
                                name: `${a.account_code} - ${a.account_name}`,
                            }))}
                        />
                    }
                    renderCard={(a, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate font-semibold">
                                        {a.budget.budget_name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {a.budget.period.period_name}
                                    </div>
                                </div>
                                <StatusBadge status={a.budget.status} />
                            </div>
                            <div className="text-sm">
                                <span className="font-mono text-xs text-muted-foreground">
                                    {a.account.account_code}
                                </span>{' '}
                                {a.account.account_name}
                            </div>
                            <Utilization
                                total={Number(a.allocated_amount)}
                                spent={Number(a.spent_amount)}
                            />
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                    actions={(a) =>
                        a.budget.status === 'draft' && (
                            <>
                                {can('edit-budget-allocations') && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('Edit')}
                                        onClick={() => openForm(a)}
                                    >
                                        <SquarePen className="text-blue-600" />
                                    </Button>
                                )}
                                {can('delete-budget-allocations') && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('Delete')}
                                        onClick={() => setDeleting(a)}
                                    >
                                        <Trash2 className="text-destructive" />
                                    </Button>
                                )}
                            </>
                        )
                    }
                />
            </div>

            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title={editing ? 'Edit Allocation' : 'Add Allocation'}
                description="How much of a draft budget goes to one expense account."
                icon={WalletCards}
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
                        <Label htmlFor="budget_id">
                            {t('Budget')} {required}
                        </Label>
                        <SelectField
                            id="budget_id"
                            value={form.data.budget_id}
                            placeholder={t('Select Budget')}
                            onChange={(e) =>
                                form.setData('budget_id', e.target.value)
                            }
                        >
                            {drafts.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.budget_name}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.budget_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="account_id">
                            {t('Account')} {required}
                        </Label>
                        <SelectField
                            id="account_id"
                            value={form.data.account_id}
                            placeholder={t('Select Account')}
                            onChange={(e) =>
                                form.setData('account_id', e.target.value)
                            }
                        >
                            {accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.account_code} - {a.account_name}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.account_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="allocated_amount">
                            {t('Allocated Amount')} {required}
                        </Label>
                        <Input
                            id="allocated_amount"
                            inputMode="decimal"
                            value={form.data.allocated_amount}
                            onChange={(e) =>
                                form.setData('allocated_amount', e.target.value)
                            }
                        />
                        <InputError message={form.errors.allocated_amount} />
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This allocation will be permanently deleted."
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

BudgetAllocations.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Budget Planner', href: budgetPlanner.budgets.index() },
        {
            title: 'Budget Allocations',
            href: budgetPlanner.budgetAllocations.index(),
        },
    ],
};
