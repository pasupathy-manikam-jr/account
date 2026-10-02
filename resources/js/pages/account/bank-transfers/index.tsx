import { Head, router, useForm } from '@inertiajs/react';
import {
    ArrowLeftRight,
    CalendarDays,
    Check,
    Clock,
    Landmark,
    FileCheck,
    Plus,
    SquarePen,
    Trash2,
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
import { DateCell, IdBadge } from '@/components/table-cells';
import {
    DateRangeFilter,
    FilterSelect,
    StatusTabs,
} from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import account from '@/routes/account';
import type { Paginated, TableFilters } from '@/types';

type BankRef = {
    id: number;
    account_name: string;
    account_number: string;
    bank_name: string;
};

type Transfer = {
    id: number;
    transfer_number: string;
    transfer_date: string;
    from_account_id: number;
    to_account_id: number;
    transfer_amount: string;
    transfer_charges: string;
    reference_number: string | null;
    description: string | null;
    status: 'pending' | 'completed';
    from_account: BankRef;
    to_account: BankRef;
};

const today = () => new Date().toISOString().slice(0, 10);
const blank = {
    transfer_date: today(),
    from_account_id: '',
    to_account_id: '',
    transfer_amount: '',
    transfer_charges: '0',
    reference_number: '',
    description: '',
};

export default function BankTransfers({
    transfers,
    counts,
    bankAccounts,
    filters,
}: {
    transfers: Paginated<Transfer>;
    counts: Record<string, number>;
    bankAccounts: { id: number; account_name: string; bank_name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const url = account.bankTransfers.index();
    const form = useForm(blank);
    const [editing, setEditing] = useState<Transfer | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [confirm, setConfirm] = useState<{
        transfer: Transfer;
        action: 'process' | 'delete';
    } | null>(null);
    const required = <span className="text-destructive">*</span>;
    const bank = (b: { account_name: string; bank_name: string }) => (
        <div className="whitespace-nowrap">
            <div>{b.account_name}</div>
            <div className="text-xs text-muted-foreground">{b.bank_name}</div>
        </div>
    );

    const openForm = (transfer: Transfer | null) => {
        setEditing(transfer);
        form.clearErrors();
        form.setData(
            transfer
                ? {
                      transfer_date: transfer.transfer_date,
                      from_account_id: String(transfer.from_account_id),
                      to_account_id: String(transfer.to_account_id),
                      transfer_amount: transfer.transfer_amount,
                      transfer_charges: transfer.transfer_charges,
                      reference_number: transfer.reference_number ?? '',
                      description: transfer.description ?? '',
                  }
                : blank,
        );
        setFormOpen(true);
    };

    const columns: Column<Transfer>[] = [
        {
            key: 'transfer_number',
            label: 'Transfer Number',
            sortable: true,
            render: (tr) => <IdBadge>{tr.transfer_number}</IdBadge>,
        },
        {
            key: 'transfer_date',
            label: 'Date',
            sortable: true,
            render: (tr) => <DateCell value={tr.transfer_date} />,
        },
        {
            key: 'from',
            label: 'From Account',
            render: (tr) => bank(tr.from_account),
        },
        { key: 'to', label: 'To Account', render: (tr) => bank(tr.to_account) },
        {
            key: 'transfer_amount',
            label: 'Amount',
            sortable: true,
            render: (tr) => (
                <span className="font-semibold whitespace-nowrap">
                    {money(Number(tr.transfer_amount))}
                </span>
            ),
        },
        {
            key: 'charges',
            label: 'Charges',
            render: (tr) =>
                Number(tr.transfer_charges)
                    ? money(Number(tr.transfer_charges))
                    : '-',
        },
        {
            key: 'reference_number',
            label: 'Reference',
            render: (tr) => tr.reference_number ?? '-',
        },
        {
            key: 'status',
            label: 'Status',
            render: (tr) => <StatusBadge status={tr.status} />,
        },
    ];

    const actions = (tr: Transfer) =>
        tr.status === 'pending' && (
            <>
                {can('process-bank-transfers') && (
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('Process')}
                        onClick={() =>
                            setConfirm({
                                transfer: tr,
                                action: 'process',
                            })
                        }
                    >
                        <FileCheck className="text-violet-600" />
                    </Button>
                )}
                {can('edit-bank-transfers') && (
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('Edit')}
                        onClick={() => openForm(tr)}
                    >
                        <SquarePen className="text-blue-600" />
                    </Button>
                )}
                {can('delete-bank-transfers') && (
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('Delete')}
                        onClick={() =>
                            setConfirm({
                                transfer: tr,
                                action: 'delete',
                            })
                        }
                    >
                        <Trash2 className="text-destructive" />
                    </Button>
                )}
            </>
        );

    // One block per day, newest first (the page arrives sorted by date).
    const byDate = (rows: Transfer[]) =>
        rows.reduce<[string, Transfer[]][]>((days, tr) => {
            const last = days[days.length - 1];

            if (last && last[0] === tr.transfer_date) {
                last[1].push(tr);
            } else {
                days.push([tr.transfer_date, [tr]]);
            }

            return days;
        }, []);

    return (
        <>
            <Head title={t('Bank Transfers')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Bank Transfers"
                    description="Track and manage transfers between different bank accounts."
                    action={
                        can('create-bank-transfers') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Transfer')}
                            </Button>
                        )
                    }
                />
                <DataTable
                    data={transfers}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <>
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="from_account_id"
                                label="All From Accounts"
                                options={bankAccounts.map((b) => ({
                                    id: b.id,
                                    name: b.account_name,
                                }))}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="to_account_id"
                                label="All To Accounts"
                                options={bankAccounts.map((b) => ({
                                    id: b.id,
                                    name: b.account_name,
                                }))}
                            />
                            <DateRangeFilter url={url} filters={filters} />
                        </>
                    }
                    tabs={
                        <StatusTabs
                            url={url}
                            filters={filters}
                            counts={counts}
                        />
                    }
                    renderBody={(rows) => (
                        <div className="grid gap-6 rounded-xl border bg-card p-4 shadow-sm md:p-6">
                            {byDate(rows).map(([day, items]) => (
                                <section key={day}>
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs font-medium">
                                            <CalendarDays className="size-3.5 text-muted-foreground" />
                                            {date(day)}
                                        </span>
                                        <span className="h-px flex-1 bg-border" />
                                    </div>
                                    <ol className="ms-3 mt-3 grid gap-3 border-s ps-6">
                                        {items.map((tr) => {
                                            const done =
                                                tr.status === 'completed';
                                            const charges = Number(
                                                tr.transfer_charges,
                                            );

                                            return (
                                                <li
                                                    key={tr.id}
                                                    className="relative"
                                                >
                                                    <span className="absolute -start-[2.15rem] top-4 flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                        <ArrowLeftRight className="size-3" />
                                                    </span>
                                                    <div className="overflow-hidden rounded-xl border">
                                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5 text-xs">
                                                            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                                                {t(
                                                                    'Transfer No',
                                                                )}
                                                                :{' '}
                                                                <IdBadge>
                                                                    {
                                                                        tr.transfer_number
                                                                    }
                                                                </IdBadge>
                                                                {tr.reference_number && (
                                                                    <>
                                                                        <span>
                                                                            |
                                                                        </span>
                                                                        {t(
                                                                            'Reference No',
                                                                        )}
                                                                        :
                                                                        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                                                                            {
                                                                                tr.reference_number
                                                                            }
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <div className="flex">
                                                                {actions(tr)}
                                                            </div>
                                                        </div>
                                                        <div className="grid items-center gap-4 p-4 md:grid-cols-[1fr_minmax(8rem,1fr)_1fr_auto]">
                                                            <AccountBlock
                                                                account={
                                                                    tr.from_account
                                                                }
                                                                tone="sky"
                                                            />
                                                            <div className="text-center">
                                                                <div
                                                                    className={cn(
                                                                        'text-[11px] font-semibold',
                                                                        done
                                                                            ? 'text-emerald-600'
                                                                            : 'text-amber-600',
                                                                    )}
                                                                >
                                                                    {t(
                                                                        done
                                                                            ? 'Completed'
                                                                            : 'Pending',
                                                                    )}
                                                                </div>
                                                                <div className="mt-1 flex items-center">
                                                                    <span
                                                                        className={cn(
                                                                            'h-0.5 flex-1',
                                                                            done
                                                                                ? 'bg-emerald-500'
                                                                                : 'border-t-2 border-dashed border-amber-400',
                                                                        )}
                                                                    />
                                                                    <span
                                                                        className={cn(
                                                                            'flex size-6 items-center justify-center rounded-full text-white',
                                                                            done
                                                                                ? 'bg-emerald-500'
                                                                                : 'bg-amber-400',
                                                                        )}
                                                                    >
                                                                        {done ? (
                                                                            <Check className="size-3.5" />
                                                                        ) : (
                                                                            <Clock className="size-3.5" />
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <AccountBlock
                                                                account={
                                                                    tr.to_account
                                                                }
                                                                tone="emerald"
                                                            />
                                                            <div className="text-end">
                                                                <div className="text-sm">
                                                                    {money(
                                                                        Number(
                                                                            tr.transfer_amount,
                                                                        ),
                                                                    )}
                                                                </div>
                                                                {charges >
                                                                    0 && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        +{' '}
                                                                        {t(
                                                                            'Charges',
                                                                        )}
                                                                        :{' '}
                                                                        {money(
                                                                            charges,
                                                                        )}
                                                                    </div>
                                                                )}
                                                                <div className="text-lg font-bold">
                                                                    {money(
                                                                        Number(
                                                                            tr.transfer_amount,
                                                                        ) +
                                                                            charges,
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {tr.description && (
                                                            <div className="border-t px-4 py-2.5 text-sm text-muted-foreground">
                                                                {tr.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </section>
                            ))}
                        </div>
                    )}
                />
            </div>

            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title={editing ? 'Edit Transfer' : 'Add Transfer'}
                description="Money moving between two of your bank accounts."
                icon={ArrowLeftRight}
                processing={form.processing}
                onSubmit={(e) => {
                    e.preventDefault();
                    form.submit(
                        editing
                            ? account.bankTransfers.update(editing.id)
                            : account.bankTransfers.store(),
                        {
                            preserveScroll: true,
                            onSuccess: () => setFormOpen(false),
                        },
                    );
                }}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="from_account_id">
                            {t('From Account')} {required}
                        </Label>
                        <SelectField
                            id="from_account_id"
                            value={form.data.from_account_id}
                            placeholder={t('Select Bank Account')}
                            onChange={(e) =>
                                form.setData('from_account_id', e.target.value)
                            }
                        >
                            {bankAccounts.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.account_name} ({b.bank_name})
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.from_account_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="to_account_id">
                            {t('To Account')} {required}
                        </Label>
                        <SelectField
                            id="to_account_id"
                            value={form.data.to_account_id}
                            placeholder={t('Select Bank Account')}
                            onChange={(e) =>
                                form.setData('to_account_id', e.target.value)
                            }
                        >
                            {bankAccounts
                                .filter(
                                    (b) =>
                                        String(b.id) !==
                                        form.data.from_account_id,
                                )
                                .map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.account_name} ({b.bank_name})
                                    </option>
                                ))}
                        </SelectField>
                        <InputError message={form.errors.to_account_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="transfer_amount">
                            {t('Amount')} {required}
                        </Label>
                        <Input
                            id="transfer_amount"
                            inputMode="decimal"
                            value={form.data.transfer_amount}
                            onChange={(e) =>
                                form.setData('transfer_amount', e.target.value)
                            }
                        />
                        <InputError message={form.errors.transfer_amount} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="transfer_charges">{t('Charges')}</Label>
                        <Input
                            id="transfer_charges"
                            inputMode="decimal"
                            value={form.data.transfer_charges}
                            onChange={(e) =>
                                form.setData('transfer_charges', e.target.value)
                            }
                        />
                        <InputError message={form.errors.transfer_charges} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="transfer_date">
                            {t('Date')} {required}
                        </Label>
                        <DatePicker
                            id="transfer_date"
                            name="transfer_date"
                            defaultValue={form.data.transfer_date}
                            onChange={(v) => form.setData('transfer_date', v)}
                        />
                        <InputError message={form.errors.transfer_date} />
                    </div>
                    <div className="grid gap-2">
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

            <ConfirmDialog
                open={confirm?.action === 'process'}
                onOpenChange={(open) => !open && setConfirm(null)}
                icon={FileCheck}
                title="Process this transfer?"
                description="The amount and any charges leave the sending account and the amount arrives in the receiving account. This is posted to the ledger."
                confirmLabel="Process"
                onConfirm={() =>
                    confirm &&
                    router.put(
                        account.bankTransfers.process(confirm.transfer.id),
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
                description="This transfer will be permanently deleted."
                onConfirm={() =>
                    confirm &&
                    router.delete(
                        account.bankTransfers.destroy(confirm.transfer.id),
                        {
                            preserveScroll: true,
                            onFinish: () => setConfirm(null),
                        },
                    )
                }
            />
        </>
    );
}

BankTransfers.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.chartOfAccounts.index() },
        { title: 'Banking', href: account.bankAccounts.index() },
        { title: 'Bank Transfers', href: account.bankTransfers.index() },
    ],
};

/** A bank account in a transfer card: icon, name and account number. */
function AccountBlock({
    account,
    tone,
}: {
    account: BankRef;
    tone: 'sky' | 'emerald';
}) {
    return (
        <div className="flex items-center gap-3">
            <span
                className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-lg',
                    tone === 'sky'
                        ? 'bg-sky-50 text-sky-600 dark:bg-sky-950'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950',
                )}
            >
                <Landmark className="size-5" />
            </span>
            <div className="min-w-0">
                <div className="truncate font-semibold">
                    {account.account_name}
                </div>
                <div className="text-xs text-muted-foreground">
                    {account.account_number}
                </div>
            </div>
        </div>
    );
}
