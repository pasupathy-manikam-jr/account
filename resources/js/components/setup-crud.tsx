import { router, useForm } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { Plus, SquarePen, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import type { RouteDefinition } from '@/wayfinder';

type Row = {
    id: number;
    [key: string]: string | number | boolean | null | undefined;
};

export type SetupField = {
    key: string;
    label: string;
    type?: 'text' | 'color' | 'decimal';
};

/**
 * A System Setup tab: a titled table of simple records with add, edit and delete,
 * used where a lookup list (categories, taxes, units) has no screen of its own.
 */
export function SetupCrud<T extends Row>({
    title,
    singular,
    icon,
    rows,
    columns,
    fields,
    permission,
    routes,
    inUse,
}: {
    title: string;
    /** "Category", used for "Add Category" / "Edit Category". */
    singular: string;
    icon: LucideIcon;
    rows: T[];
    columns: { label: string; render: (row: T) => ReactNode }[];
    fields: SetupField[];
    /** Permission suffix, e.g. "product-service-categories". */
    permission: string;
    routes: {
        store: () => RouteDefinition<'post'>;
        update: (id: number) => RouteDefinition<'put'>;
        destroy: (id: number) => RouteDefinition<'delete'>;
    };
    /** Rows that something still uses can't be deleted; the server checks too. */
    inUse: (row: T) => boolean;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const blank = Object.fromEntries(
        fields.map((f) => [f.key, f.type === 'color' ? '#0369a1' : '']),
    ) as Record<string, string>;
    const form = useForm<Record<string, string>>(blank);
    const [editing, setEditing] = useState<T | null>(null);
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState<T | null>(null);

    const openForm = (row: T | null) => {
        setEditing(row);
        form.clearErrors();
        form.setData(
            row
                ? Object.fromEntries(
                      fields.map((f) => [f.key, String(row[f.key] ?? '')]),
                  )
                : blank,
        );
        setOpen(true);
    };

    return (
        <>
            <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">{t(title)}</h2>
                {can(`create-${permission}`) && (
                    <Button onClick={() => openForm(null)}>
                        <Plus /> {t(`Add ${singular}`)}
                    </Button>
                )}
            </div>

            <div className="overflow-hidden rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map((column) => (
                                <TableHead key={column.label}>
                                    {t(column.label)}
                                </TableHead>
                            ))}
                            <TableHead className="text-end">
                                {t('Action')}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length + 1}
                                    className="py-10 text-center text-muted-foreground"
                                >
                                    {t('No records found')}
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow key={row.id}>
                                {columns.map((column) => (
                                    <TableCell key={column.label}>
                                        {column.render(row)}
                                    </TableCell>
                                ))}
                                <TableCell className="text-end whitespace-nowrap">
                                    {can(`edit-${permission}`) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={t('Edit')}
                                            onClick={() => openForm(row)}
                                        >
                                            <SquarePen className="text-blue-600" />
                                        </Button>
                                    )}
                                    {can(`delete-${permission}`) &&
                                        !inUse(row) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={t('Delete')}
                                                onClick={() => setDeleting(row)}
                                            >
                                                <Trash2 className="text-destructive" />
                                            </Button>
                                        )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <FormDialog
                open={open}
                onOpenChange={setOpen}
                title={editing ? `Edit ${singular}` : `Add ${singular}`}
                icon={icon}
                onSubmit={(e) => {
                    e.preventDefault();
                    form.submit(
                        editing ? routes.update(editing.id) : routes.store(),
                        {
                            preserveScroll: true,
                            onSuccess: () => setOpen(false),
                        },
                    );
                }}
                processing={form.processing}
            >
                <div className="grid gap-4">
                    {fields.map((field) => (
                        <div key={field.key} className="grid gap-2">
                            <Label htmlFor={`setup-${field.key}`}>
                                {t(field.label)}{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            {field.type === 'color' ? (
                                <div className="flex items-center gap-3">
                                    <Input
                                        id={`setup-${field.key}`}
                                        type="color"
                                        className="h-10 w-16 cursor-pointer p-1"
                                        value={form.data[field.key]}
                                        onChange={(e) =>
                                            form.setData(
                                                field.key,
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <Input
                                        aria-label={t(field.label)}
                                        className="w-32 font-mono"
                                        value={form.data[field.key]}
                                        onChange={(e) =>
                                            form.setData(
                                                field.key,
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                            ) : (
                                <Input
                                    id={`setup-${field.key}`}
                                    inputMode={
                                        field.type === 'decimal'
                                            ? 'decimal'
                                            : undefined
                                    }
                                    value={form.data[field.key]}
                                    onChange={(e) =>
                                        form.setData(field.key, e.target.value)
                                    }
                                />
                            )}
                            <InputError message={form.errors[field.key]} />
                        </div>
                    ))}
                </div>
            </FormDialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(value) => !value && setDeleting(null)}
                description={`This ${singular.toLowerCase()} will be permanently deleted.`}
                onConfirm={() =>
                    deleting &&
                    router.delete(routes.destroy(deleting.id), {
                        preserveScroll: true,
                        onSuccess: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}
