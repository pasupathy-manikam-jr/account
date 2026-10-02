import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    BookCheck,
    CalendarRange,
    Landmark,
    Plus,
    SquarePen,
    Trash2,
    Package,
    TrendingDown,
    TriangleAlert,
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
import { SummaryCard } from '@/components/summary-card';
import { DateCell, IdBadge } from '@/components/table-cells';
import { StatusTabs } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import asset from '@/routes/asset';
import assets from '@/routes/assets';
import type { Paginated, TableFilters } from '@/types';
import { DepreciationCharts } from './depreciation-charts';

type Schedule = {
    id: number;
    asset_id: number;
    method: string;
    useful_life_years: number;
    salvage_value: string;
    start_date: string;
    posted_amount: string;
    posted_through: string | null;
    cost: string;
    annual: string;
    accumulated: string;
    book_value: string;
    unposted: string;
    status: string;
    asset: { id: number; name: string; serial_code: string };
};

const METHODS: Record<string, string> = {
    straight_line: 'Straight Line',
    declining_balance: 'Declining Balance',
    sum_of_years: 'Sum of Years',
};

const blank = {
    asset_id: '',
    method: 'straight_line',
    useful_life_years: '5',
    salvage_value: '0',
    start_date: '',
};

export default function AssetDepreciationPage({
    schedules,
    counts,
    stats,
    trend,
    assets: unscheduled,
    filters,
}: {
    schedules: Paginated<Schedule>;
    counts: Record<string, number>;
    stats: {
        count: number;
        book_value: string;
        annual: string;
        average_life: number;
        fully_depreciated: number;
    };
    trend: { month: string; monthly: number; accumulated: number }[];
    assets: { id: number; name: string; purchase_date: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const routes = asset.assetDepreciation;
    const url = routes.index();
    const form = useForm(blank);
    const [editing, setEditing] = useState<Schedule | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [posting, setPosting] = useState<Schedule | null>(null);
    const [deleting, setDeleting] = useState<Schedule | null>(null);
    const required = <span className="text-destructive">*</span>;
    const posted = (s: Schedule) => Number(s.posted_amount) > 0;

    const openForm = (schedule: Schedule | null) => {
        setEditing(schedule);
        form.clearErrors();
        form.setData(
            schedule
                ? {
                      asset_id: String(schedule.asset_id),
                      method: schedule.method,
                      useful_life_years: String(schedule.useful_life_years),
                      salvage_value: schedule.salvage_value,
                      start_date: schedule.start_date,
                  }
                : blank,
        );
        setFormOpen(true);
    };

    // Unscheduled assets, plus the one being edited.
    const assetOptions = editing
        ? [
              {
                  id: editing.asset_id,
                  name: `${editing.asset.name} (${editing.asset.serial_code})`,
                  purchase_date: '',
              },
              ...unscheduled,
          ]
        : unscheduled;

    const columns: Column<Schedule>[] = [
        {
            key: 'asset',
            label: 'Asset',
            render: (s) => (
                <div className="max-w-40">
                    <Link
                        href={assets.show(s.asset_id)}
                        className="font-medium hover:underline"
                    >
                        {s.asset.name}
                    </Link>
                    <div>
                        <IdBadge>{s.asset.serial_code}</IdBadge>
                    </div>
                </div>
            ),
        },
        {
            key: 'method',
            label: 'Method',
            render: (s) => (
                <span className="inline-block rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                    {t(METHODS[s.method])}
                </span>
            ),
        },
        {
            key: 'useful_life_years',
            label: 'Useful Life',
            sortable: true,
            render: (s) => (
                <span className="whitespace-nowrap">
                    {t(':count years', { count: s.useful_life_years })}
                </span>
            ),
        },
        {
            key: 'salvage_value',
            label: 'Salvage Value',
            sortable: true,
            render: (s) => (
                <span className="whitespace-nowrap">
                    {money(Number(s.salvage_value))}
                </span>
            ),
        },
        {
            key: 'annual',
            label: 'Annual Depreciation',
            render: (s) => (
                <span className="whitespace-nowrap text-rose-600">
                    {money(Number(s.annual))}
                </span>
            ),
        },
        {
            key: 'accumulated',
            label: 'Accumulated',
            render: (s) => (
                <div className="whitespace-nowrap">
                    <div className="text-orange-600">
                        {money(Number(s.accumulated))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {t('Posted')}: {money(Number(s.posted_amount))}
                    </div>
                </div>
            ),
        },
        {
            key: 'book_value',
            label: 'Book Value',
            render: (s) => (
                <span className="font-semibold whitespace-nowrap text-emerald-600">
                    {money(Number(s.book_value))}
                </span>
            ),
        },
        {
            key: 'start_date',
            label: 'Start Date',
            sortable: true,
            render: (s) => <DateCell value={s.start_date} />,
        },
        {
            key: 'status',
            label: 'Status',
            render: (s) => <StatusBadge status={s.status} />,
        },
    ];

    return (
        <>
            <Head title={t('Depreciation')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Depreciation"
                    description="Track and manage depreciation methods, salvage values, annual depreciation, accumulated depreciation and book values for company assets."
                    action={
                        can('create-asset-depreciation') &&
                        unscheduled.length > 0 && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Schedule')}
                            </Button>
                        )
                    }
                />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <SummaryCard
                        tone="blue"
                        icon={Package}
                        label="Total Assets"
                        value={stats.count}
                        caption="Registered depreciable assets"
                    />
                    <SummaryCard
                        tone="green"
                        icon={Landmark}
                        label="Current Book Value"
                        value={money(Number(stats.book_value))}
                        caption="Net remaining value"
                    />
                    <SummaryCard
                        tone="rose"
                        icon={TrendingDown}
                        label="Annual Depreciation"
                        value={money(Number(stats.annual))}
                        caption="Current fiscal year"
                    />
                    <SummaryCard
                        tone="violet"
                        icon={CalendarRange}
                        label="Average Useful Life"
                        value={t(':count yrs', { count: stats.average_life })}
                        caption="Across all active assets"
                    />
                    <SummaryCard
                        tone="orange"
                        icon={TriangleAlert}
                        label="Fully Depreciated"
                        value={stats.fully_depreciated}
                        caption="Assets reaching end of life"
                    />
                </div>
                <DepreciationCharts
                    trend={trend}
                    total={stats.count}
                    fully={stats.fully_depreciated}
                    methods={Object.entries(METHODS).map(([key, label]) => ({
                        label,
                        count: counts[key] ?? 0,
                    }))}
                />
                <DataTable
                    data={schedules}
                    columns={columns}
                    filters={filters}
                    url={url}
                    tabs={
                        <StatusTabs
                            url={url}
                            filters={filters}
                            counts={counts}
                            name="method"
                        />
                    }
                    renderCard={(d, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <Link
                                        href={assets.show(d.asset_id)}
                                        className="font-semibold hover:underline"
                                    >
                                        {d.asset.name}
                                    </Link>
                                    <div className="mt-1">
                                        <IdBadge>{d.asset.serial_code}</IdBadge>
                                    </div>
                                </div>
                                <StatusBadge status={d.status} />
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">
                                    {t('Book Value')}
                                </div>
                                <div className="text-xl font-bold text-primary">
                                    {money(Number(d.book_value))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Annual Depreciation')}
                                    </div>
                                    <div>{money(Number(d.annual))}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Accumulated')}
                                    </div>
                                    <div>{money(Number(d.accumulated))}</div>
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {t(METHODS[d.method])} ·{' '}
                                {t(':count years', {
                                    count: d.useful_life_years,
                                })}{' '}
                                ·{' '}
                                {t('from :date', { date: date(d.start_date) })}
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                    actions={(s) => (
                        <>
                            {can('edit-asset-depreciation') &&
                                Number(s.unposted) > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('Post to Ledger')}
                                        title={t('Post to Ledger')}
                                        onClick={() => setPosting(s)}
                                    >
                                        <BookCheck className="text-emerald-600" />
                                    </Button>
                                )}
                            {!posted(s) && can('edit-asset-depreciation') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Edit')}
                                    onClick={() => openForm(s)}
                                >
                                    <SquarePen className="text-blue-600" />
                                </Button>
                            )}
                            {!posted(s) && can('delete-asset-depreciation') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Delete')}
                                    onClick={() => setDeleting(s)}
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
                title={editing ? 'Edit Schedule' : 'Add Schedule'}
                description="How the asset's cost, less its salvage value, is spread over its useful life."
                icon={TrendingDown}
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
                            onChange={(e) => {
                                const chosen = unscheduled.find(
                                    (a) => String(a.id) === e.target.value,
                                );
                                form.setData({
                                    ...form.data,
                                    asset_id: e.target.value,
                                    start_date:
                                        form.data.start_date ||
                                        chosen?.purchase_date ||
                                        '',
                                });
                            }}
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
                        <Label htmlFor="method">
                            {t('Method')} {required}
                        </Label>
                        <SelectField
                            id="method"
                            value={form.data.method}
                            onChange={(e) =>
                                form.setData('method', e.target.value)
                            }
                        >
                            {Object.entries(METHODS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {t(label)}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.method} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="useful_life_years">
                            {t('Useful Life (Years)')} {required}
                        </Label>
                        <Input
                            id="useful_life_years"
                            inputMode="numeric"
                            value={form.data.useful_life_years}
                            onChange={(e) =>
                                form.setData(
                                    'useful_life_years',
                                    e.target.value,
                                )
                            }
                        />
                        <InputError message={form.errors.useful_life_years} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="salvage_value">
                            {t('Salvage Value')}
                        </Label>
                        <Input
                            id="salvage_value"
                            inputMode="decimal"
                            value={form.data.salvage_value}
                            onChange={(e) =>
                                form.setData('salvage_value', e.target.value)
                            }
                        />
                        <InputError message={form.errors.salvage_value} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="start_date">
                            {t('Start Date')} {required}
                        </Label>
                        <DatePicker
                            key={`start-${editing?.id}-${form.data.asset_id}`}
                            id="start_date"
                            name="start_date"
                            defaultValue={form.data.start_date}
                            onChange={(v) => form.setData('start_date', v)}
                        />
                        <InputError message={form.errors.start_date} />
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={posting !== null}
                onOpenChange={(o) => !o && setPosting(null)}
                icon={BookCheck}
                title="Post depreciation to the ledger?"
                description={
                    posting
                        ? t(
                              ':amount accrued up to today goes to Depreciation Expense against Accumulated Depreciation.',
                              { amount: money(Number(posting.unposted)) },
                          )
                        : ''
                }
                confirmLabel="Post to Ledger"
                onConfirm={() =>
                    posting &&
                    router.put(
                        routes.post(posting.id),
                        {},
                        {
                            preserveScroll: true,
                            onFinish: () => setPosting(null),
                        },
                    )
                }
            />
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(o) => !o && setDeleting(null)}
                description="This depreciation schedule will be permanently deleted."
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

AssetDepreciationPage.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Assets', href: assets.index() },
        { title: 'Depreciation', href: asset.assetDepreciation.index() },
    ],
};
