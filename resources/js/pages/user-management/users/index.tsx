import { Head, router, useForm } from '@inertiajs/react';
import {
    KeyRound,
    Plus,
    SquarePen,
    Trash2,
    UserCog,
    UserRoundCheck,
    UserRoundX,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import PasswordInput from '@/components/password-input';
import { PersonCell } from '@/components/person-cell';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { DateCell } from '@/components/table-cells';
import { FilterSelect } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import users from '@/routes/users';
import type { Paginated, TableFilters } from '@/types';

type User = {
    id: number;
    name: string;
    email: string;
    mobile_no: string | null;
    type: string;
    is_login_enabled: boolean;
    created_at: string;
    roles: { id: number; name: string }[];
};

const label = (name: string) =>
    name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const blank = {
    name: '',
    email: '',
    mobile_no: '',
    role: 'staff',
    password: '',
};

export default function Users({
    users: list,
    roles,
    staffRoles,
    filters,
}: {
    users: Paginated<User>;
    roles: string[];
    staffRoles: string[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const url = users.index();
    const form = useForm(blank);
    const passwordForm = useForm({ password: '', password_confirmation: '' });
    const [editing, setEditing] = useState<User | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [passwordFor, setPasswordFor] = useState<User | null>(null);
    const [confirm, setConfirm] = useState<{
        user: User;
        action: 'toggle' | 'delete';
    } | null>(null);
    const required = <span className="text-destructive">*</span>;
    const staffOnly = !editing || editing.type === 'staff';

    const openForm = (user: User | null) => {
        setEditing(user);
        form.clearErrors();
        form.setData(
            user
                ? {
                      name: user.name,
                      email: user.email,
                      mobile_no: user.mobile_no ?? '',
                      role: user.roles[0]?.name ?? 'staff',
                      password: '',
                  }
                : blank,
        );
        setFormOpen(true);
    };

    const columns: Column<User>[] = [
        {
            key: 'name',
            label: 'User',
            sortable: true,
            render: (u) => <PersonCell name={u.name} detail={u.email} />,
        },
        {
            key: 'mobile_no',
            label: 'Mobile No',
            render: (u) => u.mobile_no ?? '-',
        },
        {
            key: 'role',
            label: 'Role',
            render: (u) => (
                <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                        <StatusBadge
                            key={r.id}
                            status={r.name}
                            label={t(label(r.name))}
                        />
                    ))}
                </div>
            ),
        },
        {
            key: 'login',
            label: 'Login Status',
            render: (u) => (
                <StatusBadge
                    status={u.is_login_enabled ? 'active' : 'inactive'}
                    label={t(u.is_login_enabled ? 'Enabled' : 'Disabled')}
                />
            ),
        },
        {
            key: 'created_at',
            label: 'Created',
            sortable: true,
            render: (u) => <DateCell value={u.created_at} />,
        },
    ];

    return (
        <>
            <Head title={t('Users')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Users"
                    description="Every login in the system. Add staff here; client and vendor logins come with their customer or vendor record."
                    action={
                        can('create-users') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Staff User')}
                            </Button>
                        )
                    }
                />
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
                                name="role"
                                label="All Roles"
                                options={roles.map((r) => ({
                                    id: r,
                                    name: t(label(r)),
                                }))}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="login"
                                label="All Login Statuses"
                                options={[
                                    { id: 'enabled', name: t('Enabled') },
                                    { id: 'disabled', name: t('Disabled') },
                                ]}
                            />
                        </>
                    }
                    renderCard={(u, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <PersonCell name={u.name} detail={u.email} />
                                <StatusBadge
                                    status={
                                        u.is_login_enabled
                                            ? 'active'
                                            : 'inactive'
                                    }
                                    label={t(
                                        u.is_login_enabled
                                            ? 'Enabled'
                                            : 'Disabled',
                                    )}
                                />
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {u.roles.map((r) => (
                                    <StatusBadge
                                        key={r.id}
                                        status={r.name}
                                        label={t(label(r.name))}
                                    />
                                ))}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {u.mobile_no ?? '-'}
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                    actions={(u) => (
                        <>
                            {can('edit-users') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Edit')}
                                    onClick={() => openForm(u)}
                                >
                                    <SquarePen className="text-blue-600" />
                                </Button>
                            )}
                            {can('change-password-users') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Change Password')}
                                    title={t('Change Password')}
                                    onClick={() => {
                                        passwordForm.reset();
                                        passwordForm.clearErrors();
                                        setPasswordFor(u);
                                    }}
                                >
                                    <KeyRound className="text-violet-600" />
                                </Button>
                            )}
                            {u.type !== 'company' &&
                                can('toggle-status-users') && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t(
                                            u.is_login_enabled
                                                ? 'Disable Login'
                                                : 'Enable Login',
                                        )}
                                        title={t(
                                            u.is_login_enabled
                                                ? 'Disable Login'
                                                : 'Enable Login',
                                        )}
                                        onClick={() =>
                                            setConfirm({
                                                user: u,
                                                action: 'toggle',
                                            })
                                        }
                                    >
                                        {u.is_login_enabled ? (
                                            <UserRoundX className="text-amber-600" />
                                        ) : (
                                            <UserRoundCheck className="text-emerald-600" />
                                        )}
                                    </Button>
                                )}
                            {u.type !== 'company' && can('delete-users') && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Delete')}
                                    onClick={() =>
                                        setConfirm({
                                            user: u,
                                            action: 'delete',
                                        })
                                    }
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
                title={editing ? 'Edit User' : 'Add Staff User'}
                description={
                    editing
                        ? 'Name and contact details. Only staff change role here.'
                        : 'A login for a member of staff. Their sign-in details are emailed to them.'
                }
                icon={UserCog}
                processing={form.processing}
                onSubmit={(e) => {
                    e.preventDefault();
                    form.transform((data) => {
                        const { password, role, ...rest } = data;

                        return {
                            ...rest,
                            ...(staffOnly ? { role } : {}),
                            ...(editing ? {} : { password }),
                        };
                    });
                    form.submit(
                        editing ? users.update(editing.id) : users.store(),
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
                        <Label htmlFor="email">
                            {t('Email')} {required}
                        </Label>
                        <Input
                            id="email"
                            value={form.data.email}
                            onChange={(e) =>
                                form.setData('email', e.target.value)
                            }
                        />
                        <InputError message={form.errors.email} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="mobile_no">{t('Mobile No')}</Label>
                        <Input
                            id="mobile_no"
                            placeholder="+60 12-345 6789"
                            value={form.data.mobile_no}
                            onChange={(e) =>
                                form.setData('mobile_no', e.target.value)
                            }
                        />
                        <InputError message={form.errors.mobile_no} />
                    </div>
                    {staffOnly && (
                        <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="role">
                                {t('Role')} {required}
                            </Label>
                            <SelectField
                                id="role"
                                value={form.data.role}
                                onChange={(e) =>
                                    form.setData('role', e.target.value)
                                }
                            >
                                {staffRoles.map((r) => (
                                    <option key={r} value={r}>
                                        {t(label(r))}
                                    </option>
                                ))}
                            </SelectField>
                            <InputError message={form.errors.role} />
                        </div>
                    )}
                    {!editing && (
                        <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="password">
                                {t('Password')} {required}
                            </Label>
                            <PasswordInput
                                id="password"
                                value={form.data.password}
                                onChange={(e) =>
                                    form.setData('password', e.target.value)
                                }
                            />
                            <InputError message={form.errors.password} />
                        </div>
                    )}
                </div>
            </FormDialog>

            <FormDialog
                open={passwordFor !== null}
                onOpenChange={(open) => !open && setPasswordFor(null)}
                title="Change Password"
                description={
                    passwordFor
                        ? t('Set a new password for :name.', {
                              name: passwordFor.name,
                          })
                        : ''
                }
                icon={KeyRound}
                processing={passwordForm.processing}
                onSubmit={(e) => {
                    e.preventDefault();
                    if (passwordFor) {
                        passwordForm.put(users.password(passwordFor.id).url, {
                            preserveScroll: true,
                            onSuccess: () => setPasswordFor(null),
                        });
                    }
                }}
            >
                <div className="grid gap-4">
                    {(
                        [
                            ['password', 'New Password'],
                            ['password_confirmation', 'Confirm Password'],
                        ] as const
                    ).map(([name, text]) => (
                        <div key={name} className="grid gap-2">
                            <Label htmlFor={name}>
                                {t(text)} {required}
                            </Label>
                            <PasswordInput
                                id={name}
                                value={passwordForm.data[name]}
                                onChange={(e) =>
                                    passwordForm.setData(name, e.target.value)
                                }
                            />
                            <InputError message={passwordForm.errors[name]} />
                        </div>
                    ))}
                </div>
            </FormDialog>

            <ConfirmDialog
                open={confirm?.action === 'toggle'}
                onOpenChange={(open) => !open && setConfirm(null)}
                icon={
                    confirm?.user.is_login_enabled ? UserRoundX : UserRoundCheck
                }
                title={
                    confirm?.user.is_login_enabled
                        ? 'Disable this login?'
                        : 'Enable this login?'
                }
                description={
                    confirm?.user.is_login_enabled
                        ? 'They are signed out and cannot sign in again until you enable it. Their records stay.'
                        : 'They can sign in again with their existing password.'
                }
                confirmLabel={
                    confirm?.user.is_login_enabled
                        ? 'Disable Login'
                        : 'Enable Login'
                }
                onConfirm={() =>
                    confirm &&
                    router.put(
                        users.toggle(confirm.user.id),
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
                description="This user will be permanently deleted. Users with records in the books can only be disabled."
                onConfirm={() =>
                    confirm &&
                    router.delete(users.destroy(confirm.user.id), {
                        preserveScroll: true,
                        onFinish: () => setConfirm(null),
                    })
                }
            />
        </>
    );
}

Users.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'User Management', href: users.index() },
        { title: 'Users', href: users.index() },
    ],
};
