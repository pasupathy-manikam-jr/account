import { Head, router, useForm } from '@inertiajs/react';
import { Eye, Landmark, Plus, SquarePen, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import { FilterSelect, StatusTabs } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ViewDialog } from '@/components/view-dialog';
import type { ViewField } from '@/components/view-dialog';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import account from '@/routes/account';
import type { Paginated, TableFilters } from '@/types';

const TYPES = ['checking', 'savings', 'credit', 'loan'] as const;

type BankAccount = {
    id: number;
    account_number: string;
    account_name: string;
    bank_name: string;
    branch_name: string | null;
    account_type: (typeof TYPES)[number];
    opening_balance: string;
    current_balance: string;
    iban: string | null;
    swift_code: string | null;
    routing_number: string | null;
    is_active: boolean;
    gl_account_id: number;
    gl_account: { id: number; account_code: string; account_name: string };
};

type GlAccount = { id: number; account_code: string; account_name: string };

const TEXT_FIELDS = [
    ['account_number', 'Account Number', true],
    ['account_name', 'Account Name', true],
    ['bank_name', 'Bank Name', true],
    ['branch_name', 'Branch Name', false],
    ['iban', 'IBAN', false],
    ['swift_code', 'SWIFT Code', false],
    ['routing_number', 'Routing Number', false],
] as const;

const blank = {
    account_number: '',
    account_name: '',
    bank_name: '',
    branch_name: '',
    account_type: 'checking' as BankAccount['account_type'],
    opening_balance: '0.00',
    iban: '',
    swift_code: '',
    routing_number: '',
    is_active: true,
    gl_account_id: '',
};

const typeLabel = (type: string) =>
    type.charAt(0).toUpperCase() + type.slice(1);

export default function BankAccounts({
    bankAccounts,
    counts,
    glAccounts,
    usedGlAccountIds,
    filters,
}: {
    bankAccounts: Paginated<BankAccount>;
    counts: Record<string, number>;
    glAccounts: GlAccount[];
    usedGlAccountIds: number[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const can = useCan();
    const [editing, setEditing] = useState<BankAccount | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [viewing, setViewing] = useState<BankAccount | null>(null);
    const [deleting, setDeleting] = useState<BankAccount | null>(null);
    const form = useForm(blank);
    const url = account.bankAccounts.index();

    const openForm = (bank: BankAccount | null) => {
        setEditing(bank);
        form.clearErrors();
        form.setData(
            bank
                ? {
                      account_number: bank.account_number,
                      account_name: bank.account_name,
                      bank_name: bank.bank_name,
                      branch_name: bank.branch_name ?? '',
                      account_type: bank.account_type,
                      opening_balance: bank.opening_balance,
                      iban: bank.iban ?? '',
                      swift_code: bank.swift_code ?? '',
                      routing_number: bank.routing_number ?? '',
                      is_active: bank.is_active,
                      gl_account_id: String(bank.gl_account_id),
                  }
                : blank,
        );
        setFormOpen(true);
    };

    const submit = () =>
        form.submit(
            editing
                ? account.bankAccounts.update(editing.id)
                : account.bankAccounts.store(),
            { preserveScroll: true, onSuccess: () => setFormOpen(false) },
        );

    // A ledger account backs one bank account at most; keep the one being edited.
    const freeGlAccounts = glAccounts.filter(
        (gl) =>
            !usedGlAccountIds.includes(gl.id) ||
            gl.id === editing?.gl_account_id,
    );

    const columns: Column<BankAccount>[] = [
        {
            key: 'account_number',
            label: 'Account Number',
            sortable: true,
            render: (b) => <IdBadge>{b.account_number}</IdBadge>,
        },
        {
            key: 'account_name',
            label: 'Account Name',
            sortable: true,
            render: (b) => b.account_name,
        },
        {
            key: 'bank_name',
            label: 'Bank Name',
            sortable: true,
            render: (b) => b.bank_name,
        },
        {
            key: 'account_type',
            label: 'Account Type',
            render: (b) => <StatusBadge status={b.account_type} />,
        },
        {
            key: 'current_balance',
            label: 'Current Balance',
            render: (b) => (
                <span className="font-medium whitespace-nowrap">
                    {money(Number(b.current_balance))}
                </span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (b) => (
                <StatusBadge status={b.is_active ? 'active' : 'inactive'} />
            ),
        },
    ];

    const actions = (bank: BankAccount) => (
        <>
            <Button
                variant="ghost"
                size="icon"
                aria-label={t('View')}
                onClick={() => setViewing(bank)}
            >
                <Eye className="text-emerald-600" />
            </Button>
            {can('edit-bank-accounts') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Edit')}
                    onClick={() => openForm(bank)}
                >
                    <SquarePen className="text-blue-600" />
                </Button>
            )}
            {can('delete-bank-accounts') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Delete')}
                    onClick={() => setDeleting(bank)}
                >
                    <Trash2 className="text-destructive" />
                </Button>
            )}
        </>
    );

    return (
        <>
            <Head title={t('Bank Accounts')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Bank Accounts"
                    description="Track and manage all business bank accounts, their details, and current balances."
                    action={
                        can('create-bank-accounts') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Bank Account')}
                            </Button>
                        )
                    }
                />

                <DataTable
                    data={bankAccounts}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
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
                    }
                    tabs={
                        <StatusTabs
                            url={url}
                            filters={filters}
                            counts={counts}
                            name="account_type"
                        />
                    }
                    actions={actions}
                    renderCard={(bank, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start gap-3">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Landmark className="size-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate font-semibold">
                                        {bank.account_name}
                                    </div>
                                    <div className="truncate text-sm text-muted-foreground">
                                        {bank.bank_name}
                                    </div>
                                </div>
                                <StatusBadge status={bank.account_type} />
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <IdBadge>{bank.account_number}</IdBadge>
                                <StatusBadge
                                    status={
                                        bank.is_active ? 'active' : 'inactive'
                                    }
                                />
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">
                                    {t('Current Balance')}
                                </div>
                                <div className="text-xl font-bold text-primary">
                                    {money(Number(bank.current_balance))}
                                </div>
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                />
            </div>

            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title={editing ? 'Edit Bank Account' : 'Add Bank Account'}
                description="Bank details and the ledger account that carries its balance."
                icon={Landmark}
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
                processing={form.processing}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    {TEXT_FIELDS.map(([key, label, required]) => (
                        <div key={key} className="grid gap-2">
                            <Label htmlFor={`bank-${key}`}>
                                {t(label)}{' '}
                                {required && (
                                    <span className="text-destructive">*</span>
                                )}
                            </Label>
                            <Input
                                id={`bank-${key}`}
                                value={form.data[key]}
                                onChange={(e) =>
                                    form.setData(key, e.target.value)
                                }
                            />
                            <InputError message={form.errors[key]} />
                        </div>
                    ))}
                    <div className="grid gap-2">
                        <Label htmlFor="bank-type">
                            {t('Account Type')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <SelectField
                            id="bank-type"
                            value={form.data.account_type}
                            onChange={(e) =>
                                form.setData(
                                    'account_type',
                                    e.target
                                        .value as BankAccount['account_type'],
                                )
                            }
                        >
                            {TYPES.map((type) => (
                                <option key={type} value={type}>
                                    {t(typeLabel(type))}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.account_type} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bank-opening">
                            {t('Opening Balance')}
                        </Label>
                        <Input
                            id="bank-opening"
                            inputMode="decimal"
                            value={form.data.opening_balance}
                            onChange={(e) =>
                                form.setData('opening_balance', e.target.value)
                            }
                        />
                        <InputError message={form.errors.opening_balance} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bank-gl">
                            {t('GL Account')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <SelectField
                            id="bank-gl"
                            value={form.data.gl_account_id}
                            placeholder={t('Select GL Account')}
                            onChange={(e) =>
                                form.setData('gl_account_id', e.target.value)
                            }
                        >
                            {freeGlAccounts.map((gl) => (
                                <option key={gl.id} value={gl.id}>
                                    {gl.account_code} - {gl.account_name}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.gl_account_id} />
                    </div>
                    <div className="flex items-center gap-3 self-end pb-2">
                        <Switch
                            id="bank-active"
                            checked={form.data.is_active}
                            onCheckedChange={(checked) =>
                                form.setData('is_active', checked)
                            }
                        />
                        <Label htmlFor="bank-active">{t('Is Active')}</Label>
                    </div>
                </div>
            </FormDialog>

            <ViewDialog
                open={viewing !== null}
                onClose={() => setViewing(null)}
                icon={Landmark}
                title={viewing?.account_name}
                description={viewing?.bank_name}
                fields={
                    viewing
                        ? [
                              ...TEXT_FIELDS.filter(
                                  ([key]) =>
                                      key !== 'account_name' &&
                                      key !== 'bank_name',
                              ).map(([key, label]): ViewField => [
                                  label,
                                  viewing[key],
                              ]),
                              [
                                  'Account Type',
                                  <StatusBadge
                                      key="type"
                                      status={viewing.account_type}
                                  />,
                              ],
                              [
                                  'Status',
                                  <StatusBadge
                                      key="status"
                                      status={
                                          viewing.is_active
                                              ? 'active'
                                              : 'inactive'
                                      }
                                  />,
                              ],
                              [
                                  'GL Account',
                                  `${viewing.gl_account.account_code} - ${viewing.gl_account.account_name}`,
                              ],
                              [
                                  'Opening Balance',
                                  money(Number(viewing.opening_balance)),
                              ],
                              [
                                  'Current Balance',
                                  <span
                                      key="balance"
                                      className="text-base font-bold text-primary"
                                  >
                                      {money(Number(viewing.current_balance))}
                                  </span>,
                                  true,
                              ],
                          ]
                        : []
                }
            />

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This bank account will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(account.bankAccounts.destroy(deleting.id), {
                        preserveScroll: true,
                        onSuccess: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

BankAccounts.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.chartOfAccounts.index() },
        { title: 'Banking', href: account.bankAccounts.index() },
        { title: 'Bank Accounts', href: account.bankAccounts.index() },
    ],
};
