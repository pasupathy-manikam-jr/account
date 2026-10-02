import { Head, router, useForm } from '@inertiajs/react';
import { Plus, SquarePen, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { SystemSetupLayout } from '@/components/system-setup-nav';
import { IdBadge } from '@/components/table-cells';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import account from '@/routes/account';

type Kind = 'revenue' | 'expense';

type Category = {
    id: number;
    category_name: string;
    category_code: string;
    gl_account_id: number;
    description: string | null;
    is_active: boolean;
    entries_count: number;
    gl_account: { id: number; account_code: string; account_name: string };
};

const blank = {
    category_name: '',
    category_code: '',
    gl_account_id: '',
    description: '',
    is_active: true,
};

export default function TransactionCategories({
    kind,
    categories,
    glAccounts,
}: {
    kind: Kind;
    categories: Category[];
    glAccounts: { id: number; account_code: string; account_name: string }[];
}) {
    const { t } = useTranslation();
    const can = useCan();
    const routes =
        kind === 'revenue'
            ? account.revenueCategories
            : account.expenseCategories;
    const perm =
        kind === 'revenue' ? 'revenue-categories' : 'expense-categories';
    const title =
        kind === 'revenue' ? 'Revenue Categories' : 'Expense Categories';
    const [editing, setEditing] = useState<Category | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Category | null>(null);
    const form = useForm(blank);
    const required = <span className="text-destructive">*</span>;

    const openForm = (category: Category | null) => {
        setEditing(category);
        form.clearErrors();
        form.setData(
            category
                ? {
                      category_name: category.category_name,
                      category_code: category.category_code,
                      gl_account_id: String(category.gl_account_id),
                      description: category.description ?? '',
                      is_active: category.is_active,
                  }
                : blank,
        );
        setFormOpen(true);
    };

    return (
        <>
            <Head title={t(title)} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="System Setup"
                    description="Manage your accounting system configurations, account types, expense categories, and revenue categories."
                />
                <SystemSetupLayout>
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <h2 className="text-lg font-semibold">{t(title)}</h2>
                        {can(`create-${perm}`) && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Category')}
                            </Button>
                        )}
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('Category Name')}</TableHead>
                                    <TableHead>{t('Category Code')}</TableHead>
                                    <TableHead>{t('GL Account')}</TableHead>
                                    <TableHead>{t('Description')}</TableHead>
                                    <TableHead>{t('Is Active')}</TableHead>
                                    <TableHead className="text-end">
                                        {t('Action')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="py-10 text-center text-muted-foreground"
                                        >
                                            {t('No records found')}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {categories.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell>
                                            <div className="font-medium">
                                                {c.category_name}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <IdBadge>{c.category_code}</IdBadge>
                                        </TableCell>
                                        <TableCell>
                                            {c.gl_account.account_code} -{' '}
                                            {c.gl_account.account_name}
                                        </TableCell>
                                        <TableCell className="max-w-44 text-muted-foreground">
                                            {c.description ?? '-'}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge
                                                status={
                                                    c.is_active
                                                        ? 'active'
                                                        : 'inactive'
                                                }
                                            />
                                        </TableCell>
                                        <TableCell className="text-end whitespace-nowrap">
                                            {can(`edit-${perm}`) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={t('Edit')}
                                                    onClick={() => openForm(c)}
                                                >
                                                    <SquarePen className="text-blue-600" />
                                                </Button>
                                            )}
                                            {can(`delete-${perm}`) &&
                                                c.entries_count === 0 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={t('Delete')}
                                                        onClick={() =>
                                                            setDeleting(c)
                                                        }
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
                </SystemSetupLayout>
            </div>

            <FormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                title={editing ? 'Edit Category' : 'Add Category'}
                description={
                    kind === 'revenue'
                        ? 'Group revenue and choose the account it is credited to.'
                        : 'Group expenses and choose the account they are charged to.'
                }
                icon={Tag}
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
                    <div className="grid gap-2">
                        <Label htmlFor="category_name">
                            {t('Category Name')} {required}
                        </Label>
                        <Input
                            id="category_name"
                            value={form.data.category_name}
                            onChange={(e) =>
                                form.setData('category_name', e.target.value)
                            }
                        />
                        <InputError message={form.errors.category_name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="category_code">
                            {t('Code')} {required}
                        </Label>
                        <Input
                            id="category_code"
                            value={form.data.category_code}
                            onChange={(e) =>
                                form.setData('category_code', e.target.value)
                            }
                        />
                        <InputError message={form.errors.category_code} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="gl_account_id">
                            {t('GL Account')} {required}
                        </Label>
                        <SelectField
                            id="gl_account_id"
                            value={form.data.gl_account_id}
                            placeholder={t('Select GL Account')}
                            onChange={(e) =>
                                form.setData('gl_account_id', e.target.value)
                            }
                        >
                            {glAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.account_code} - {a.account_name}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.gl_account_id} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="description">{t('Description')}</Label>
                        <Textarea
                            id="description"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                        />
                        <InputError message={form.errors.description} />
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch
                            id="is_active"
                            checked={form.data.is_active}
                            onCheckedChange={(checked) =>
                                form.setData('is_active', checked)
                            }
                        />
                        <Label htmlFor="is_active">{t('Is Active')}</Label>
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This category will be permanently deleted."
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

TransactionCategories.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.chartOfAccounts.index() },
        { title: 'System Setup', href: account.accountTypes.index() },
    ],
};
