import { Head, Link, router, useForm } from '@inertiajs/react';
import { Eye, ListTree, Plus, SquarePen, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { FilterSelect, StatusTabs } from '@/components/table-filters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import account from '@/routes/account';
import type { Paginated, TableFilters } from '@/types';

type Account = {
    id: number;
    account_code: string;
    account_name: string;
    account_type_id: number;
    parent_account_id: number | null;
    normal_balance: 'debit' | 'credit';
    opening_balance: string;
    current_balance: string;
    description: string | null;
    is_active: boolean;
    is_system_account: boolean;
    account_type: { id: number; name: string; category: string };
    parent_account: {
        id: number;
        account_code: string;
        account_name: string;
    } | null;
};

type AccountTypeOption = {
    id: number;
    name: string;
    normal_balance: Account['normal_balance'];
};

const blank = {
    account_code: '',
    account_name: '',
    account_type_id: '',
    parent_account_id: '',
    normal_balance: 'debit' as Account['normal_balance'],
    opening_balance: '0.00',
    description: '',
    is_active: true,
};

export default function ChartOfAccounts({
    accounts,
    counts,
    accountTypes,
    parentAccounts,
    filters,
}: {
    accounts: Paginated<Account>;
    counts: Record<string, number>;
    accountTypes: AccountTypeOption[];
    parentAccounts: Pick<Account, 'id' | 'account_code' | 'account_name'>[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const can = useCan();
    const [editing, setEditing] = useState<Account | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Account | null>(null);
    const form = useForm(blank);
    const url = account.chartOfAccounts.index();

    const openForm = (row: Account | null) => {
        setEditing(row);
        form.clearErrors();
        form.setData(
            row
                ? {
                      account_code: row.account_code,
                      account_name: row.account_name,
                      account_type_id: String(row.account_type_id),
                      parent_account_id: row.parent_account_id
                          ? String(row.parent_account_id)
                          : '',
                      normal_balance: row.normal_balance,
                      opening_balance: row.opening_balance,
                      description: row.description ?? '',
                      is_active: row.is_active,
                  }
                : blank,
        );
        setFormOpen(true);
    };

    const submit = () =>
        form.submit(
            editing
                ? account.chartOfAccounts.update(editing.id)
                : account.chartOfAccounts.store(),
            { preserveScroll: true, onSuccess: () => setFormOpen(false) },
        );

    const columns: Column<Account>[] = [
        {
            key: 'account_code',
            label: 'Account',
            sortable: true,
            render: (a) => (
                <div className="grid justify-items-start gap-1">
                    <span className="font-medium">
                        {a.account_name} - {a.account_code}
                    </span>
                    <Badge
                        variant="outline"
                        className="border-indigo-200 bg-indigo-50 text-indigo-700"
                    >
                        {a.account_type.name}
                    </Badge>
                </div>
            ),
        },
        {
            key: 'parent',
            label: 'Parent Account',
            render: (a) =>
                a.parent_account
                    ? `${a.parent_account.account_name} - ${a.parent_account.account_code}`
                    : '-',
        },
        {
            key: 'normal_balance',
            label: 'Normal Balance',
            sortable: true,
            render: (a) => <StatusBadge status={a.normal_balance} />,
        },
        {
            key: 'opening_balance',
            label: 'Opening Balance',
            sortable: true,
            render: (a) => (
                <span className="font-medium whitespace-nowrap">
                    {money(Number(a.opening_balance))}
                </span>
            ),
        },
        {
            key: 'current_balance',
            label: 'Current Balance',
            render: (a) => (
                <span className="font-semibold whitespace-nowrap">
                    {money(Number(a.current_balance))}
                </span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (a) => (
                <StatusBadge status={a.is_active ? 'active' : 'inactive'} />
            ),
        },
    ];

    return (
        <>
            <Head title={t('Chart Of Accounts')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Chart Of Accounts"
                    description="Manage and organize your general ledger accounts, parent accounts, and normal balances."
                    action={
                        can('create-chart-of-accounts') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Account')}
                            </Button>
                        )
                    }
                />

                <DataTable
                    data={accounts}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <>
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="account_type_id"
                                label="All Account Types"
                                options={accountTypes}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="status"
                                label="All Statuses"
                                options={[
                                    { id: 'active', name: t('Active') },
                                    { id: 'inactive', name: t('Inactive') },
                                ]}
                            />
                        </>
                    }
                    tabs={
                        <StatusTabs
                            url={url}
                            filters={filters}
                            counts={counts}
                            name="normal_balance"
                        />
                    }
                    actions={(row) => (
                        <>
                            {can('view-chart-of-accounts') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('View')}
                                    asChild
                                >
                                    <Link
                                        href={account.chartOfAccounts.show(
                                            row.id,
                                        )}
                                    >
                                        <Eye className="text-emerald-600" />
                                    </Link>
                                </Button>
                            )}
                            {can('edit-chart-of-accounts') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Edit')}
                                    onClick={() => openForm(row)}
                                >
                                    <SquarePen className="text-blue-600" />
                                </Button>
                            )}
                            {can('delete-chart-of-accounts') &&
                                !row.is_system_account && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('Delete')}
                                        onClick={() => setDeleting(row)}
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
                title={editing ? 'Edit Account' : 'Add Account'}
                description="A ledger account, its type and where it sits in the chart."
                icon={ListTree}
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
                processing={form.processing}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="coa-code">
                            {t('Account Code')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="coa-code"
                            value={form.data.account_code}
                            onChange={(e) =>
                                form.setData('account_code', e.target.value)
                            }
                        />
                        <InputError message={form.errors.account_code} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="coa-name">
                            {t('Account Name')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="coa-name"
                            value={form.data.account_name}
                            onChange={(e) =>
                                form.setData('account_name', e.target.value)
                            }
                        />
                        <InputError message={form.errors.account_name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="coa-type">
                            {t('Account Type')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <SelectField
                            id="coa-type"
                            value={form.data.account_type_id}
                            placeholder={t('Select Account Type')}
                            onChange={(e) => {
                                const type = accountTypes.find(
                                    (option) =>
                                        String(option.id) === e.target.value,
                                );
                                form.setData({
                                    ...form.data,
                                    account_type_id: e.target.value,
                                    normal_balance:
                                        type?.normal_balance ??
                                        form.data.normal_balance,
                                });
                            }}
                        >
                            {accountTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.account_type_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="coa-parent">
                            {t('Parent Account')}
                        </Label>
                        <SelectField
                            id="coa-parent"
                            value={form.data.parent_account_id}
                            onChange={(e) =>
                                form.setData(
                                    'parent_account_id',
                                    e.target.value,
                                )
                            }
                        >
                            <option value="">{t('None')}</option>
                            {parentAccounts
                                .filter((option) => option.id !== editing?.id)
                                .map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.account_code} -{' '}
                                        {option.account_name}
                                    </option>
                                ))}
                        </SelectField>
                        <InputError message={form.errors.parent_account_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="coa-balance">
                            {t('Normal Balance')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <SelectField
                            id="coa-balance"
                            value={form.data.normal_balance}
                            onChange={(e) =>
                                form.setData(
                                    'normal_balance',
                                    e.target.value as Account['normal_balance'],
                                )
                            }
                        >
                            <option value="debit">{t('Debit')}</option>
                            <option value="credit">{t('Credit')}</option>
                        </SelectField>
                        <InputError message={form.errors.normal_balance} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="coa-opening">
                            {t('Opening Balance')}
                        </Label>
                        <Input
                            id="coa-opening"
                            inputMode="decimal"
                            value={form.data.opening_balance}
                            onChange={(e) =>
                                form.setData('opening_balance', e.target.value)
                            }
                        />
                        <InputError message={form.errors.opening_balance} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="coa-description">
                            {t('Description')}
                        </Label>
                        <Textarea
                            id="coa-description"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                        />
                        <InputError message={form.errors.description} />
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch
                            id="coa-active"
                            checked={form.data.is_active}
                            onCheckedChange={(checked) =>
                                form.setData('is_active', checked)
                            }
                        />
                        <Label htmlFor="coa-active">{t('Is Active')}</Label>
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This account will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(
                        account.chartOfAccounts.destroy(deleting.id),
                        {
                            preserveScroll: true,
                            onSuccess: () => setDeleting(null),
                        },
                    )
                }
            />
        </>
    );
}

ChartOfAccounts.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.chartOfAccounts.index() },
        { title: 'Chart Of Accounts', href: account.chartOfAccounts.index() },
    ],
};
