import { Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ModalHeader } from '@/components/form-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/use-translation';

/** [label, value, wide?]: wide rows span both columns (descriptions, notes). */
export type ViewField = [string, ReactNode, boolean?];

/**
 * Read-only details popup: the shared dialog header, then a two-column list of labelled values.
 * Empty values show as a dash.
 */
export function ViewDialog({
    open,
    onClose,
    title,
    description,
    icon = Eye,
    fields,
}: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    fields: ViewField[];
}) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <ModalHeader
                    icon={icon}
                    title={typeof title === 'string' ? t(title) : title}
                    description={description}
                />
                <dl className="grid gap-x-6 gap-y-4 overflow-y-auto px-6 py-6 text-sm sm:grid-cols-2">
                    {fields.map(([label, value, full]) => (
                        <div
                            key={label}
                            className={
                                full
                                    ? 'grid gap-1 rounded-lg border bg-muted/20 px-4 py-3 sm:col-span-2'
                                    : 'grid gap-1 rounded-lg border bg-muted/20 px-4 py-3'
                            }
                        >
                            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t(label)}
                            </dt>
                            <dd className="font-medium break-words whitespace-pre-line">
                                {value === null ||
                                value === undefined ||
                                value === ''
                                    ? '—'
                                    : value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </DialogContent>
        </Dialog>
    );
}
