import { router, useForm } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { Search, SquarePen, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import { SelectField } from '@/components/select-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import type { RouteDefinition } from '@/wayfinder';

type Value = string | number | boolean | null;
type Row = { id: number; [key: string]: Value | undefined | object };

/** A row value as plain text (strings and numbers only; anything else reads as empty). */
const text = (value: unknown) =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export type InlineField = {
    key: string;
    label: string;
    type?: 'text' | 'textarea' | 'switch';
    required?: boolean;
    placeholder?: string;
    /** Shown under a switch. */
    hint?: string;
};

export type InlineColumn<T> = {
    label: string;
    className?: string;
    render: (row: T) => ReactNode;
};

/**
 * The demo's "Add New …" layout for short lookup lists: an inline form card on the left (which becomes the
 * editor when a row's Edit is clicked) and a searchable table on the right. The whole list is on the page,
 * so search and the status filter work in the browser.
 */
export function InlineCrud<T extends Row>({
    singular,
    rows,
    fields,
    columns,
    icon: Icon,
    permission,
    routes,
    searchKeys,
    statusKey,
    inUse,
}: {
    /** "Category": the form reads "Add New Category" / "Edit Category". */
    singular: string;
    rows: T[];
    fields: InlineField[];
    columns: InlineColumn<T>[];
    icon: LucideIcon;
    /** Permission suffix: create-{permission}, edit-…, delete-…. */
    permission: string;
    routes: {
        store: () => RouteDefinition<'post'>;
        update: (id: number) => RouteDefinition<'put'>;
        destroy: (id: number) => RouteDefinition<'delete'>;
    };
    searchKeys: string[];
    /** A boolean column that drives an "All Statuses / Active / Inactive" filter. */
    statusKey?: string;
    /** Rows still in use can't be deleted. */
    inUse?: (row: T) => boolean;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const blank = Object.fromEntries(
        fields.map((f) => [f.key, f.type === 'switch' ? true : '']),
    ) as Record<string, string | boolean>;
    const form = useForm(blank);
    const [editing, setEditing] = useState<T | null>(null);
    const [deleting, setDeleting] = useState<T | null>(null);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const canSave = editing
        ? can(`edit-${permission}`)
        : can(`create-${permission}`);

    const edit = (row: T | null) => {
        setEditing(row);
        form.clearErrors();
        form.setData(
            row
                ? (Object.fromEntries(
                      fields.map((f) => [
                          f.key,
                          f.type === 'switch'
                              ? Boolean(row[f.key])
                              : text(row[f.key]),
                      ]),
                  ) as Record<string, string | boolean>)
                : blank,
        );
    };

    const query = search.trim().toLowerCase();
    const shown = rows.filter(
        (row) =>
            (!query ||
                searchKeys.some((k) =>
                    text(row[k]).toLowerCase().includes(query),
                )) &&
            (!statusKey ||
                !status ||
                Boolean(row[statusKey]) === (status === 'active')),
    );

    return (
        <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
            {(can(`create-${permission}`) || editing) && (
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
                                ? routes.update(editing.id)
                                : routes.store(),
                            {
                                preserveScroll: true,
                                onSuccess: () => edit(null),
                            },
                        );
                    }}
                >
                    <h2 className="text-lg font-semibold">
                        {editing
                            ? t('Edit :item', { item: t(singular) })
                            : t('Add New :item', { item: t(singular) })}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {editing
                            ? t('Change the details and save.')
                            : t('Fill in the details to create a new :item', {
                                  item: t(singular).toLowerCase(),
                              })}
                    </p>
                    <div className="mt-6 grid gap-4">
                        {fields.map((f) =>
                            f.type === 'switch' ? (
                                <label
                                    key={f.key}
                                    className="flex items-center justify-between gap-4 rounded-lg border p-3"
                                >
                                    <span>
                                        <span className="block text-sm font-medium">
                                            {t(f.label)}
                                        </span>
                                        {f.hint && (
                                            <span className="block text-xs text-muted-foreground">
                                                {t(f.hint)}
                                            </span>
                                        )}
                                    </span>
                                    <Switch
                                        checked={Boolean(form.data[f.key])}
                                        onCheckedChange={(on) =>
                                            form.setData(f.key, on)
                                        }
                                    />
                                </label>
                            ) : (
                                <div key={f.key} className="grid gap-2">
                                    <Label htmlFor={f.key}>
                                        {t(f.label)}{' '}
                                        {f.required && (
                                            <span className="text-destructive">
                                                *
                                            </span>
                                        )}
                                    </Label>
                                    {f.type === 'textarea' ? (
                                        <Textarea
                                            id={f.key}
                                            placeholder={
                                                f.placeholder &&
                                                t(f.placeholder)
                                            }
                                            value={String(
                                                form.data[f.key] ?? '',
                                            )}
                                            onChange={(e) =>
                                                form.setData(
                                                    f.key,
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    ) : (
                                        <Input
                                            id={f.key}
                                            placeholder={
                                                f.placeholder &&
                                                t(f.placeholder)
                                            }
                                            value={String(
                                                form.data[f.key] ?? '',
                                            )}
                                            onChange={(e) =>
                                                form.setData(
                                                    f.key,
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    )}
                                    <InputError message={form.errors[f.key]} />
                                </div>
                            ),
                        )}
                        <Button
                            type="submit"
                            disabled={form.processing || !canSave}
                        >
                            {editing
                                ? t('Update :item', { item: t(singular) })
                                : t('Add :item', { item: t(singular) })}
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

            <div className="grid min-w-0 gap-4">
                <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
                    <div className="relative max-w-xs flex-1">
                        <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            className="ps-9"
                            placeholder={t('Search...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {statusKey && (
                        <SelectField
                            aria-label={t('All Statuses')}
                            className="ms-auto w-auto min-w-40"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <option value="">{t('All Statuses')}</option>
                            <option value="active">{t('Active')}</option>
                            <option value="inactive">{t('Inactive')}</option>
                        </SelectField>
                    )}
                </div>
                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="max-h-[calc(100dvh-16rem)] overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-muted text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
                                <tr>
                                    {columns.map((c) => (
                                        <th
                                            key={c.label}
                                            className={cn(
                                                'px-4 py-3 text-start font-medium',
                                                c.className,
                                            )}
                                        >
                                            {t(c.label)}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-end font-medium">
                                        {t('Actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {shown.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={columns.length + 1}
                                            className="px-4 py-12 text-center text-muted-foreground"
                                        >
                                            {t('No records found')}
                                        </td>
                                    </tr>
                                )}
                                {shown.map((row) => (
                                    <tr
                                        key={row.id}
                                        className={cn(
                                            'hover:bg-muted/30',
                                            editing?.id === row.id &&
                                                'bg-primary/5',
                                        )}
                                    >
                                        {columns.map((c, ci) => (
                                            <td
                                                key={c.label}
                                                className={cn(
                                                    'px-4 py-3',
                                                    c.className,
                                                )}
                                            >
                                                {ci === 0 ? (
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                            <Icon className="size-4" />
                                                        </span>
                                                        <div className="min-w-0">
                                                            {c.render(row)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    c.render(row)
                                                )}
                                            </td>
                                        ))}
                                        <td className="px-4 py-2 text-end whitespace-nowrap">
                                            {can(`edit-${permission}`) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={t('Edit')}
                                                    onClick={() => edit(row)}
                                                >
                                                    <SquarePen className="text-blue-600" />
                                                </Button>
                                            )}
                                            {can(`delete-${permission}`) &&
                                                !inUse?.(row) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={t('Delete')}
                                                        onClick={() =>
                                                            setDeleting(row)
                                                        }
                                                    >
                                                        <Trash2 className="text-destructive" />
                                                    </Button>
                                                )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This record will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(routes.destroy(deleting.id), {
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
        </div>
    );
}
