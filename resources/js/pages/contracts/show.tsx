import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    DollarSign,
    Download,
    FileSignature,
    FileText,
    Hash,
    MessageSquare,
    NotebookPen,
    Paperclip,
    PenLine,
    Plus,
    RefreshCw,
    SquarePen,
    Trash2,
    User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import DatePicker from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PersonCell } from '@/components/person-cell';
import { DocCard, Fact } from '@/components/sales-document';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import contracts from '@/routes/contracts';
import { ContractFormDialog } from './contract-form';
import { contractTerm, statusLabel } from './types';
import type { Contract, Party } from './types';

type Person = { id: number; name: string; email?: string };
type Note = {
    id: number;
    type: 'comment' | 'note';
    body: string;
    is_edited: boolean;
    user_id: number | null;
    user: Person | null;
    created_at: string;
};
type Attachment = {
    id: number;
    file_name: string;
    file_size: number;
    uploaded_by: number | null;
    uploader: Person | null;
    created_at: string;
};
type Renewal = {
    id: number;
    start_date: string;
    end_date: string;
    value: string;
    notes: string | null;
    status: string;
    created_by: number | null;
};
type Signature = {
    id: number;
    user_id: number;
    signer_name: string;
    signature_data: string;
    signed_at: string;
};

type FullContract = Contract & {
    created_by: number | null;
    attachments: Attachment[];
    comments: Note[];
    notes: Note[];
    renewals: Renewal[];
    signatures: Signature[];
};

type Tab = 'details' | 'attachments' | 'comments' | 'notes' | 'renewals';

const RENEWAL_STATUSES = [
    'draft',
    'pending',
    'approved',
    'active',
    'expired',
    'cancelled',
];
const ucfirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Comments (shared) and notes (internal) look the same: a composer and a list with edit/delete. */
function NoteThread({
    contract,
    type,
    items,
}: {
    contract: FullContract;
    type: 'comment' | 'note';
    items: Note[];
}) {
    const { t } = useTranslation();
    const { dateTime } = useFormat();
    const can = useCan();
    const { auth } = usePage().props;
    const plural = `${type}s`;
    const form = useForm({ body: '' });
    const [editing, setEditing] = useState<Note | null>(null);
    const [deleting, setDeleting] = useState<Note | null>(null);
    const edit = useForm({ body: '' });
    const mayChange = (note: Note) =>
        can(`manage-any-contract-${plural}`) || note.user_id === auth.user.id;

    return (
        <DocCard
            icon={type === 'comment' ? MessageSquare : NotebookPen}
            title={type === 'comment' ? 'Comments' : 'Notes'}
        >
            {can(`create-contract-${plural}`) && (
                <form
                    noValidate
                    className="mb-6 grid gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(
                            contracts.notes.store({
                                contract: contract.id,
                                type,
                            }).url,
                            {
                                preserveScroll: true,
                                onSuccess: () => form.reset(),
                            },
                        );
                    }}
                >
                    <Textarea
                        aria-label={t(
                            type === 'comment' ? 'Add a comment' : 'Add a note',
                        )}
                        placeholder={t(
                            type === 'comment'
                                ? 'Add a comment...'
                                : 'Add a note...',
                        )}
                        value={form.data.body}
                        onChange={(e) => form.setData('body', e.target.value)}
                    />
                    <InputError message={form.errors.body} />
                    <Button
                        type="submit"
                        className="justify-self-end"
                        disabled={form.processing}
                    >
                        {form.processing && <Spinner />}
                        {t(type === 'comment' ? 'Add Comment' : 'Add Note')}
                    </Button>
                </form>
            )}
            {items.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                    {t(
                        type === 'comment'
                            ? 'No comments yet.'
                            : 'No notes yet.',
                    )}
                </p>
            ) : (
                <ul className="grid gap-3">
                    {items.map((note) => (
                        <li key={note.id} className="rounded-lg border p-4">
                            <div className="flex items-start justify-between gap-3">
                                <PersonCell
                                    name={note.user?.name ?? t('Unknown')}
                                    detail={
                                        dateTime(note.created_at) +
                                        (note.is_edited
                                            ? ` · ${t('edited')}`
                                            : '')
                                    }
                                />
                                <div className="flex gap-1">
                                    {can(`edit-contract-${plural}`) &&
                                        mayChange(note) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={t('Edit')}
                                                onClick={() => {
                                                    edit.setData(
                                                        'body',
                                                        note.body,
                                                    );
                                                    edit.clearErrors();
                                                    setEditing(note);
                                                }}
                                            >
                                                <SquarePen className="text-blue-600" />
                                            </Button>
                                        )}
                                    {can(`delete-contract-${plural}`) &&
                                        mayChange(note) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={t('Delete')}
                                                onClick={() =>
                                                    setDeleting(note)
                                                }
                                            >
                                                <Trash2 className="text-destructive" />
                                            </Button>
                                        )}
                                </div>
                            </div>
                            <p className="mt-3 text-sm whitespace-pre-line">
                                {note.body}
                            </p>
                        </li>
                    ))}
                </ul>
            )}

            <FormDialog
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
                title={type === 'comment' ? 'Edit Comment' : 'Edit Note'}
                icon={type === 'comment' ? MessageSquare : NotebookPen}
                processing={edit.processing}
                onSubmit={(e) => {
                    e.preventDefault();
                    if (editing) {
                        edit.put(
                            contracts.notes.update({
                                contract: contract.id,
                                note: editing.id,
                            }).url,
                            {
                                preserveScroll: true,
                                onSuccess: () => setEditing(null),
                            },
                        );
                    }
                }}
            >
                <Textarea
                    aria-label={t(type === 'comment' ? 'Comment' : 'Note')}
                    rows={4}
                    value={edit.data.body}
                    onChange={(e) => edit.setData('body', e.target.value)}
                />
                <InputError message={edit.errors.body} />
            </FormDialog>
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description={
                    type === 'comment'
                        ? 'This comment will be permanently deleted.'
                        : 'This note will be permanently deleted.'
                }
                onConfirm={() =>
                    deleting &&
                    router.delete(
                        contracts.notes.destroy({
                            contract: contract.id,
                            note: deleting.id,
                        }),
                        {
                            preserveScroll: true,
                            onSuccess: () => setDeleting(null),
                        },
                    )
                }
            />
        </DocCard>
    );
}

function Attachments({ contract }: { contract: FullContract }) {
    const { t } = useTranslation();
    const { date } = useFormat();
    const can = useCan();
    const { auth } = usePage().props;
    const form = useForm<{ file: File | null }>({ file: null });
    const [deleting, setDeleting] = useState<Attachment | null>(null);

    return (
        <DocCard icon={Paperclip} title="Attachments">
            {can('create-contract-attachments') && (
                <form
                    noValidate
                    className="mb-6 grid gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(
                            contracts.attachments.store(contract.id).url,
                            {
                                preserveScroll: true,
                                forceFormData: true,
                                onSuccess: () => form.reset(),
                            },
                        );
                    }}
                >
                    <div className="flex flex-wrap gap-2">
                        <Input
                            type="file"
                            aria-label={t('File')}
                            className="max-w-sm"
                            onChange={(e) =>
                                form.setData(
                                    'file',
                                    e.target.files?.[0] ?? null,
                                )
                            }
                        />
                        <Button
                            type="submit"
                            disabled={form.processing || !form.data.file}
                        >
                            {form.processing && <Spinner />}
                            {t('Upload')}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t(
                            'PDF, Office documents, images or ZIP, up to 10 MB.',
                        )}
                    </p>
                    <InputError message={form.errors.file} />
                </form>
            )}
            {contract.attachments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                    {t('No attachments yet.')}
                </p>
            ) : (
                <ul className="grid gap-2">
                    {contract.attachments.map((file) => (
                        <li
                            key={file.id}
                            className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <FileText className="size-4" />
                                </span>
                                <div className="min-w-0">
                                    <div className="truncate font-medium">
                                        {file.file_name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {(file.file_size / 1024).toFixed(0)} KB
                                        · {file.uploader?.name ?? '-'} ·{' '}
                                        {date(file.created_at)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Download')}
                                    asChild
                                >
                                    <a
                                        href={
                                            contracts.attachments.download({
                                                contract: contract.id,
                                                attachment: file.id,
                                            }).url
                                        }
                                    >
                                        <Download className="text-sky-600" />
                                    </a>
                                </Button>
                                {can('delete-contract-attachments') &&
                                    (can('manage-any-contract-attachments') ||
                                        file.uploaded_by === auth.user.id) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={t('Delete')}
                                            onClick={() => setDeleting(file)}
                                        >
                                            <Trash2 className="text-destructive" />
                                        </Button>
                                    )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This attachment will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(
                        contracts.attachments.destroy({
                            contract: contract.id,
                            attachment: deleting.id,
                        }),
                        {
                            preserveScroll: true,
                            onSuccess: () => setDeleting(null),
                        },
                    )
                }
            />
        </DocCard>
    );
}

function Renewals({ contract }: { contract: FullContract }) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const { auth } = usePage().props;
    const [editing, setEditing] = useState<Renewal | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<Renewal | null>(null);
    const blank = {
        start_date: '',
        end_date: '',
        value: '',
        status: 'draft',
        notes: '',
    };
    const form = useForm(blank);
    const mayChange = (r: Renewal) =>
        can('manage-any-contract-renewals') || r.created_by === auth.user.id;

    const open = (renewal: Renewal | null) => {
        setEditing(renewal);
        form.clearErrors();
        form.setData(
            renewal
                ? {
                      start_date: renewal.start_date,
                      end_date: renewal.end_date,
                      value: renewal.value,
                      status: renewal.status,
                      notes: renewal.notes ?? '',
                  }
                : blank,
        );
        setFormOpen(true);
    };

    return (
        <DocCard
            icon={RefreshCw}
            title="Renewals"
            action={
                can('create-contract-renewals') && (
                    <Button onClick={() => open(null)}>
                        <Plus /> {t('Add Renewal')}
                    </Button>
                )
            }
        >
            {contract.renewals.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                    {t('No renewals yet.')}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                            <tr className="border-b">
                                <th className="py-3 pe-3 text-start font-medium">
                                    {t('Period')}
                                </th>
                                <th className="px-3 py-3 text-end font-medium">
                                    {t('Value')}
                                </th>
                                <th className="px-3 py-3 text-start font-medium">
                                    {t('Status')}
                                </th>
                                <th className="px-3 py-3 text-start font-medium">
                                    {t('Notes')}
                                </th>
                                <th className="py-3 ps-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {contract.renewals.map((r) => (
                                <tr
                                    key={r.id}
                                    className="border-b align-top last:border-0"
                                >
                                    <td className="py-3 pe-3 whitespace-nowrap">
                                        {date(r.start_date)} —{' '}
                                        {date(r.end_date)}
                                    </td>
                                    <td className="px-3 py-3 text-end font-medium whitespace-nowrap">
                                        {money(Number(r.value))}
                                    </td>
                                    <td className="px-3 py-3">
                                        <StatusBadge status={r.status} />
                                    </td>
                                    <td className="px-3 py-3 text-muted-foreground">
                                        {r.notes ?? '-'}
                                    </td>
                                    <td className="py-3 ps-3 text-end whitespace-nowrap">
                                        {can('edit-contract-renewals') &&
                                            mayChange(r) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={t('Edit')}
                                                    onClick={() => open(r)}
                                                >
                                                    <SquarePen className="text-blue-600" />
                                                </Button>
                                            )}
                                        {can('delete-contract-renewals') &&
                                            mayChange(r) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={t('Delete')}
                                                    onClick={() =>
                                                        setDeleting(r)
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
            )}

            {formOpen && (
                <FormDialog
                    open
                    onOpenChange={setFormOpen}
                    title={editing ? 'Edit Renewal' : 'Add Renewal'}
                    description="The renewed term, its value and where it stands."
                    icon={RefreshCw}
                    processing={form.processing}
                    onSubmit={(e) => {
                        e.preventDefault();
                        const options = {
                            preserveScroll: true,
                            onSuccess: () => setFormOpen(false),
                        };
                        if (editing) {
                            form.put(
                                contracts.renewals.update({
                                    contract: contract.id,
                                    renewal: editing.id,
                                }).url,
                                options,
                            );
                        } else {
                            form.post(
                                contracts.renewals.store(contract.id).url,
                                options,
                            );
                        }
                    }}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="renewal-start">
                                {t('Start Date')}{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <DatePicker
                                id="renewal-start"
                                name="start_date"
                                defaultValue={form.data.start_date}
                                invalid={!!form.errors.start_date}
                                onChange={(v) => form.setData('start_date', v)}
                            />
                            <InputError message={form.errors.start_date} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="renewal-end">
                                {t('End Date')}{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <DatePicker
                                id="renewal-end"
                                name="end_date"
                                defaultValue={form.data.end_date}
                                invalid={!!form.errors.end_date}
                                onChange={(v) => form.setData('end_date', v)}
                            />
                            <InputError message={form.errors.end_date} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="renewal-value">
                                {t('Value')}{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="renewal-value"
                                inputMode="decimal"
                                value={form.data.value}
                                onChange={(e) =>
                                    form.setData('value', e.target.value)
                                }
                            />
                            <InputError message={form.errors.value} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="renewal-status">
                                {t('Status')}{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <SelectField
                                id="renewal-status"
                                value={form.data.status}
                                onChange={(e) =>
                                    form.setData('status', e.target.value)
                                }
                            >
                                {RENEWAL_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {t(ucfirst(s))}
                                    </option>
                                ))}
                            </SelectField>
                            <InputError message={form.errors.status} />
                        </div>
                        <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="renewal-notes">{t('Notes')}</Label>
                            <Textarea
                                id="renewal-notes"
                                value={form.data.notes}
                                onChange={(e) =>
                                    form.setData('notes', e.target.value)
                                }
                            />
                            <InputError message={form.errors.notes} />
                        </div>
                    </div>
                </FormDialog>
            )}
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This renewal will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(
                        contracts.renewals.destroy({
                            contract: contract.id,
                            renewal: deleting.id,
                        }),
                        {
                            preserveScroll: true,
                            onSuccess: () => setDeleting(null),
                        },
                    )
                }
            />
        </DocCard>
    );
}

export default function ContractShow({
    contract,
    users,
    contractTypes,
    hasSigned,
}: {
    contract: FullContract;
    users: Party[];
    contractTypes: { id: number; name: string }[];
    hasSigned: boolean;
}) {
    const { t } = useTranslation();
    const { money, date, dateTime } = useFormat();
    const can = useCan();
    const { auth } = usePage().props;
    const [tab, setTab] = useState<Tab>('details');
    const [editOpen, setEditOpen] = useState(false);
    const [signOpen, setSignOpen] = useState(false);
    const sign = useForm({ signer_name: auth.user.name });
    const term = contractTerm(contract.start_date, contract.end_date);

    const tabs: {
        key: Tab;
        label: string;
        icon: LucideIcon;
        count?: number;
    }[] = [
        { key: 'details', label: 'Details', icon: FileText },
        {
            key: 'attachments',
            label: 'Attachments',
            icon: Paperclip,
            count: contract.attachments.length,
        },
        {
            key: 'comments',
            label: 'Comments',
            icon: MessageSquare,
            count: contract.comments.length,
        },
        {
            key: 'notes',
            label: 'Notes',
            icon: NotebookPen,
            count: contract.notes.length,
        },
        {
            key: 'renewals',
            label: 'Renewals',
            icon: RefreshCw,
            count: contract.renewals.length,
        },
    ];

    return (
        <>
            <Head title={contract.contract_number} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">
                            {t('Details Contract')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'View details, signature state, attachments, comments, and renewals for this contract.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={contracts.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <section className="flex flex-wrap items-center justify-between gap-6 rounded-xl border bg-card p-6">
                    <div className="flex min-w-0 items-start gap-4">
                        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <FileSignature className="size-7" />
                        </span>
                        <div className="grid min-w-0 gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-xl font-bold">
                                    {contract.subject}
                                </h2>
                                <span className="rounded-md border border-pink-200 bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700 dark:border-pink-900 dark:bg-pink-950 dark:text-pink-300">
                                    {contract.contract_type.name}
                                </span>
                            </div>
                            <div>
                                <StatusBadge
                                    status={contract.status}
                                    label={statusLabel(contract.status)}
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <IdBadge>{contract.contract_number}</IdBadge>
                                <span className="flex items-center gap-1">
                                    <User className="size-4" />{' '}
                                    {contract.user.name}
                                </span>
                                <span className="flex items-center gap-1">
                                    <CalendarDays className="size-4" />{' '}
                                    {date(contract.start_date)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border px-5 py-4">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                            <DollarSign className="size-5" />
                        </span>
                        <div>
                            <div className="text-sm text-muted-foreground">
                                {t('Contract Value')}
                            </div>
                            <div className="text-xl font-bold">
                                {money(Number(contract.value))}
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <div
                            role="tablist"
                            className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1"
                        >
                            {tabs.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === item.key}
                                    onClick={() => setTab(item.key)}
                                    className={cn(
                                        'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                                        tab === item.key
                                            ? 'bg-card text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <item.icon className="size-4" />
                                    {t(item.label)}
                                    {item.count !== undefined &&
                                        ` (${item.count})`}
                                </button>
                            ))}
                        </div>

                        {tab === 'details' && (
                            <>
                                <DocCard
                                    icon={FileText}
                                    title="Contract Agreement"
                                    action={
                                        can('edit-contracts') && (
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    setEditOpen(true)
                                                }
                                            >
                                                <SquarePen />{' '}
                                                {t('Edit Document')}
                                            </Button>
                                        )
                                    }
                                >
                                    <div className="min-h-32 rounded-lg border p-5 text-sm whitespace-pre-line">
                                        {contract.description || (
                                            <span className="text-muted-foreground">
                                                {t('No agreement text yet.')}
                                            </span>
                                        )}
                                    </div>
                                </DocCard>
                                <DocCard
                                    icon={PenLine}
                                    title="Signatures"
                                    action={
                                        can('signatures-contracts') &&
                                        !hasSigned && (
                                            <Button
                                                onClick={() =>
                                                    setSignOpen(true)
                                                }
                                            >
                                                <PenLine /> {t('Sign Contract')}
                                            </Button>
                                        )
                                    }
                                >
                                    {contract.signatures.length === 0 ? (
                                        <p className="py-6 text-center text-sm text-muted-foreground">
                                            {t(
                                                'Nobody has signed this contract yet.',
                                            )}
                                        </p>
                                    ) : (
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {contract.signatures.map((s) => (
                                                <div
                                                    key={s.id}
                                                    className="rounded-xl border p-4"
                                                >
                                                    <div className="font-semibold">
                                                        {s.signer_name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {t('Signed on :date', {
                                                            date: dateTime(
                                                                s.signed_at,
                                                            ),
                                                        })}
                                                    </div>
                                                    <img
                                                        src={s.signature_data}
                                                        alt={t(
                                                            'Signature of :name',
                                                            {
                                                                name: s.signer_name,
                                                            },
                                                        )}
                                                        className="mt-3 h-16 rounded-lg border bg-white px-3"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </DocCard>
                            </>
                        )}
                        {tab === 'attachments' && (
                            <Attachments contract={contract} />
                        )}
                        {tab === 'comments' && (
                            <NoteThread
                                contract={contract}
                                type="comment"
                                items={contract.comments}
                            />
                        )}
                        {tab === 'notes' && (
                            <NoteThread
                                contract={contract}
                                type="note"
                                items={contract.notes}
                            />
                        )}
                        {tab === 'renewals' && <Renewals contract={contract} />}
                    </div>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard
                            icon={FileSignature}
                            title="Contract Information"
                        >
                            <div className="grid gap-5">
                                <div className="grid gap-2">
                                    <Label htmlFor="contract-status-select">
                                        {t('Status')}
                                    </Label>
                                    {can('edit-contracts') ? (
                                        <SelectField
                                            id="contract-status-select"
                                            value={contract.status}
                                            onChange={(e) =>
                                                router.put(
                                                    contracts.status(
                                                        contract.id,
                                                    ),
                                                    { status: e.target.value },
                                                    { preserveScroll: true },
                                                )
                                            }
                                        >
                                            {[
                                                'pending',
                                                'accepted',
                                                'declined',
                                                'closed',
                                            ].map((s) => (
                                                <option key={s} value={s}>
                                                    {t(statusLabel(s))}
                                                </option>
                                            ))}
                                        </SelectField>
                                    ) : (
                                        <StatusBadge
                                            status={contract.status}
                                            label={statusLabel(contract.status)}
                                        />
                                    )}
                                </div>
                                <Fact icon={Hash} label="Contract Number">
                                    {contract.contract_number}
                                </Fact>
                                <Fact icon={User} label="Assigned to">
                                    {contract.user.name}
                                </Fact>
                                <Fact icon={FileText} label="Contract Type">
                                    {contract.contract_type.name}
                                </Fact>
                                <Fact icon={DollarSign} label="Contract Value">
                                    {money(Number(contract.value))}
                                </Fact>
                                <div className="rounded-lg border p-4">
                                    <div className="mb-2 text-sm font-medium">
                                        {t('Timeline & Progress')}
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{date(contract.start_date)}</span>
                                        <span>{date(contract.end_date)}</span>
                                    </div>
                                    <div className="mt-2 h-2 rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-primary"
                                            style={{
                                                width: `${term.progress}%`,
                                            }}
                                        />
                                    </div>
                                    <div className="mt-2 flex justify-between text-xs">
                                        <span>{t(term.label)}</span>
                                        <span className="font-medium">
                                            {term.progress}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </DocCard>
                    </div>
                </div>
            </div>

            {editOpen && (
                <ContractFormDialog
                    open
                    onOpenChange={setEditOpen}
                    contract={contract}
                    users={users}
                    contractTypes={contractTypes}
                />
            )}

            <FormDialog
                open={signOpen}
                onOpenChange={setSignOpen}
                title="Sign Contract"
                description="Type your name to sign. Your signature is recorded with today's date and cannot be changed."
                icon={PenLine}
                submitLabel="Sign"
                processing={sign.processing}
                onSubmit={(e) => {
                    e.preventDefault();
                    sign.post(contracts.sign(contract.id).url, {
                        preserveScroll: true,
                        onSuccess: () => setSignOpen(false),
                    });
                }}
            >
                <div className="grid gap-2">
                    <Label htmlFor="signer-name">
                        {t('Full Name')}{' '}
                        <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="signer-name"
                        value={sign.data.signer_name}
                        onChange={(e) =>
                            sign.setData('signer_name', e.target.value)
                        }
                    />
                    <InputError message={sign.errors.signer_name} />
                </div>
                {sign.data.signer_name && (
                    <div className="rounded-lg border bg-white px-4 py-3 font-serif text-2xl text-[#1a365d] italic">
                        {sign.data.signer_name}
                    </div>
                )}
            </FormDialog>
        </>
    );
}

ContractShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Contracts', href: contracts.index() },
        { title: 'Contract Details', href: contracts.index() },
    ],
};
