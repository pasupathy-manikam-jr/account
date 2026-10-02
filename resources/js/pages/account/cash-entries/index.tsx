import { Head, router, useForm } from '@inertiajs/react';
import {
    Check,
    Eye,
    FileCheck,
    Plus,
    SquarePen,
    Trash2,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import DatePicker from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { MonthFilter } from '@/components/month-filter';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { DateCell, IdBadge } from '@/components/table-cells';
import { FilterSelect, StatusTabs } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { ViewDialog } from '@/components/view-dialog';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import account from '@/routes/account';
import type { Paginated, TableFilters } from '@/types';

type Kind = 'revenue' | 'expense';

type Entry = {
    id: number;
    entry_number: string;
    entry_date: string;
    category_id: number;
    bank_account_id: number;
    chart_of_account_id: number;
    amount: string;
    description: string | null;
    reference_number: string | null;
    status: 'draft' | 'approved' | 'posted';
    category: { id: number; category_name: string };
    bank_account: { id: number; account_name: string; bank_name: string };
    chart_of_account: {
        id: number;
        account_code: string;
        account_name: string;
    };
    approver: { id: number; name: string } | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function CashEntries({
    kind,
    entries,
    counts,
    categories,
    bankAccounts,
    glAccounts,
    filters,
}: {
    kind: Kind;
    entries: Paginated<Entry>;
    counts: Record<string, number>;
    categories: { id: number; category_name: string; gl_account_id: number }[];
    bankAccounts: { id: number; account_name: string; bank_name: string }[];
    glAccounts: { id: number; account_code: string; account_name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const revenue = kind === 'revenue';
    const routes = revenue ? account.revenues : account.expenses;
    const perm = revenue ? 'revenues' : 'expenses';
    const url = routes.index();
    const blank = {
        entry_date: today(),
        category_id: '',
        bank_account_id: '',
        chart_of_account_id: '',
        amount: '',
        description: '',
        reference_number: '',
    };
    const form = useForm(blank);
    const [editing, setEditing] = useState<Entry | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [viewing, setViewing] = useState<Entry | null>(null);
    const [confirm, setConfirm] = useState<{
        entry: Entry;
        action: 'post' | 'delete';
    } | null>(null);
    const required = <span className="text-destructive">*</span>;

    const openForm = (entry: Entry | null) => {
        setEditing(entry);
        form.clearErrors();
        form.setData(
            entry
                ? {
                      entry_date: entry.entry_date,
                      category_id: String(entry.category_id),
                      bank_account_id: String(entry.bank_account_id),
                      chart_of_account_id: String(entry.chart_of_account_id),
                      amount: entry.amount,
                      description: entry.description ?? '',
                      reference_number: entry.reference_number ?? '',
                  }
                : blank,
        );
        setFormOpen(true);
    };

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

    const columns: Column<Entry>[] = [
        {
            key: 'entry_number',
            label: revenue ? 'Revenue' : 'Expense',
            sortable: true,
            render: (e) => (
                <div className="max-w-48">
                    <IdBadge>{e.entry_number}</IdBadge>
                    {e.description && (
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                            {e.description}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'entry_date',
            label: 'Date',
            sortable: true,
            render: (e) => <DateCell value={e.entry_date} />,
        },
        {
            key: 'category',
            label: 'Category',
            render: (e) => e.category.category_name,
        },
        {
            key: 'account',
            label: 'Chart of Account / Bank',
            render: (e) => (
                <div className="whitespace-nowrap">
                    <div>
                        <span className="font-mono text-xs text-muted-foreground">
                            {e.chart_of_account.account_code}
                        </span>{' '}
                        {e.chart_of_account.account_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {e.bank_account.account_name}
                    </div>
                </div>
            ),
        },
        {
            key: 'amount',
            label: 'Amount',
            sortable: true,
            render: (e) => (
                <span
                    className={`font-semibold whitespace-nowrap ${revenue ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                >
                    {money(Number(e.amount))}
                </span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (e) => <StatusBadge status={e.status} />,
        },
        {
            key: 'approver',
            label: 'Approved By',
            render: (e) =>
                e.approver ? (
                    <span>{e.approver.name}</span>
                ) : (
                    <span className="text-muted-foreground">-</span>
                ),
        },
    ];

    return (
        <>
            <Head title={t(revenue ? 'Revenue' : 'Expense')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title={revenue ? 'Manage Revenue' : 'Manage Expenses'}
                    description={
                        revenue
                            ? 'Record money received outside invoices, approve it and post it to the ledger.'
                            : 'Record money spent outside bills, approve it and post it to the ledger.'
                    }
                    action={
                        can(`create-${perm}`) && (
                            <Button onClick={() => openForm(null)}>
                                <Plus />{' '}
                                {t(revenue ? 'Add Revenue' : 'Add Expense')}
                            </Button>
                        )
                    }
                />
                <MonthFilter url={url} filters={filters} />
                <DataTable
                    data={entries}
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
                                name="bank_account_id"
                                label="All Bank Accounts"
                                options={bankAccounts.map((b) => ({
                                    id: b.id,
                                    name: b.account_name,
                                }))}
                            />
                        </>
                    }
                    actions={(e) => (
                        <>
                            {action(
                                'View',
                                <Eye className="text-emerald-600" />,
                                { onClick: () => setViewing(e) },
                            )}
                            {e.status === 'draft' &&
                                can(`approve-${perm}`) &&
                                action(
                                    'Approve',
                                    <Check className="text-emerald-600" />,
                                    {
                                        onClick: () =>
                                            router.put(
                                                routes.approve(e.id),
                                                {},
                                                { preserveScroll: true },
                                            ),
                                    },
                                )}
                            {e.status === 'approved' &&
                                can(`post-${perm}`) &&
                                action(
                                    'Post',
                                    <FileCheck className="text-violet-600" />,
                                    {
                                        onClick: () =>
                                            setConfirm({
                                                entry: e,
                                                action: 'post',
                                            }),
                                    },
                                )}
                            {e.status === 'draft' &&
                                can(`edit-${perm}`) &&
                                action(
                                    'Edit',
                                    <SquarePen className="text-blue-600" />,
                                    { onClick: () => openForm(e) },
                                )}
                            {e.status === 'draft' &&
                                can(`delete-${perm}`) &&
                                action(
                                    'Delete',
                                    <Trash2 className="text-destructive" />,
                                    {
                                        onClick: () =>
                                            setConfirm({
                                                entry: e,
                                                action: 'delete',
                                            }),
                                    },
                                )}
                        </>
                    )}
                />
            </div>

            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title={
                    editing
                        ? revenue
                            ? 'Edit Revenue'
                            : 'Edit Expense'
                        : revenue
                          ? 'Add Revenue'
                          : 'Add Expense'
                }
                description={
                    revenue
                        ? 'Money received into a bank account.'
                        : 'Money paid out of a bank account.'
                }
                icon={revenue ? TrendingUp : TrendingDown}
                processing={form.processing}
                onSubmit={(ev) => {
                    ev.preventDefault();
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
                    <div className="grid gap-2">
                        <Label htmlFor="entry_date">
                            {t('Date')} {required}
                        </Label>
                        <DatePicker
                            id="entry_date"
                            name="entry_date"
                            defaultValue={form.data.entry_date}
                            invalid={!!form.errors.entry_date}
                            onChange={(v) => form.setData('entry_date', v)}
                        />
                        <InputError message={form.errors.entry_date} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="amount">
                            {t('Amount')} {required}
                        </Label>
                        <Input
                            id="amount"
                            inputMode="decimal"
                            value={form.data.amount}
                            onChange={(e) =>
                                form.setData('amount', e.target.value)
                            }
                        />
                        <InputError message={form.errors.amount} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="category_id">
                            {t('Category')} {required}
                        </Label>
                        <SelectField
                            id="category_id"
                            value={form.data.category_id}
                            placeholder={t('Select Category')}
                            onChange={(e) => {
                                const picked = categories.find(
                                    (c) => String(c.id) === e.target.value,
                                );
                                form.setData({
                                    ...form.data,
                                    category_id: e.target.value,
                                    // The category decides the ledger account unless one was already chosen.
                                    chart_of_account_id: picked
                                        ? String(picked.gl_account_id)
                                        : form.data.chart_of_account_id,
                                });
                            }}
                        >
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.category_name}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.category_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bank_account_id">
                            {t('Bank Account')} {required}
                        </Label>
                        <SelectField
                            id="bank_account_id"
                            value={form.data.bank_account_id}
                            placeholder={t('Select Bank Account')}
                            onChange={(e) =>
                                form.setData('bank_account_id', e.target.value)
                            }
                        >
                            {bankAccounts.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.account_name} ({b.bank_name})
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.bank_account_id} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="chart_of_account_id">
                            {t(revenue ? 'Revenue Account' : 'Expense Account')}{' '}
                            {required}
                        </Label>
                        <SelectField
                            id="chart_of_account_id"
                            value={form.data.chart_of_account_id}
                            placeholder={t('Select GL Account')}
                            onChange={(e) =>
                                form.setData(
                                    'chart_of_account_id',
                                    e.target.value,
                                )
                            }
                        >
                            {glAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.account_code} - {a.account_name}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.chart_of_account_id} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="reference_number">
                            {t('Reference Number')}
                        </Label>
                        <Input
                            id="reference_number"
                            value={form.data.reference_number}
                            onChange={(e) =>
                                form.setData('reference_number', e.target.value)
                            }
                        />
                        <InputError message={form.errors.reference_number} />
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

            <ViewDialog
                open={viewing !== null}
                onClose={() => setViewing(null)}
                icon={revenue ? TrendingUp : TrendingDown}
                title={viewing?.entry_number}
                description={viewing?.category.category_name}
                fields={
                    viewing
                        ? [
                              ['Date', date(viewing.entry_date)],
                              [
                                  'Status',
                                  <StatusBadge
                                      key="s"
                                      status={viewing.status}
                                  />,
                              ],
                              [
                                  'Bank Account',
                                  `${viewing.bank_account.account_name} (${viewing.bank_account.bank_name})`,
                              ],
                              [
                                  revenue
                                      ? 'Revenue Account'
                                      : 'Expense Account',
                                  `${viewing.chart_of_account.account_code} - ${viewing.chart_of_account.account_name}`,
                              ],
                              ['Reference Number', viewing.reference_number],
                              ['Approved By', viewing.approver?.name],
                              [
                                  'Amount',
                                  <span
                                      key="a"
                                      className="text-base font-bold text-primary"
                                  >
                                      {money(Number(viewing.amount))}
                                  </span>,
                                  true,
                              ],
                              ['Description', viewing.description, true],
                          ]
                        : []
                }
            />

            <ConfirmDialog
                open={confirm?.action === 'post'}
                onOpenChange={(open) => !open && setConfirm(null)}
                icon={FileCheck}
                title="Post this entry?"
                description="Posting records the money movement in the ledger. A posted entry can no longer be edited or deleted."
                confirmLabel="Post"
                onConfirm={() =>
                    confirm &&
                    router.put(
                        routes.post(confirm.entry.id),
                        {},
                        {
                            preserveScroll: true,
                            onFinish: () => setConfirm(null),
                        },
                    )
                }
            />
            <ConfirmDialog
                open={confirm?.action === 'delete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                description="This entry will be permanently deleted."
                onConfirm={() =>
                    confirm &&
                    router.delete(routes.destroy(confirm.entry.id), {
                        preserveScroll: true,
                        onFinish: () => setConfirm(null),
                    })
                }
            />
        </>
    );
}

CashEntries.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.chartOfAccounts.index() },
    ],
};
