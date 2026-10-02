import { Head, Link, router } from '@inertiajs/react';
import { Lock, Plus, ShieldCheck, SquarePen, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { IdBadge } from '@/components/table-cells';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import roles from '@/routes/roles';
import type { Paginated, TableFilters } from '@/types';

type Role = {
    id: number;
    name: string;
    permissions_count: number;
    users_count: number;
};

const label = (name: string) =>
    name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Roles({
    roles: list,
    builtIn,
    filters,
}: {
    roles: Paginated<Role>;
    builtIn: string[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const [deleting, setDeleting] = useState<Role | null>(null);

    const columns: Column<Role>[] = [
        {
            key: 'name',
            label: 'Role',
            sortable: true,
            render: (r) => (
                <div className="flex items-center gap-2">
                    <span className="font-medium">{t(label(r.name))}</span>
                    <IdBadge>{r.name}</IdBadge>
                    {builtIn.includes(r.name) && (
                        <span className="text-xs text-muted-foreground">
                            {t('Built-in')}
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'permissions',
            label: 'Permissions',
            render: (r) =>
                r.name === 'company'
                    ? t('All permissions')
                    : t(':count permissions', { count: r.permissions_count }),
        },
        {
            key: 'users',
            label: 'Users',
            render: (r) => r.users_count,
        },
    ];

    return (
        <>
            <Head title={t('Roles')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Roles"
                    description="Manage roles and set permissions for users across the system."
                    action={
                        can('create-roles') && (
                            <Button asChild>
                                <Link href={roles.create()}>
                                    <Plus /> {t('Add Role')}
                                </Link>
                            </Button>
                        )
                    }
                />
                <DataTable
                    data={list}
                    columns={columns}
                    filters={filters}
                    url={roles.index()}
                    renderCard={(r, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <ShieldCheck className="size-5" />
                                    </span>
                                    <div>
                                        <div className="font-semibold">
                                            {t(label(r.name))}
                                        </div>
                                        <IdBadge>{r.name}</IdBadge>
                                    </div>
                                </div>
                                {builtIn.includes(r.name) && (
                                    <span className="text-xs text-muted-foreground">
                                        {t('Built-in')}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Permissions')}
                                    </div>
                                    <div className="font-semibold">
                                        {r.name === 'company'
                                            ? t('All permissions')
                                            : r.permissions_count}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Users')}
                                    </div>
                                    <div className="font-semibold">
                                        {r.users_count}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                    actions={(r) =>
                        r.name === 'company' ? (
                            <span
                                className="inline-flex size-9 items-center justify-center text-muted-foreground"
                                title={t(
                                    'The company role always has every permission.',
                                )}
                            >
                                <Lock className="size-4" />
                            </span>
                        ) : (
                            <>
                                {can('edit-roles') && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('Edit')}
                                        asChild
                                    >
                                        <Link href={roles.edit(r.id)}>
                                            <SquarePen className="text-blue-600" />
                                        </Link>
                                    </Button>
                                )}
                                {can('delete-roles') &&
                                    !builtIn.includes(r.name) &&
                                    r.users_count === 0 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={t('Delete')}
                                            onClick={() => setDeleting(r)}
                                        >
                                            <Trash2 className="text-destructive" />
                                        </Button>
                                    )}
                            </>
                        )
                    }
                />
            </div>
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This role will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(roles.destroy(deleting.id), {
                        preserveScroll: true,
                        onFinish: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

Roles.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'User Management', href: roles.index() },
        { title: 'Roles', href: roles.index() },
    ],
};
