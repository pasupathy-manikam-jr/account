import { Head, Link, router } from '@inertiajs/react';
import {
    CalendarDays,
    CircleAlert,
    CircleCheck,
    CirclePause,
    Copy,
    Eye,
    FileText,
    LayoutGrid,
    Play,
    Plus,
    SquarePen,
    Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { PersonCell } from '@/components/person-cell';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import { FilterSelect } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import contracts from '@/routes/contracts';
import type { Paginated, TableFilters } from '@/types';
import { ContractFormDialog } from './contract-form';
import { contractTerm, statusLabel } from './types';
import type { Contract, Party } from './types';

const CARDS: { key: string; label: string; icon: LucideIcon; tone: string }[] =
    [
        {
            key: 'all',
            label: 'Total Contracts',
            icon: LayoutGrid,
            tone: 'border-blue-200 from-blue-50 text-blue-700 dark:border-blue-900 dark:from-blue-950/60 dark:text-blue-300',
        },
        {
            key: 'accepted',
            label: 'Active Contract',
            icon: Play,
            tone: 'border-emerald-200 from-emerald-50 text-emerald-700 dark:border-emerald-900 dark:from-emerald-950/60 dark:text-emerald-300',
        },
        {
            key: 'pending',
            label: 'Pending Contract',
            icon: CirclePause,
            tone: 'border-orange-200 from-orange-50 text-orange-700 dark:border-orange-900 dark:from-orange-950/60 dark:text-orange-300',
        },
        {
            key: 'closed',
            label: 'Closed Contract',
            icon: CircleCheck,
            tone: 'border-violet-200 from-violet-50 text-violet-700 dark:border-violet-900 dark:from-violet-950/60 dark:text-violet-300',
        },
        {
            key: 'declined',
            label: 'Declined Contract',
            icon: CircleAlert,
            tone: 'border-rose-200 from-rose-50 text-rose-700 dark:border-rose-900 dark:from-rose-950/60 dark:text-rose-300',
        },
    ];

export default function Contracts({
    contracts: list,
    counts,
    users,
    contractTypes,
    filters,
}: {
    contracts: Paginated<Contract>;
    counts: Record<string, number>;
    users: Party[];
    contractTypes: { id: number; name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const [editing, setEditing] = useState<Contract | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Contract | null>(null);
    const url = contracts.index();

    const openForm = (contract: Contract | null) => {
        setEditing(contract);
        setFormOpen(true);
    };

    const columns: Column<Contract>[] = [
        {
            key: 'contract_number',
            label: 'Contract Number',
            sortable: true,
            render: (c) => (
                <div className="grid max-w-56 justify-items-start gap-1">
                    <IdBadge>{c.contract_number}</IdBadge>
                    <span>{c.subject}</span>
                </div>
            ),
        },
        {
            key: 'user',
            label: 'Assigned to',
            render: (c) => (
                <PersonCell name={c.user.name} detail={c.user.email} />
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (c) => (
                <StatusBadge status={c.status} label={statusLabel(c.status)} />
            ),
        },
        {
            key: 'duration',
            label: 'Contract Duration',
            render: (c) => {
                const term = contractTerm(c.start_date, c.end_date);

                return (
                    <div className="grid min-w-48 gap-1 text-xs">
                        <div className="flex justify-between gap-2 font-medium">
                            <span>{t(term.label)}</span>
                            <span className="text-muted-foreground">
                                ({term.progress}%)
                            </span>
                        </div>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                            <CalendarDays className="size-3.5 text-muted-foreground" />
                            {date(c.start_date)} — {date(c.end_date)}
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                            <div
                                className={cn(
                                    'h-full rounded-full',
                                    term.progress < 60
                                        ? 'bg-emerald-500'
                                        : term.progress < 90
                                          ? 'bg-orange-500'
                                          : 'bg-rose-500',
                                )}
                                style={{ width: `${term.progress}%` }}
                            />
                        </div>
                    </div>
                );
            },
        },
        {
            key: 'value',
            label: 'Contract Amount',
            sortable: true,
            render: (c) => (
                <span className="font-semibold whitespace-nowrap">
                    {money(Number(c.value))}
                </span>
            ),
        },
    ];

    const actions = (contract: Contract) => (
        <>
            {can('duplicate-contracts') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Duplicate')}
                    onClick={() =>
                        router.post(
                            contracts.duplicate(contract.id),
                            {},
                            { preserveScroll: true },
                        )
                    }
                >
                    <Copy className="text-orange-500" />
                </Button>
            )}
            {can('preview-contracts') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Preview')}
                    title={t('Preview')}
                    asChild
                >
                    <Link href={contracts.preview(contract.id)}>
                        <FileText className="text-sky-600" />
                    </Link>
                </Button>
            )}
            {can('view-contracts') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('View')}
                    asChild
                >
                    <Link href={contracts.show(contract.id)}>
                        <Eye className="text-emerald-600" />
                    </Link>
                </Button>
            )}
            {can('edit-contracts') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Edit')}
                    onClick={() => openForm(contract)}
                >
                    <SquarePen className="text-blue-600" />
                </Button>
            )}
            {can('delete-contracts') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Delete')}
                    onClick={() => setDeleting(contract)}
                >
                    <Trash2 className="text-destructive" />
                </Button>
            )}
        </>
    );

    return (
        <>
            <Head title={t('Contracts')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Contracts"
                    description="Manage and track your contracts, assignment, value, and statuses."
                    action={
                        can('create-contracts') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Contract')}
                            </Button>
                        )
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    {CARDS.map((card) => {
                        const total = counts.all || 0;
                        const value = counts[card.key] ?? 0;

                        return (
                            <div
                                key={card.key}
                                className={cn(
                                    'rounded-xl border bg-gradient-to-br to-transparent p-5',
                                    card.tone,
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className="text-sm font-medium">
                                        {t(card.label)}
                                    </span>
                                    <card.icon
                                        className="size-6 shrink-0"
                                        strokeWidth={1.5}
                                    />
                                </div>
                                <div className="mt-3 text-2xl font-bold">
                                    {value}
                                </div>
                                <div className="mt-1 text-xs">
                                    {card.key === 'all'
                                        ? t('All time')
                                        : t(':percent% of total', {
                                              percent: total
                                                  ? Math.round(
                                                        (value / total) * 100,
                                                    )
                                                  : 0,
                                          })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <DataTable
                    data={list}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <>
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="type_id"
                                label="All Contract Types"
                                options={contractTypes}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="status"
                                label="All Statuses"
                                options={[
                                    'pending',
                                    'accepted',
                                    'declined',
                                    'closed',
                                ].map((s) => ({
                                    id: s,
                                    name: t(statusLabel(s)),
                                }))}
                            />
                            {can('manage-any-contracts') && (
                                <FilterSelect
                                    url={url}
                                    filters={filters}
                                    name="user_id"
                                    label="All Users"
                                    options={users}
                                />
                            )}
                        </>
                    }
                    actions={actions}
                    renderCard={(contract, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <Link
                                        href={contracts.show(contract.id)}
                                        className="font-semibold hover:underline"
                                    >
                                        {contract.subject}
                                    </Link>
                                    <div className="mt-1">
                                        <IdBadge>
                                            {contract.contract_number}
                                        </IdBadge>
                                    </div>
                                </div>
                                <StatusBadge
                                    status={contract.status}
                                    label={t(statusLabel(contract.status))}
                                />
                            </div>
                            <PersonCell
                                name={contract.user.name}
                                detail={contract.user.email}
                            />
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Contract Value')}
                                    </div>
                                    <div className="font-semibold">
                                        {money(Number(contract.value))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Type')}
                                    </div>
                                    <div className="truncate">
                                        {contract.contract_type.name}
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                <CalendarDays className="me-1 inline size-3.5" />
                                {date(contract.start_date)} –{' '}
                                {date(contract.end_date)}
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                />
            </div>

            {formOpen && (
                <ContractFormDialog
                    open
                    onOpenChange={setFormOpen}
                    contract={editing}
                    users={users}
                    contractTypes={contractTypes}
                />
            )}

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This contract and its attachments, comments, notes, renewals and signatures will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(contracts.destroy(deleting.id), {
                        preserveScroll: true,
                        onSuccess: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

Contracts.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Contracts', href: contracts.index() },
    ],
};
