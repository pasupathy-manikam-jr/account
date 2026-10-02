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
import type { CreditNote } from './types';

export function CreditNoteActions({
    note,
    showView = true,
}: {
    note: CreditNote;
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
                can('view-credit-notes') &&
                action('View', null, {
                    asChild: true,
                    children: (
                        <Link href={account.creditNotes.show(note.id)}>
                            <Eye className="text-emerald-600" />
                        </Link>
                    ),
                })}
            {note.status === 'draft' &&
                can('approve-credit-notes') &&
                action('Approve', <Check className="text-emerald-600" />, {
                    onClick: () => setConfirm('approve'),
                })}
            {note.status === 'draft' &&
                can('delete-credit-notes') &&
                action('Delete', <Trash2 className="text-destructive" />, {
                    onClick: () => setConfirm('delete'),
                })}

            <ConfirmDialog
                open={confirm === 'approve'}
                onOpenChange={(open) => !open && setConfirm(null)}
                icon={Check}
                title="Approve this credit note?"
                description="Approving reverses the sale in the ledger and makes the credit available to the customer's payments."
                confirmLabel="Approve"
                onConfirm={() =>
                    router.put(
                        account.creditNotes.approve(note.id),
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
                description="This credit note will be permanently deleted."
                onConfirm={() =>
                    router.delete(account.creditNotes.destroy(note.id), {
                        onFinish: () => setConfirm(null),
                    })
                }
            />
        </>
    );
}
