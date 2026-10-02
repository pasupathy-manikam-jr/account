import { Head, router, useForm } from '@inertiajs/react';
import {
    CalendarClock,
    CircleCheck,
    ClipboardList,
    Handshake,
    Plus,
    SquarePen,
    Trash2,
    Undo2,
    UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import DatePicker from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { PersonCell } from '@/components/person-cell';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { SummaryCard } from '@/components/summary-card';
import { DateCell, IdBadge } from '@/components/table-cells';
import { FilterSelect, StatusTabs } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import asset from '@/routes/asset';
import assets from '@/routes/assets';
import type { Paginated, TableFilters } from '@/types';

type Assignment = {
    id: number;
    asset_id: number;
    assigned_to: number;
    assigned_date: string;
    expected_return_date: string | null;
    condition: string;
    returned_date: string | null;
    return_condition: string | null;
    notes: string | null;
    status: string;
    asset: { id: number; name: string; serial_code: string };
    assignee: { id: number; name: string; email: string };
};

const CONDITIONS = ['excellent', 'good', 'fair', 'poor'];
const today = () => new Date().toISOString().slice(0, 10);
const blank = {
    asset_id: '',
    assigned_to: '',
    assigned_date: today(),
    expected_return_date: '',
    condition: 'good',
    notes: '',
};

export default function AssetAssignments({
    assignments,
    counts,
    assets: assetOptions,
    staff,
    filters,
}: {
    assignments: Paginated<Assignment>;
    counts: Record<string, number>;
    assets: { id: number; name: string; free: number }[];
    staff: { id: number; name: string; email: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { date } = useFormat();
    const can = useCan();
    const routes = asset.assetAssignments;
    const url = routes.index();
    const form = useForm(blank);
    const returnForm = useForm({
        returned_date: today(),
        return_condition: 'good',
    });
    const [editing, setEditing] = useState<Assignment | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [returning, setReturning] = useState<Assignment | null>(null);
    const [deleting, setDeleting] = useState<Assignment | null>(null);
    const required = <span className="text-destructive">*</span>;
    const percent = (n: number) =>
        counts.all ? Math.round((n / counts.all) * 100) : 0;

    const openForm = (assignment: Assignment | null) => {
        setEditing(assignment);
        form.clearErrors();
        form.setData(
            assignment
                ? {
                      asset_id: String(assignment.asset_id),
                      assigned_to: String(assignment.assigned_to),
                      assigned_date: assignment.assigned_date,
                      expected_return_date:
                          assignment.expected_return_date ?? '',
                      condition: assignment.condition,
                      notes: assignment.notes ?? '',
                  }
                : blank,
        );
        setFormOpen(true);
    };

    const columns: Column<Assignment>[] = [
        {
            key: 'asset',
            label: 'Asset',
            render: (a) => (
                <div>
                    <div className="font-medium">{a.asset.name}</div>
                    <IdBadge>{a.asset.serial_code}</IdBadge>
                </div>
            ),
        },
        {
            key: 'assignee',
            label: 'Assigned To',
            render: (a) => (
                <PersonCell name={a.assignee.name} detail={a.assignee.email} />
            ),
        },
        {
            key: 'assigned_date',
            label: 'Assigned Date',
            sortable: true,
            render: (a) => <DateCell value={a.assigned_date} />,
        },
        {
            key: 'expected_return_date',
            label: 'Expected Return',
            sortable: true,
            render: (a) =>
                a.returned_date ? (
                    <span className="text-xs text-muted-foreground">
                        {t('Returned')} <DateCell value={a.returned_date} />
                    </span>
                ) : a.expected_return_date ? (
                    <DateCell value={a.expected_return_date} />
                ) : (
                    '-'
                ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (a) => <StatusBadge status={a.status} />,
        },
        {
            key: 'condition',
            label: 'Condition',
            render: (a) => (
                <div className="flex items-center gap-1">
                    <StatusBadge status={a.condition} />
                    {a.return_condition && (
                        <>
                            <span className="text-muted-foreground">→</span>
                            <StatusBadge status={a.return_condition} />
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <>
            <Head title={t('Asset Assignments')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Assignments"
                    description="Track and manage assets assigned to employees, log expected return dates, record asset condition states, and process returned assets."
                    action={
                        can('create-asset-assignments') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Assign Asset')}
                            </Button>
                        )
                    }
                />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        tone="blue"
                        icon={ClipboardList}
                        label="Total Assignments"
                        value={counts.all}
                        caption="All time assignments"
                    />
                    <SummaryCard
                        tone="green"
                        icon={UserCheck}
                        label="Active Assignments"
                        value={counts.active}
                        caption={t('Currently active (:percent%)', {
                            percent: percent(counts.active),
                        })}
                    />
                    <SummaryCard
                        tone="gray"
                        icon={CircleCheck}
                        label="Returned Assets"
                        value={counts.returned}
                        caption={t('Successfully returned (:percent%)', {
                            percent: percent(counts.returned),
                        })}
                    />
                    <SummaryCard
                        tone="rose"
                        icon={CalendarClock}
                        label="Overdue Assignments"
                        value={counts.overdue}
                        caption="Past the expected return date"
                    />
                </div>
                <DataTable
                    data={assignments}
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
                        <FilterSelect
                            url={url}
                            filters={filters}
                            name="assigned_to"
                            label="All Users"
                            options={staff}
                        />
                    }
                    renderCard={(a, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate font-semibold">
                                        {a.asset.name}
                                    </div>
                                    <IdBadge>{a.asset.serial_code}</IdBadge>
                                </div>
                                <StatusBadge status={a.status} />
                            </div>
                            <PersonCell
                                name={a.assignee.name}
                                detail={a.assignee.email}
                            />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                    {date(a.assigned_date)} →{' '}
                                    {a.returned_date
                                        ? date(a.returned_date)
                                        : a.expected_return_date
                                          ? date(a.expected_return_date)
                                          : t('Open-ended')}
                                </span>
                                <StatusBadge
                                    status={a.return_condition ?? a.condition}
                                />
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                    actions={(a) =>
                        !a.returned_date ? (
                            <>
                                {can('return-assets') && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('Return')}
                                        title={t('Return')}
                                        onClick={() => {
                                            returnForm.setData({
                                                returned_date: today(),
                                                return_condition: a.condition,
                                            });
                                            returnForm.clearErrors();
                                            setReturning(a);
                                        }}
                                    >
                                        <Undo2 className="text-emerald-600" />
                                    </Button>
                                )}
                                {can('edit-asset-assignments') && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('Edit')}
                                        onClick={() => openForm(a)}
                                    >
                                        <SquarePen className="text-blue-600" />
                                    </Button>
                                )}
                                {can('delete-asset-assignments') && (
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
                        ) : (
                            can('delete-asset-assignments') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Delete')}
                                    onClick={() => setDeleting(a)}
                                >
                                    <Trash2 className="text-destructive" />
                                </Button>
                            )
                        )
                    }
                />
            </div>

            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title={editing ? 'Edit Assignment' : 'Assign Asset'}
                description="Hand an asset to a member of staff and note the state it went out in."
                icon={Handshake}
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
                            {assetOptions
                                .filter(
                                    (a) =>
                                        a.free > 0 ||
                                        a.id === editing?.asset_id,
                                )
                                .map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name} ·{' '}
                                        {t(':count available', {
                                            count: a.free,
                                        })}
                                    </option>
                                ))}
                        </SelectField>
                        <InputError message={form.errors.asset_id} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="assigned_to">
                            {t('Assigned To')} {required}
                        </Label>
                        <SelectField
                            id="assigned_to"
                            value={form.data.assigned_to}
                            placeholder={t('Select Employee')}
                            onChange={(e) =>
                                form.setData('assigned_to', e.target.value)
                            }
                        >
                            {staff.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.assigned_to} />
                    </div>
                    {(
                        [
                            ['assigned_date', 'Assigned Date', true],
                            ['expected_return_date', 'Expected Return', false],
                        ] as const
                    ).map(([name, label, isRequired]) => (
                        <div
                            key={`${name}-${editing?.id}`}
                            className="grid gap-2"
                        >
                            <Label htmlFor={name}>
                                {t(label)} {isRequired && required}
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
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="condition">
                            {t('Condition')} {required}
                        </Label>
                        <SelectField
                            id="condition"
                            value={form.data.condition}
                            onChange={(e) =>
                                form.setData('condition', e.target.value)
                            }
                        >
                            {CONDITIONS.map((c) => (
                                <option key={c} value={c}>
                                    {t(c.charAt(0).toUpperCase() + c.slice(1))}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.condition} />
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

            <FormDialog
                open={returning !== null}
                onOpenChange={(open) => !open && setReturning(null)}
                title="Return Asset"
                description="Record when the asset came back and the state it came back in."
                icon={Undo2}
                processing={returnForm.processing}
                submitLabel="Return"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (returning) {
                        returnForm.put(routes.return(returning.id).url, {
                            preserveScroll: true,
                            onSuccess: () => setReturning(null),
                        });
                    }
                }}
            >
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="returned_date">
                            {t('Return Date')} {required}
                        </Label>
                        <DatePicker
                            key={returning?.id}
                            id="returned_date"
                            name="returned_date"
                            defaultValue={returnForm.data.returned_date}
                            onChange={(v) =>
                                returnForm.setData('returned_date', v)
                            }
                        />
                        <InputError message={returnForm.errors.returned_date} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="return_condition">
                            {t('Condition on Return')} {required}
                        </Label>
                        <SelectField
                            id="return_condition"
                            value={returnForm.data.return_condition}
                            onChange={(e) =>
                                returnForm.setData(
                                    'return_condition',
                                    e.target.value,
                                )
                            }
                        >
                            {CONDITIONS.map((c) => (
                                <option key={c} value={c}>
                                    {t(c.charAt(0).toUpperCase() + c.slice(1))}
                                </option>
                            ))}
                        </SelectField>
                        <InputError
                            message={returnForm.errors.return_condition}
                        />
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This assignment record will be permanently deleted."
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

AssetAssignments.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Assets', href: assets.index() },
        { title: 'Assignments', href: asset.assetAssignments.index() },
    ],
};
