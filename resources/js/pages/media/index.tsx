import { Head, router, useForm } from '@inertiajs/react';
import {
    Download,
    File,
    FileSpreadsheet,
    FileText,
    Folder,
    FolderInput,
    FolderOpen,
    FolderPlus,
    HardDrive,
    Images,
    Inbox,
    SquarePen,
    Trash2,
    Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import media from '@/routes/media';
import { mediaLibrary } from '@/routes';
import type { Paginated } from '@/types';

type MediaFile = {
    id: number;
    folder_id: number | null;
    name: string;
    mime_type: string;
    size: number;
    url: string;
    created_at: string;
};

type MediaFolder = { id: number; name: string; media_count: number };

type Filters = { folder?: string | null; search?: string | null; sort: string };

const ACCEPT =
    '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt';

function bytes(n: number) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
    }

    return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function fileIcon(mime: string): LucideIcon {
    if (
        mime.includes('pdf') ||
        mime.includes('word') ||
        mime.startsWith('text/')
    ) {
        return FileText;
    }

    return mime.includes('sheet') ||
        mime.includes('excel') ||
        mime.includes('csv')
        ? FileSpreadsheet
        : File;
}

export default function MediaLibrary({
    files,
    folders,
    stats,
    filters,
}: {
    files: Paginated<MediaFile>;
    folders: MediaFolder[];
    stats: { count: number; unfiled: number; bytes: number };
    filters: Filters;
}) {
    const { t } = useTranslation();
    const { date } = useFormat();
    const can = useCan();
    const picker = useRef<HTMLInputElement>(null);
    const upload = useForm<{ files: File[]; folder_id: string }>({
        files: [],
        folder_id: '',
    });
    const fileForm = useForm({ name: '', folder_id: '' });
    const folderForm = useForm({ name: '' });
    const [editing, setEditing] = useState<MediaFile | null>(null);
    const [folderDialog, setFolderDialog] = useState<
        MediaFolder | 'new' | null
    >(null);
    const [deleting, setDeleting] = useState<
        | { kind: 'file'; item: MediaFile }
        | { kind: 'folder'; item: MediaFolder }
        | null
    >(null);
    const current = filters.folder ?? '';

    const go = (changes: Partial<Filters>) =>
        router.get(
            mediaLibrary().url,
            Object.fromEntries(
                Object.entries({
                    ...filters,
                    ...changes,
                    page: undefined,
                }).filter(([, v]) => v !== '' && v != null),
            ),
            { preserveState: true, preserveScroll: true, replace: true },
        );

    const toPage = (page: number) =>
        router.get(
            mediaLibrary().url,
            {
                ...Object.fromEntries(
                    Object.entries(filters).filter(
                        ([, v]) => v != null && v !== '',
                    ),
                ),
                page,
            },
            { preserveScroll: true },
        );

    const send = (chosen: FileList | null) => {
        if (!chosen?.length) {
            return;
        }

        upload.transform(() => ({
            files: Array.from(chosen),
            folder_id: /^\d+$/.test(current) ? current : '',
        }));
        upload.post(media.store().url, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => picker.current && (picker.current.value = ''),
        });
    };

    const uploadError = Object.entries(upload.errors).find(([key]) =>
        key.startsWith('files'),
    )?.[1];

    const nav = (
        key: string,
        label: string,
        count: number,
        Icon: LucideIcon,
        folder?: MediaFolder,
    ) => (
        <div
            key={key}
            className={cn(
                'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                current === key
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'hover:bg-muted',
            )}
        >
            <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-start"
                onClick={() => go({ folder: key || undefined })}
            >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
            </button>
            {folder && can('edit-media-directories') && (
                <button
                    type="button"
                    aria-label={t('Rename')}
                    className="hidden text-muted-foreground group-hover:block hover:text-foreground"
                    onClick={() => {
                        folderForm.setData('name', folder.name);
                        folderForm.clearErrors();
                        setFolderDialog(folder);
                    }}
                >
                    <SquarePen className="size-3.5" />
                </button>
            )}
            {folder && can('delete-media-directories') && (
                <button
                    type="button"
                    aria-label={t('Delete')}
                    className="hidden text-muted-foreground group-hover:block hover:text-destructive"
                    onClick={() =>
                        setDeleting({ kind: 'folder', item: folder })
                    }
                >
                    <Trash2 className="size-3.5" />
                </button>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
                {count}
            </span>
        </div>
    );

    return (
        <>
            <Head title={t('Media Library')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Media Library"
                    description="Upload, organize, and manage media files and folders."
                    action={
                        can('create-media') && (
                            <>
                                <input
                                    ref={picker}
                                    type="file"
                                    multiple
                                    accept={ACCEPT}
                                    className="hidden"
                                    onChange={(e) => send(e.target.files)}
                                />
                                <Button
                                    onClick={() => picker.current?.click()}
                                    disabled={upload.processing}
                                >
                                    <Upload />{' '}
                                    {t(
                                        upload.processing
                                            ? 'Uploading...'
                                            : 'Upload Files',
                                    )}
                                </Button>
                            </>
                        )
                    }
                />
                {uploadError && <InputError message={uploadError} />}

                <div className="grid items-start gap-6 lg:grid-cols-[16rem_1fr]">
                    <aside className="grid gap-5 rounded-xl border bg-card p-4 shadow-sm lg:sticky lg:top-20">
                        <div>
                            <div className="mb-1 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                {t('Quick Access')}
                            </div>
                            {nav('', t('All Files'), stats.count, Images)}
                            {nav('none', t('Unfiled'), stats.unfiled, Inbox)}
                        </div>
                        <div>
                            <div className="mb-1 flex items-center justify-between px-3">
                                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                    {t('Folders')}
                                </span>
                                {can('create-media-directories') && (
                                    <button
                                        type="button"
                                        aria-label={t('New Folder')}
                                        className="text-muted-foreground hover:text-primary"
                                        onClick={() => {
                                            folderForm.reset();
                                            folderForm.clearErrors();
                                            setFolderDialog('new');
                                        }}
                                    >
                                        <FolderPlus className="size-4" />
                                    </button>
                                )}
                            </div>
                            {folders.length === 0 && (
                                <p className="px-3 text-xs text-muted-foreground">
                                    {t('No folders yet.')}
                                </p>
                            )}
                            {folders.map((f) =>
                                nav(
                                    String(f.id),
                                    f.name,
                                    f.media_count,
                                    current === String(f.id)
                                        ? FolderOpen
                                        : Folder,
                                    f,
                                ),
                            )}
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                <HardDrive className="size-4" />{' '}
                                {t('Storage Used')}
                            </div>
                            <div className="mt-1 text-lg font-bold">
                                {bytes(stats.bytes)}
                            </div>
                        </div>
                    </aside>

                    <div className="grid gap-4">
                        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
                            <Input
                                className="max-w-xs"
                                placeholder={t('Search...')}
                                defaultValue={filters.search ?? ''}
                                onKeyDown={(e) =>
                                    e.key === 'Enter' &&
                                    go({ search: e.currentTarget.value })
                                }
                                onBlur={(e) =>
                                    e.currentTarget.value !==
                                        (filters.search ?? '') &&
                                    go({ search: e.currentTarget.value })
                                }
                            />
                            <SelectField
                                aria-label={t('Sort')}
                                className="w-auto min-w-36"
                                value={filters.sort}
                                onChange={(e) => go({ sort: e.target.value })}
                            >
                                <option value="created_at">
                                    {t('Newest first')}
                                </option>
                                <option value="name">{t('Name')}</option>
                                <option value="size">
                                    {t('Largest first')}
                                </option>
                            </SelectField>
                            <span className="ms-auto text-sm text-muted-foreground">
                                {t(':count files', { count: files.total })}
                            </span>
                        </div>

                        {files.data.length === 0 ? (
                            <div className="rounded-xl border border-dashed bg-card py-16 text-center text-muted-foreground">
                                <Images className="mx-auto mb-3 size-10 opacity-50" />
                                {t('No files here yet.')}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                                {files.data.map((file) => {
                                    const Icon = fileIcon(file.mime_type);
                                    const image =
                                        file.mime_type.startsWith('image/');

                                    return (
                                        <div
                                            key={file.id}
                                            className="group overflow-hidden rounded-xl border bg-card shadow-sm"
                                        >
                                            <a
                                                href={file.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="relative flex aspect-[4/3] items-center justify-center bg-muted"
                                            >
                                                {image ? (
                                                    <img
                                                        src={file.url}
                                                        alt={file.name}
                                                        loading="lazy"
                                                        className="size-full object-cover"
                                                    />
                                                ) : (
                                                    <Icon className="size-12 text-muted-foreground" />
                                                )}
                                                <span className="absolute start-2 top-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                                                    {file.mime_type
                                                        .split('/')
                                                        .pop()
                                                        ?.split('.')
                                                        .pop()
                                                        ?.slice(0, 5)}
                                                </span>
                                            </a>
                                            <div className="p-3">
                                                <div
                                                    className="truncate text-sm font-medium"
                                                    title={file.name}
                                                >
                                                    {file.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {bytes(file.size)} ·{' '}
                                                    {date(file.created_at)}
                                                </div>
                                                <div className="mt-2 flex justify-end gap-1">
                                                    {can('download-media') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8"
                                                            aria-label={t(
                                                                'Download',
                                                            )}
                                                            asChild
                                                        >
                                                            <a
                                                                href={
                                                                    media.download(
                                                                        file.id,
                                                                    ).url
                                                                }
                                                            >
                                                                <Download className="text-emerald-600" />
                                                            </a>
                                                        </Button>
                                                    )}
                                                    {can('create-media') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8"
                                                            aria-label={t(
                                                                'Rename or Move',
                                                            )}
                                                            title={t(
                                                                'Rename or Move',
                                                            )}
                                                            onClick={() => {
                                                                fileForm.setData(
                                                                    {
                                                                        name: file.name,
                                                                        folder_id:
                                                                            file.folder_id
                                                                                ? String(
                                                                                      file.folder_id,
                                                                                  )
                                                                                : '',
                                                                    },
                                                                );
                                                                fileForm.clearErrors();
                                                                setEditing(
                                                                    file,
                                                                );
                                                            }}
                                                        >
                                                            <FolderInput className="text-blue-600" />
                                                        </Button>
                                                    )}
                                                    {can('delete-media') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8"
                                                            aria-label={t(
                                                                'Delete',
                                                            )}
                                                            onClick={() =>
                                                                setDeleting({
                                                                    kind: 'file',
                                                                    item: file,
                                                                })
                                                            }
                                                        >
                                                            <Trash2 className="text-destructive" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {files.last_page > 1 && (
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>
                                    {t('Page :page of :pages', {
                                        page: files.current_page,
                                        pages: files.last_page,
                                    })}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={files.current_page <= 1}
                                        onClick={() =>
                                            toPage(files.current_page - 1)
                                        }
                                    >
                                        {t('Previous')}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            files.current_page >=
                                            files.last_page
                                        }
                                        onClick={() =>
                                            toPage(files.current_page + 1)
                                        }
                                    >
                                        {t('Next')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <FormDialog
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
                title="Rename or Move"
                description="Change the file's name or the folder it sits in."
                icon={FolderInput}
                processing={fileForm.processing}
                onSubmit={(e) => {
                    e.preventDefault();
                    if (editing) {
                        fileForm.put(media.update(editing.id).url, {
                            preserveScroll: true,
                            onSuccess: () => setEditing(null),
                        });
                    }
                }}
            >
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="file_name">
                            {t('Name')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="file_name"
                            value={fileForm.data.name}
                            onChange={(e) =>
                                fileForm.setData('name', e.target.value)
                            }
                        />
                        <InputError message={fileForm.errors.name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="file_folder">{t('Folder')}</Label>
                        <SelectField
                            id="file_folder"
                            value={fileForm.data.folder_id}
                            placeholder={t('Unfiled')}
                            onChange={(e) =>
                                fileForm.setData('folder_id', e.target.value)
                            }
                        >
                            {folders.map((f) => (
                                <option key={f.id} value={f.id}>
                                    {f.name}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={fileForm.errors.folder_id} />
                    </div>
                </div>
            </FormDialog>

            <FormDialog
                open={folderDialog !== null}
                onOpenChange={(open) => !open && setFolderDialog(null)}
                title={folderDialog === 'new' ? 'New Folder' : 'Rename Folder'}
                icon={FolderPlus}
                processing={folderForm.processing}
                onSubmit={(e) => {
                    e.preventDefault();
                    folderForm.submit(
                        folderDialog === 'new' || !folderDialog
                            ? media.folders.store()
                            : media.folders.update(folderDialog.id),
                        {
                            preserveScroll: true,
                            onSuccess: () => setFolderDialog(null),
                        },
                    );
                }}
            >
                <div className="grid gap-2">
                    <Label htmlFor="folder_name">
                        {t('Name')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="folder_name"
                        value={folderForm.data.name}
                        onChange={(e) =>
                            folderForm.setData('name', e.target.value)
                        }
                    />
                    <InputError message={folderForm.errors.name} />
                </div>
            </FormDialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description={
                    deleting?.kind === 'folder'
                        ? 'The folder will be deleted. Its files are kept and become unfiled.'
                        : 'This file will be permanently deleted.'
                }
                onConfirm={() =>
                    deleting &&
                    router.delete(
                        deleting.kind === 'folder'
                            ? media.folders.destroy(deleting.item.id)
                            : media.destroy(deleting.item.id),
                        {
                            preserveScroll: true,
                            onFinish: () => setDeleting(null),
                        },
                    )
                }
            />
        </>
    );
}

MediaLibrary.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Media Library', href: mediaLibrary() },
    ],
};
