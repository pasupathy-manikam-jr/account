import { Head, router, useForm } from '@inertiajs/react';
import { FileText, Plus, SquarePen, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { SystemSetupLayout } from '@/components/system-setup-nav';
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

type AccountType = {
    id: number;
    name: string;
    code: string;
    category: string;
    normal_balance: 'debit' | 'credit';
    description: string | null;
    is_active: boolean;
    is_system_type: boolean;
    accounts_count: number;
};

// The side that increases each category; picking a category presets the normal balance.
const CATEGORY_BALANCE: Record<string, AccountType['normal_balance']> = {
    assets: 'debit',
    liabilities: 'credit',
    equity: 'credit',
    revenue: 'credit',
    expenses: 'debit',
};

const blank = {
    name: '',
    code: '',
    category: 'assets',
    normal_balance: 'debit' as AccountType['normal_balance'],
    description: '',
    is_active: true,
};

export default function AccountTypes({
    accountTypes,
    categories,
}: {
    accountTypes: AccountType[];
    categories: string[];
}) {
    const { t } = useTranslation();
    const can = useCan();
    const [editing, setEditing] = useState<AccountType | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<AccountType | null>(null);
    const form = useForm(blank);

    const openForm = (type: AccountType | null) => {
        setEditing(type);
        form.clearErrors();
        form.setData(
            type
                ? {
                      name: type.name,
                      code: type.code,
                      category: type.category,
                      normal_balance: type.normal_balance,
                      description: type.description ?? '',
                      is_active: type.is_active,
                  }
                : blank,
        );
        setFormOpen(true);
    };

    const submit = () =>
        form.submit(
            editing
                ? account.accountTypes.update(editing.id)
                : account.accountTypes.store(),
            { preserveScroll: true, onSuccess: () => setFormOpen(false) },
        );

    return (
        <>
            <Head title={t('Account Types')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="System Setup"
                    description="Manage your accounting system configurations, account types, expense categories, and revenue categories."
                />

                <SystemSetupLayout>
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <h2 className="text-lg font-semibold">
                            {t('Account Types')}
                        </h2>
                        {can('create-account-types') && (
                            <Button onClick={() => openForm(null)}>
                                <Plus /> {t('Add Account Type')}
                            </Button>
                        )}
                    </div>

                    <div className="overflow-hidden rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('Name')}</TableHead>
                                    <TableHead>{t('Code')}</TableHead>
                                    <TableHead>{t('Normal Balance')}</TableHead>
                                    <TableHead>{t('Category Name')}</TableHead>
                                    <TableHead>{t('Is Active')}</TableHead>
                                    <TableHead className="text-end">
                                        {t('Action')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {accountTypes.map((type) => (
                                    <TableRow key={type.id}>
                                        <TableCell className="font-medium">
                                            {type.name}
                                        </TableCell>
                                        <TableCell>{type.code}</TableCell>
                                        <TableCell>
                                            <StatusBadge
                                                status={type.normal_balance}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge
                                                status={type.category}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge
                                                status={
                                                    type.is_active
                                                        ? 'active'
                                                        : 'inactive'
                                                }
                                            />
                                        </TableCell>
                                        <TableCell className="text-end whitespace-nowrap">
                                            {can('edit-account-types') && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={t('Edit')}
                                                    onClick={() =>
                                                        openForm(type)
                                                    }
                                                >
                                                    <SquarePen className="text-blue-600" />
                                                </Button>
                                            )}
                                            {can('delete-account-types') &&
                                                !type.is_system_type &&
                                                type.accounts_count === 0 && (
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
                title={editing ? 'Edit Account Type' : 'Add Account Type'}
                description="Group ledger accounts under a category and a normal balance."
                icon={FileText}
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
                processing={form.processing}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="type-name">
                            {t('Name')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="type-name"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="type-code">
                            {t('Code')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="type-code"
                            value={form.data.code}
                            onChange={(e) =>
                                form.setData('code', e.target.value)
                            }
                        />
                        <InputError message={form.errors.code} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="type-category">
                            {t('Category')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <SelectField
                            id="type-category"
                            value={form.data.category}
                            onChange={(e) =>
                                form.setData({
                                    ...form.data,
                                    category: e.target.value,
                                    normal_balance:
                                        CATEGORY_BALANCE[e.target.value] ??
                                        form.data.normal_balance,
                                })
                            }
                        >
                            {categories.map((category) => (
                                <option key={category} value={category}>
                                    {t(
                                        category.charAt(0).toUpperCase() +
                                            category.slice(1),
                                    )}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={form.errors.category} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="type-balance">
                            {t('Normal Balance')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <SelectField
                            id="type-balance"
                            value={form.data.normal_balance}
                            onChange={(e) =>
                                form.setData(
                                    'normal_balance',
                                    e.target
                                        .value as AccountType['normal_balance'],
                                )
                            }
                        >
                            <option value="debit">{t('Debit')}</option>
                            <option value="credit">{t('Credit')}</option>
                        </SelectField>
                        <InputError message={form.errors.normal_balance} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="type-description">
                            {t('Description')}
                        </Label>
                        <Textarea
                            id="type-description"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                        />
                        <InputError message={form.errors.description} />
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch
                            id="type-active"
                            checked={form.data.is_active}
                            onCheckedChange={(checked) =>
                                form.setData('is_active', checked)
                            }
                        />
                        <Label htmlFor="type-active">{t('Is Active')}</Label>
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This account type will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(account.accountTypes.destroy(deleting.id), {
                        preserveScroll: true,
                        onSuccess: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

AccountTypes.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.chartOfAccounts.index() },
        { title: 'System Setup', href: account.accountTypes.index() },
        { title: 'Account Types', href: account.accountTypes.index() },
    ],
};
