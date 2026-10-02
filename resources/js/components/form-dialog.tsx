import type { LucideIcon } from 'lucide-react';
import { SquarePen } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

/** Shared top band for the app's dialogs: an icon badge, the title and an optional description. */
export function ModalHeader({
    icon: Icon,
    title,
    description,
    tone = 'primary',
}: {
    icon: LucideIcon;
    title: ReactNode;
    description?: ReactNode;
    tone?: 'primary' | 'destructive';
}) {
    return (
        <div className="flex items-start gap-4 border-b bg-muted/40 px-6 py-5 pe-12">
            <span
                className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl',
                    tone === 'primary'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-destructive/10 text-destructive',
                )}
            >
                <Icon className="size-5" />
            </span>
            <div className="grid min-w-0 gap-1">
                <DialogTitle className="text-lg leading-tight">
                    {title}
                </DialogTitle>
                {description ? (
                    <DialogDescription>{description}</DialogDescription>
                ) : (
                    <DialogDescription className="sr-only">
                        {title}
                    </DialogDescription>
                )}
            </div>
        </div>
    );
}

export function FormDialog({
    open,
    onOpenChange,
    title,
    description,
    icon = SquarePen,
    onSubmit,
    processing,
    submitLabel = 'Save',
    children,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    icon?: LucideIcon;
    onSubmit: (e: FormEvent) => void;
    processing: boolean;
    submitLabel?: string;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <form
                    noValidate
                    onSubmit={onSubmit}
                    className="flex max-h-[92dvh] flex-col"
                >
                    <ModalHeader
                        icon={icon}
                        title={t(title)}
                        description={description && t(description)}
                    />
                    <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-6">
                        {children}
                    </div>
                    <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            type="submit"
                            disabled={processing}
                            className="min-w-28"
                        >
                            {processing && <Spinner />}
                            {t(submitLabel)}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
