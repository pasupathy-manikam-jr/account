import { Head, router } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowUpRight,
    CalendarDays,
    CheckCircle2,
    CircleDashed,
    LayoutGrid,
} from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import {
    DateRangeFilter,
    applyFilters,
    FilterSelect,
} from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import account from '@/routes/account';
import type { Paginated, TableFilters } from '@/types';

type Line = {
    id: number;
    description: string | null;
    debit_amount: string;
    credit_amount: string;
    reconciled_at: string | null;
    journal_number: string;
    journal_date: string;
    entry_description: string;
    bank_account_id: number;
    running_balance: string;
};

type Bank = {
    id: number;
    name: string;
    bank_name: string;
    account_number: string;
};

/** "Bank Transfer #BT-2026-09-015" → "BT-2026-09-015": the source document's number, as the demo shows it. */
const reference = (line: Line) =>
    line.entry_description.match(/#(\S+)/)?.[1] ?? line.journal_number;

export default function BankTransactions({
    transactions,
    counts,
    bankAccounts,
    filters,
}: {
    transactions: Paginated<Line>;
    counts: Record<string, number>;
    bankAccounts: Bank[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const url = account.bankTransactions.index();
    const bank = (id: number) => bankAccounts.find((b) => b.id === id);
    const tabs = [
        {
            key: undefined,
            label: 'All Transactions',
            icon: LayoutGrid,
            count: counts.all,
        },
        {
            key: 'credit',
            label: 'Credit',
            icon: ArrowDownLeft,
            count: counts.credit,
        },
        {
            key: 'debit',
            label: 'Debit',
            icon: ArrowUpRight,
            count: counts.debit,
        },
    ];

    // One block per day, newest first (the page arrives already sorted).
    const byDate = (rows: Line[]) =>
        rows.reduce<[string, Line[]][]>((days, line) => {
            const last = days[days.length - 1];

            if (last && last[0] === line.journal_date) {
                last[1].push(line);
            } else {
                days.push([line.journal_date, [line]]);
            }

            return days;
        }, []);

    return (
        <>
            <Head title={t('Bank Transactions')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Bank Transactions"
                    description="Track and manage all bank transactions, view balances, and reconcile bank accounts."
                />
                <DataTable
                    data={transactions}
                    columns={[]}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <>
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="bank_account_id"
                                label="All Bank Accounts"
                                options={bankAccounts.map((b) => ({
                                    id: b.id,
                                    name: b.name,
                                }))}
                            />
                            <DateRangeFilter url={url} filters={filters} />
                        </>
                    }
                    tabs={
                        <div
                            role="tablist"
                            className="-mb-px flex flex-wrap gap-x-2"
                        >
                            {tabs.map(({ key, label, icon: Icon, count }) => {
                                const selected =
                                    (filters.type ?? undefined) === key;

                                return (
                                    <button
                                        key={label}
                                        type="button"
                                        role="tab"
                                        aria-selected={selected}
                                        onClick={() =>
                                            applyFilters(url, filters, {
                                                type: key,
                                            })
                                        }
                                        className={cn(
                                            'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                                            selected
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        <Icon className="size-4" />
                                        {t(label)}
                                        <span
                                            className={cn(
                                                'min-w-5 rounded-full px-1.5 text-xs',
                                                selected
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted text-muted-foreground',
                                            )}
                                        >
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    }
                    renderBody={(rows) => (
                        <div className="grid gap-6 rounded-xl border bg-card p-4 shadow-sm md:p-6">
                            {byDate(rows).map(([day, lines]) => (
                                <section key={day}>
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs font-medium">
                                            <CalendarDays className="size-3.5 text-muted-foreground" />
                                            {date(day)}
                                        </span>
                                        <span className="h-px flex-1 bg-border" />
                                    </div>
                                    <ol className="ms-3 mt-3 grid gap-3 border-s ps-6">
                                        {lines.map((line) => {
                                            const moneyIn =
                                                Number(line.debit_amount) > 0;
                                            const amount = moneyIn
                                                ? line.debit_amount
                                                : line.credit_amount;
                                            const account_ = bank(
                                                line.bank_account_id,
                                            );

                                            return (
                                                <li
                                                    key={line.id}
                                                    className="relative"
                                                >
                                                    <span
                                                        className={cn(
                                                            'absolute -start-[2.15rem] top-4 flex size-5 items-center justify-center rounded-full',
                                                            moneyIn
                                                                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950'
                                                                : 'bg-rose-100 text-rose-600 dark:bg-rose-950',
                                                        )}
                                                    >
                                                        {moneyIn ? (
                                                            <ArrowDownLeft className="size-3" />
                                                        ) : (
                                                            <ArrowUpRight className="size-3" />
                                                        )}
                                                    </span>
                                                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                                <IdBadge>
                                                                    {reference(
                                                                        line,
                                                                    )}
                                                                </IdBadge>
                                                                <span>|</span>
                                                                <span>
                                                                    {
                                                                        account_?.name
                                                                    }
                                                                    {account_?.account_number &&
                                                                        ` (${account_.account_number})`}
                                                                </span>
                                                            </div>
                                                            <div className="mt-2 font-medium">
                                                                {line.description ??
                                                                    line.entry_description}
                                                            </div>
                                                            <div className="mt-2">
                                                                <StatusBadge
                                                                    status={
                                                                        line.reconciled_at
                                                                            ? 'reconciled'
                                                                            : 'cleared'
                                                                    }
                                                                    label={t(
                                                                        line.reconciled_at
                                                                            ? 'Reconciled'
                                                                            : 'Cleared',
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-end">
                                                                <div
                                                                    className={cn(
                                                                        'text-lg font-semibold tabular-nums',
                                                                        moneyIn
                                                                            ? 'text-emerald-600'
                                                                            : 'text-rose-600',
                                                                    )}
                                                                >
                                                                    {moneyIn
                                                                        ? '+ '
                                                                        : '- '}
                                                                    {money(
                                                                        Number(
                                                                            amount,
                                                                        ),
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {t(
                                                                        'Balance',
                                                                    )}
                                                                    :{' '}
                                                                    {money(
                                                                        Number(
                                                                            line.running_balance,
                                                                        ),
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {can(
                                                                'reconcile-bank-transactions',
                                                            ) && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label={t(
                                                                        line.reconciled_at
                                                                            ? 'Mark as unreconciled'
                                                                            : 'Reconcile',
                                                                    )}
                                                                    title={t(
                                                                        line.reconciled_at
                                                                            ? 'Mark as unreconciled'
                                                                            : 'Reconcile',
                                                                    )}
                                                                    onClick={() =>
                                                                        router.put(
                                                                            account.bankTransactions.reconcile(
                                                                                line.id,
                                                                            ),
                                                                            {},
                                                                            {
                                                                                preserveScroll: true,
                                                                            },
                                                                        )
                                                                    }
                                                                >
                                                                    {line.reconciled_at ? (
                                                                        <CheckCircle2 className="text-emerald-600" />
                                                                    ) : (
                                                                        <CircleDashed className="text-muted-foreground" />
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </div>
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
        </>
    );
}

BankTransactions.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.chartOfAccounts.index() },
        { title: 'Banking', href: account.bankAccounts.index() },
        { title: 'Bank Transactions', href: account.bankTransactions.index() },
    ],
};
