import { Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';

export function ConfirmDialog({
    open,
    onOpenChange,
    title = 'Are you sure?',
    description = 'This action cannot be undone.',
    confirmLabel = 'Delete',
    icon: Icon = Trash2,
    onConfirm,
    processing = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    confirmLabel?: string;
    icon?: LucideIcon;
    onConfirm: () => void;
    processing?: boolean;
}) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-0 p-0 sm:max-w-md">
                <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
                    <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-8 ring-destructive/5">
                        <Icon className="size-6" />
                    </span>
                    <DialogTitle className="text-lg">{t(title)}</DialogTitle>
                    <DialogDescription className="mt-2">
                        {t(description)}
                    </DialogDescription>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t bg-muted/30 px-6 py-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('Cancel')}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={processing}
                    >
                        {processing && <Spinner />}
                        {t(confirmLabel)}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
