import { Head, Link, router, useForm } from '@inertiajs/react';
import { SquarePen, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import { FilterSelect } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import contractTypes from '@/routes/contract-types';
import contracts from '@/routes/contracts';
import type { Paginated, TableFilters } from '@/types';

type ContractType = {
    id: number;
    name: string;
    is_active: boolean;
    contracts_count: number;
    contracts: { id: number; contract_number: string }[];
};

const blank = { name: '', is_active: true };

export default function ContractTypes({
    contractTypes: types,
    filters,
}: {
    contractTypes: Paginated<ContractType>;
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const [editing, setEditing] = useState<ContractType | null>(null);
    const [deleting, setDeleting] = useState<ContractType | null>(null);
    const form = useForm(blank);
    const url = contractTypes.index();
    // The side card adds a type; choosing Edit on a row turns it into that type's editor.
    const canSave = editing
        ? can('edit-contract-types')
        : can('create-contract-types');

    const edit = (type: ContractType | null) => {
        setEditing(type);
        form.clearErrors();
        form.setData(
            type ? { name: type.name, is_active: type.is_active } : blank,
        );
    };

    const columns: Column<ContractType>[] = [
        {
            key: 'name',
            label: 'Name',
            sortable: true,
            render: (type) => (
                <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Tag className="size-4" />
                    </span>
                    <span className="font-medium">{type.name}</span>
                </div>
            ),
        },
        {
            key: 'contracts_count',
            label: 'Contracts',
            sortable: true,
            render: (type) =>
                type.contracts.length === 0 ? (
                    <span className="text-muted-foreground">
                        {t('No contracts')}
                    </span>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {type.contracts.map((c) => (
                            <Link key={c.id} href={contracts.show(c.id)}>
                                <IdBadge>{c.contract_number}</IdBadge>
                            </Link>
                        ))}
                    </div>
                ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (type) => (
                <StatusBadge status={type.is_active ? 'active' : 'inactive'} />
            ),
        },
    ];

    return (
        <>
            <Head title={t('Contract Types')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Contract Types"
                    description="Manage contract types and system setup preferences."
                />

                <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
                    {(can('create-contract-types') || editing) && (
                        <form
                            noValidate
                            className={cn(
                                'rounded-xl border bg-card p-6 shadow-sm lg:sticky lg:top-20',
                                editing && 'ring-2 ring-primary/30',
                            )}
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.submit(
                                    editing
                                        ? contractTypes.update(editing.id)
                                        : contractTypes.store(),
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => edit(null),
                                    },
                                );
                            }}
                        >
                            <h2 className="text-lg font-semibold">
                                {t(
                                    editing
                                        ? 'Edit Contract Type'
                                        : 'Add New Contract Type',
                                )}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t(
                                    editing
                                        ? 'Change the name or switch it off.'
                                        : 'Fill in the details to create a new contract type',
                                )}
                            </p>
                            <div className="mt-6 grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">
                                        {t('Name')}{' '}
                                        <span className="text-destructive">
                                            *
                                        </span>
                                    </Label>
                                    <Input
                                        id="name"
                                        placeholder={t(
                                            'Enter contract type name',
                                        )}
                                        value={form.data.name}
                                        onChange={(e) =>
                                            form.setData('name', e.target.value)
                                        }
                                    />
                                    <InputError message={form.errors.name} />
                                </div>
                                <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
                                    <span>
                                        <span className="block text-sm font-medium">
                                            {t('Active')}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {t(
                                                'Enable or disable this contract type',
                                            )}
                                        </span>
                                    </span>
                                    <Switch
                                        checked={form.data.is_active}
                                        onCheckedChange={(on) =>
                                            form.setData('is_active', on)
                                        }
                                    />
                                </label>
                                <Button
                                    type="submit"
                                    disabled={form.processing || !canSave}
                                >
                                    {t(
                                        editing
                                            ? 'Update Contract Type'
                                            : 'Add Contract Type',
                                    )}
                                </Button>
                                {editing && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => edit(null)}
                                    >
                                        {t('Cancel')}
                                    </Button>
                                )}
                            </div>
                        </form>
                    )}

                    <div className="min-w-0">
                        <DataTable
                            data={types}
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
                            actions={(type) => (
                                <>
                                    {can('edit-contract-types') && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={t('Edit')}
                                            onClick={() => edit(type)}
                                        >
                                            <SquarePen className="text-blue-600" />
                                        </Button>
                                    )}
                                    {can('delete-contract-types') &&
                                        type.contracts_count === 0 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={t('Delete')}
                                                onClick={() =>
                                                    setDeleting(type)
                                                }
                                            >
                                                <Trash2 className="text-destructive" />
                                            </Button>
                                        )}
                                </>
                            )}
                        />
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This contract type will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(contractTypes.destroy(deleting.id), {
                        preserveScroll: true,
                        onFinish: () => {
                            if (editing?.id === deleting.id) {
                                edit(null);
                            }
                            setDeleting(null);
                        },
                    })
                }
            />
        </>
    );
}

ContractTypes.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Contract', href: contracts.index() },
        { title: 'Contract Types', href: contractTypes.index() },
    ],
};
