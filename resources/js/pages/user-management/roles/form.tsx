import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, KeyRound, Save, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { DocCard } from '@/components/sales-document';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import roles from '@/routes/roles';

type Group = {
    resource: string;
    label: string;
    permissions: { name: string; label: string }[];
};

export default function RoleForm({
    role,
    selected,
    locked = false,
    groups,
}: {
    role: { id: number; name: string } | null;
    selected: string[];
    locked?: boolean;
    groups: Group[];
}) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const form = useForm({ name: role?.name ?? '', permissions: selected });
    const chosen = new Set(form.data.permissions);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();

        return q
            ? groups.filter(
                  (g) =>
                      g.label.toLowerCase().includes(q) ||
                      g.permissions.some((p) => p.name.includes(q)),
              )
            : groups;
    }, [groups, search]);

    const set = (names: string[], on: boolean) => {
        const next = new Set(form.data.permissions);
        names.forEach((n) => (on ? next.add(n) : next.delete(n)));
        form.setData('permissions', [...next]);
    };

    return (
        <>
            <Head title={t(role ? 'Edit Role' : 'Add Role')} />
            <form
                noValidate
                className="flex flex-1 flex-col gap-6 p-4 md:p-6"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (role) {
                        form.put(roles.update(role.id).url);
                    } else {
                        form.post(roles.store().url);
                    }
                }}
            >
                <PageHeader
                    title={role ? 'Edit Role' : 'Add Role'}
                    description="Name the role and choose exactly what it may see and do."
                    action={
                        <div className="flex gap-2">
                            <Button variant="outline" asChild>
                                <Link href={roles.index()}>
                                    <ArrowLeft className="rtl:rotate-180" />{' '}
                                    {t('Back')}
                                </Link>
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                <Save /> {t('Save Role')}
                            </Button>
                        </div>
                    }
                />

                <DocCard icon={ShieldCheck} title="Role Details">
                    <div className="grid items-start gap-4 sm:grid-cols-[1fr_auto]">
                        <div className="grid gap-2">
                            <Label htmlFor="name">
                                {t('Name')}{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="name"
                                value={form.data.name}
                                disabled={locked}
                                placeholder="finance-clerk"
                                onChange={(e) =>
                                    form.setData('name', e.target.value)
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                {t(
                                    locked
                                        ? 'Built-in roles keep their name.'
                                        : 'Lowercase letters, numbers and dashes.',
                                )}
                            </p>
                            <InputError message={form.errors.name} />
                        </div>
                        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-center">
                            <div className="text-2xl font-bold tabular-nums">
                                {chosen.size}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {t('Permissions Selected')}
                            </div>
                        </div>
                    </div>
                    <InputError message={form.errors.permissions} />
                </DocCard>

                <DocCard icon={KeyRound} title="Permissions">
                    <div className="relative mb-4 max-w-sm">
                        <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            className="ps-9"
                            placeholder={t('Search...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {visible.map((group) => {
                            const names = group.permissions.map((p) => p.name);
                            const count = names.filter((n) =>
                                chosen.has(n),
                            ).length;

                            return (
                                <div
                                    key={group.resource}
                                    className="rounded-lg border p-4"
                                >
                                    <label className="mb-3 flex items-center justify-between gap-2 border-b pb-2">
                                        <span className="font-medium">
                                            {t(group.label)}
                                        </span>
                                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {count}/{names.length}
                                            <Checkbox
                                                checked={
                                                    count === names.length
                                                        ? true
                                                        : count > 0
                                                          ? 'indeterminate'
                                                          : false
                                                }
                                                onCheckedChange={(on) =>
                                                    set(names, on === true)
                                                }
                                                aria-label={t('Select all')}
                                            />
                                        </span>
                                    </label>
                                    <div className="grid gap-2">
                                        {group.permissions.map((p) => (
                                            <label
                                                key={p.name}
                                                className="flex items-center gap-2 text-sm"
                                            >
                                                <Checkbox
                                                    checked={chosen.has(p.name)}
                                                    onCheckedChange={(on) =>
                                                        set(
                                                            [p.name],
                                                            on === true,
                                                        )
                                                    }
                                                />
                                                {t(p.label)}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </DocCard>
            </form>
        </>
    );
}

RoleForm.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'User Management', href: roles.index() },
        { title: 'Roles', href: roles.index() },
    ],
};
