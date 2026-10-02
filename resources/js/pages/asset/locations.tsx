import { Head, router, useForm } from '@inertiajs/react';
import { MapPin, Plus, SquarePen, Trash2 } from 'lucide-react';
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
import { StatusTabs } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import asset from '@/routes/asset';
import assets from '@/routes/assets';
import type { Paginated, TableFilters } from '@/types';

type Location = {
    id: number;
    name: string;
    code: string;
    type: string;
    parent_id: number | null;
    is_active: boolean;
    assets_count: number;
    children_count: number;
    parent: { id: number; name: string } | null;
};

const TYPES: Record<string, string> = {
    building: 'Building',
    floor: 'Floor',
    room: 'Room',
    warehouse: 'Warehouse',
    site: 'Site',
};

const blank = { name: '', code: '', type: '', parent_id: '', is_active: true };

export default function AssetLocations({
    locations,
    counts,
    parents,
    filters,
}: {
    locations: Paginated<Location>;
    counts: Record<string, number>;
    parents: { id: number; name: string; type: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const routes = asset.assetLocations;
    const url = routes.index();
    const form = useForm(blank);
    const [editing, setEditing] = useState<Location | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Location | null>(null);
    const required = <span className="text-destructive">*</span>;

    const openForm = (location: Location | null) => {
        setEditing(location);
        form.clearErrors();
        form.setData(
            location
                ? {
                      name: location.name,
                      code: location.code,
                      type: location.type,
                      parent_id: location.parent_id
                          ? String(location.parent_id)
                          : '',
                      is_active: location.is_active,
                  }
                : blank,
        );
        setFormOpen(true);
    };

    const columns: Column<Location>[] = [
        {
            key: 'name',
            label: 'Name',
            sortable: true,
            render: (l) => (
                <div>
                    <div className="font-medium">{l.name}</div>
                    <IdBadge>{l.code}</IdBadge>
                </div>
            ),
        },
        { key: 'type', label: 'Type', render: (l) => t(TYPES[l.type]) },
        {
            key: 'parent',
            label: 'Parent Location',
            render: (l) => l.parent?.name ?? '-',
        },
        { key: 'assets', label: 'Assets', render: (l) => l.assets_count },
        {
            key: 'status',
            label: 'Status',
            render: (l) => (
                <StatusBadge status={l.is_active ? 'active' : 'inactive'} />
            ),
        },
    ];

    return (
        <>
            <Head title={t('Locations')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Locations"
                    description="Organize different asset locations within your company, from buildings and floors to individual rooms."
                    action={
                        can('create-asset-locations') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Location')}
                            </Button>
                        )
                    }
                />
                <DataTable
                    data={locations}
                    columns={columns}
                    filters={filters}
                    url={url}
                    tabs={
                        <StatusTabs
                            url={url}
                            filters={filters}
                            counts={counts}
                            name="type"
                        />
                    }
                    renderCard={(l, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <MapPin className="size-5" />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="truncate font-semibold">
                                            {l.name}
                                        </div>
                                        <IdBadge>{l.code}</IdBadge>
                                    </div>
                                </div>
                                <StatusBadge
                                    status={l.is_active ? 'active' : 'inactive'}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Type')}
                                    </div>
                                    <div>{t(TYPES[l.type])}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Assets')}
                                    </div>
                                    <div>{l.assets_count}</div>
                                </div>
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                                {t('Parent Location')}: {l.parent?.name ?? '-'}
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                    actions={(l) => (
                        <>
                            {can('edit-asset-locations') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Edit')}
                                    onClick={() => openForm(l)}
                                >
                                    <SquarePen className="text-blue-600" />
                                </Button>
                            )}
                            {can('delete-asset-locations') &&
                                l.assets_count + l.children_count === 0 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('Delete')}
                                        onClick={() => setDeleting(l)}
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
                title={editing ? 'Edit Location' : 'Add Location'}
                description="Where assets are kept: a building, a floor in it, a room on that floor."
                icon={MapPin}
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
                        <Label htmlFor="name">
                            {t('Name')} {required}
                        </Label>
                        <Input
                            id="name"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="code">
                            {t('Code')} {required}
                        </Label>
                        <Input
                            id="code"
                            value={form.data.code}
                            onChange={(e) =>
                                form.setData('code', e.target.value)
                            }
                        />
                        <InputError message={form.errors.code} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="type">
                            {t('Type')} {required}
                        </Label>
                        <SelectField
                            id="type"
                            value={form.data.type}
                            placeholder={t('Select Type')}
                            onChange={(e) =>
                                form.setData('type', e.target.value)
                            }
                        >
                            {Object.entries(TYPES).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {t(label)}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.type} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="parent_id">
                            {t('Parent Location')}
                        </Label>
                        <SelectField
                            id="parent_id"
                            value={form.data.parent_id}
                            placeholder={t('None')}
                            onChange={(e) =>
                                form.setData('parent_id', e.target.value)
                            }
                        >
                            {parents
                                .filter((p) => p.id !== editing?.id)
                                .map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({t(TYPES[p.type])})
                                    </option>
                                ))}
                        </SelectField>
                        <InputError message={form.errors.parent_id} />
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                        <Switch
                            id="is_active"
                            checked={form.data.is_active}
                            onCheckedChange={(on) =>
                                form.setData('is_active', on)
                            }
                        />
                        <Label htmlFor="is_active">{t('Active')}</Label>
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This location will be permanently deleted."
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

AssetLocations.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Assets', href: assets.index() },
        { title: 'Locations', href: asset.assetLocations.index() },
    ],
};
