import { Link, router } from '@inertiajs/react';
import { Check, Eye, Trash2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import account from '@/routes/account';
import type { DebitNote } from './types';

export function DebitNoteActions({
    note,
    showView = true,
}: {
    note: DebitNote;
    showView?: boolean;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const [confirm, setConfirm] = useState<'approve' | 'delete' | null>(null);

    const action = (
        label: string,
        icon: ReactNode,
        props: ComponentProps<typeof Button>,
    ) => (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t(label)}
                    {...props}
                >
                    {props.children ?? icon}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{t(label)}</TooltipContent>
        </Tooltip>
    );

    return (
        <>
            {showView &&
                can('view-debit-notes') &&
                action('View', null, {
                    asChild: true,
                    children: (
                        <Link href={account.debitNotes.show(note.id)}>
                            <Eye className="text-emerald-600" />
                        </Link>
                    ),
                })}
            {note.status === 'draft' &&
                can('approve-debit-notes') &&
                action('Approve', <Check className="text-emerald-600" />, {
                    onClick: () => setConfirm('approve'),
                })}
            {note.status === 'draft' &&
                can('delete-debit-notes') &&
                action('Delete', <Trash2 className="text-destructive" />, {
                    onClick: () => setConfirm('delete'),
                })}

            <ConfirmDialog
                open={confirm === 'approve'}
                onOpenChange={(open) => !open && setConfirm(null)}
                icon={Check}
                title="Approve this debit note?"
                description="Approving reduces what is owed to the vendor in the ledger, and the credit can then be used on vendor payments."
                confirmLabel="Approve"
                onConfirm={() =>
                    router.put(
                        account.debitNotes.approve(note.id),
                        {},
                        {
                            preserveScroll: true,
                            onFinish: () => setConfirm(null),
                        },
                    )
                }
            />
            <ConfirmDialog
                open={confirm === 'delete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                description="This debit note will be permanently deleted."
                onConfirm={() =>
                    router.delete(account.debitNotes.destroy(note.id), {
                        onFinish: () => setConfirm(null),
                    })
                }
            />
        </>
    );
}
