import { Head, router, useForm } from '@inertiajs/react';
import {
    CircleCheck,
    CircleX,
    Play,
    Plus,
    SquarePen,
    Trash2,
    Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
import { FilterSelect, StatusTabs } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import asset from '@/routes/asset';
import assets from '@/routes/assets';
import type { Paginated, TableFilters } from '@/types';

type Maintenance = {
    id: number;
    asset_id: number;
    title: string;
    maintenance_type: string;
    priority: string;
    scheduled_date: string;
    completed_date: string | null;
    status: string;
    cost: string;
    technician: string | null;
    notes: string | null;
    asset: { id: number; name: string; serial_code: string };
};

type Action = 'start' | 'complete' | 'cancel';

const TYPES = {
    preventive: 'Preventive',
    corrective: 'Corrective',
    emergency: 'Emergency',
};
const PRIORITIES = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
};
const ACTIONS: Record<
    Action,
    {
        from: string[];
        icon: LucideIcon;
        label: string;
        className: string;
        title: string;
        description: string;
    }
> = {
    start: {
        from: ['scheduled'],
        icon: Play,
        label: 'Start',
        className: 'text-sky-600',
        title: 'Start this maintenance?',
        description:
            'The asset shows as under maintenance until the job is completed or cancelled.',
    },
    complete: {
        from: ['scheduled', 'in_progress'],
        icon: CircleCheck,
        label: 'Complete',
        className: 'text-emerald-600',
        title: 'Mark as completed?',
        description:
            'Today is recorded as the completion date and the job can no longer be edited.',
    },
    cancel: {
        from: ['scheduled', 'in_progress'],
        icon: CircleX,
        label: 'Cancel',
        className: 'text-amber-600',
        title: 'Cancel this maintenance?',
        description: 'The job is kept in the history as cancelled.',
    },
};

const blank = {
    asset_id: '',
    title: '',
    maintenance_type: 'preventive',
    priority: 'medium',
    scheduled_date: '',
    cost: '',
    technician: '',
    notes: '',
};

export default function AssetMaintenancePage({
    maintenances,
    counts,
    assets: assetOptions,
    filters,
}: {
    maintenances: Paginated<Maintenance>;
    counts: Record<string, number>;
    assets: { id: number; name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const routes = asset.assetMaintenance;
    const url = routes.index();
    const form = useForm(blank);
    const [editing, setEditing] = useState<Maintenance | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [pending, setPending] = useState<{
        job: Maintenance;
        action: Action;
    } | null>(null);
    const [deleting, setDeleting] = useState<Maintenance | null>(null);
    const required = <span className="text-destructive">*</span>;
    const open = (m: Maintenance) =>
        ['scheduled', 'in_progress'].includes(m.status);

    const openForm = (job: Maintenance | null) => {
        setEditing(job);
        form.clearErrors();
        form.setData(
            job
                ? {
                      asset_id: String(job.asset_id),
                      title: job.title,
                      maintenance_type: job.maintenance_type,
                      priority: job.priority,
                      scheduled_date: job.scheduled_date,
                      cost: job.cost,
                      technician: job.technician ?? '',
                      notes: job.notes ?? '',
                  }
                : blank,
        );
        setFormOpen(true);
    };

    const columns: Column<Maintenance>[] = [
        {
            key: 'title',
            label: 'Title',
            sortable: true,
            render: (m) => (
                <div>
                    <div className="font-medium">{m.title}</div>
                    <StatusBadge status={m.maintenance_type} />
                </div>
            ),
        },
        {
            key: 'asset',
            label: 'Asset',
            render: (m) => (
                <div>
                    <div>{m.asset.name}</div>
                    <IdBadge>{m.asset.serial_code}</IdBadge>
                </div>
            ),
        },
        {
            key: 'scheduled_date',
            label: 'Scheduled Date',
            sortable: true,
            render: (m) => <DateCell value={m.scheduled_date} />,
        },
        {
            key: 'technician',
            label: 'Technician',
            render: (m) => m.technician ?? '-',
        },
        {
            key: 'status',
            label: 'Status',
            render: (m) => <StatusBadge status={m.status} />,
        },
        {
            key: 'priority',
            label: 'Priority',
            render: (m) => <StatusBadge status={m.priority} />,
        },
        {
            key: 'cost',
            label: 'Cost',
            sortable: true,
            render: (m) => (
                <span className="font-semibold whitespace-nowrap">
                    {money(Number(m.cost))}
                </span>
            ),
        },
    ];

    const choice = (
        name: 'maintenance_type' | 'priority',
        label: string,
        options: Record<string, string>,
    ) => (
        <div className="grid gap-2">
            <Label htmlFor={name}>
                {t(label)} {required}
            </Label>
            <SelectField
                id={name}
                value={form.data[name]}
                onChange={(e) => form.setData(name, e.target.value)}
            >
                {Object.entries(options).map(([value, text]) => (
                    <option key={value} value={value}>
                        {t(text)}
                    </option>
                ))}
            </SelectField>
            <InputError message={form.errors[name]} />
        </div>
    );

    return (
        <>
            <Head title={t('Maintenance')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Maintenance"
                    description="Track and manage maintenance schedules, costs, technicians, status and priorities for all company assets."
                    action={
                        can('create-asset-maintenance') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Schedule Maintenance')}
                            </Button>
                        )
                    }
                />
                <DataTable
                    data={maintenances}
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
                                name="maintenance_type"
                                label="All Types"
                                options={Object.entries(TYPES).map(
                                    ([id, name]) => ({ id, name: t(name) }),
                                )}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="priority"
                                label="All Priorities"
                                options={Object.entries(PRIORITIES).map(
                                    ([id, name]) => ({ id, name: t(name) }),
                                )}
                            />
                        </>
                    }
                    renderCard={(m, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate font-semibold">
                                        {m.title}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {m.asset.name} · {m.asset.serial_code}
                                    </div>
                                </div>
                                <StatusBadge status={m.status} />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <StatusBadge status={m.maintenance_type} />
                                <StatusBadge status={m.priority} />
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {date(m.scheduled_date)}
                                </span>
                                <span className="font-semibold">
                                    {money(Number(m.cost))}
                                </span>
                            </div>
                            {m.technician && (
                                <div className="truncate text-xs text-muted-foreground">
                                    {m.technician}
                                </div>
                            )}
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                    actions={(m) => (
                        <>
                            {can('edit-asset-maintenance') &&
                                (Object.keys(ACTIONS) as Action[])
                                    .filter((a) =>
                                        ACTIONS[a].from.includes(m.status),
                                    )
                                    .map((a) => {
                                        const {
                                            icon: Icon,
                                            label,
                                            className,
                                        } = ACTIONS[a];

                                        return (
                                            <Button
                                                key={a}
                                                variant="ghost"
                                                size="icon"
                                                aria-label={t(label)}
                                                title={t(label)}
                                                onClick={() =>
                                                    setPending({
                                                        job: m,
                                                        action: a,
                                                    })
                                                }
                                            >
                                                <Icon className={className} />
                                            </Button>
                                        );
                                    })}
                            {open(m) && can('edit-asset-maintenance') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Edit')}
                                    onClick={() => openForm(m)}
                                >
                                    <SquarePen className="text-blue-600" />
                                </Button>
                            )}
                            {m.status !== 'in_progress' &&
                                can('delete-asset-maintenance') && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('Delete')}
                                        onClick={() => setDeleting(m)}
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
                title={editing ? 'Edit Maintenance' : 'Schedule Maintenance'}
                description="A service job on one asset: what, when, who and how much."
                icon={Wrench}
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
                        <Label htmlFor="asset_id">
                            {t('Asset')} {required}
                        </Label>
                        <SelectField
                            id="asset_id"
                            value={form.data.asset_id}
                            placeholder={t('Select Asset')}
                            onChange={(e) =>
                                form.setData('asset_id', e.target.value)
                            }
                        >
                            {assetOptions.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.asset_id} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="title">
                            {t('Title')} {required}
                        </Label>
                        <Input
                            id="title"
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                        />
                        <InputError message={form.errors.title} />
                    </div>
                    {choice('maintenance_type', 'Type', TYPES)}
                    {choice('priority', 'Priority', PRIORITIES)}
                    <div className="grid gap-2">
                        <Label htmlFor="scheduled_date">
                            {t('Scheduled Date')} {required}
                        </Label>
                        <DatePicker
                            key={`scheduled-${editing?.id}`}
                            id="scheduled_date"
                            name="scheduled_date"
                            defaultValue={form.data.scheduled_date}
                            onChange={(v) => form.setData('scheduled_date', v)}
                        />
                        <InputError message={form.errors.scheduled_date} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cost">{t('Cost')}</Label>
                        <Input
                            id="cost"
                            inputMode="decimal"
                            value={form.data.cost}
                            onChange={(e) =>
                                form.setData('cost', e.target.value)
                            }
                        />
                        <InputError message={form.errors.cost} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="technician">{t('Technician')}</Label>
                        <Input
                            id="technician"
                            value={form.data.technician}
                            onChange={(e) =>
                                form.setData('technician', e.target.value)
                            }
                        />
                        <InputError message={form.errors.technician} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="notes">{t('Notes')}</Label>
                        <Textarea
                            id="notes"
                            value={form.data.notes}
                            onChange={(e) =>
                                form.setData('notes', e.target.value)
                            }
                        />
                        <InputError message={form.errors.notes} />
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={pending !== null}
                onOpenChange={(o) => !o && setPending(null)}
                icon={pending ? ACTIONS[pending.action].icon : undefined}
                title={pending ? ACTIONS[pending.action].title : ''}
                description={pending ? ACTIONS[pending.action].description : ''}
                confirmLabel={pending ? ACTIONS[pending.action].label : ''}
                onConfirm={() =>
                    pending &&
                    router.put(
                        routes[pending.action](pending.job.id),
                        {},
                        {
                            preserveScroll: true,
                            onFinish: () => setPending(null),
                        },
                    )
                }
            />
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(o) => !o && setDeleting(null)}
                description="This maintenance record will be permanently deleted."
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

AssetMaintenancePage.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Assets', href: assets.index() },
        { title: 'Maintenance', href: asset.assetMaintenance.index() },
    ],
};
