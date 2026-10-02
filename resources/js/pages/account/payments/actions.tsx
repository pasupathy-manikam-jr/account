import { Link, router } from '@inertiajs/react';
import { Check, Eye, Trash2, X } from 'lucide-react';
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
import { kindConfig } from './types';
import type { Payment } from './types';

export function PaymentActions({
    payment,
    showView = true,
}: {
    payment: Payment;
    showView?: boolean;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const { routes, perm } = kindConfig(payment.kind);
    const [confirm, setConfirm] = useState<
        'clear' | 'cancel' | 'delete' | null
    >(null);
    const pending = payment.status === 'pending';

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
                can(`view-${perm}`) &&
                action('View', null, {
                    asChild: true,
                    children: (
                        <Link href={routes.show(payment.id)}>
                            <Eye className="text-emerald-600" />
                        </Link>
                    ),
                })}
            {pending &&
                can(`cleared-${perm}`) &&
                action('Clear', <Check className="text-emerald-600" />, {
                    onClick: () => setConfirm('clear'),
                })}
            {pending &&
                can(`delete-${perm}`) &&
                action('Cancel Payment', <X className="text-amber-600" />, {
                    onClick: () => setConfirm('cancel'),
                })}
            {pending &&
                can(`delete-${perm}`) &&
                action('Delete', <Trash2 className="text-destructive" />, {
                    onClick: () => setConfirm('delete'),
                })}

            <ConfirmDialog
                open={confirm === 'clear'}
                onOpenChange={(open) => !open && setConfirm(null)}
                icon={Check}
                title="Clear this payment?"
                description="Confirm the money has moved. The payment is posted to the ledger and settles the invoices it is allocated to."
                confirmLabel="Clear"
                onConfirm={() =>
                    router.put(
                        routes.clear(payment.id),
                        {},
                        {
                            preserveScroll: true,
                            onFinish: () => setConfirm(null),
                        },
                    )
                }
            />
            <ConfirmDialog
                open={confirm === 'cancel'}
                onOpenChange={(open) => !open && setConfirm(null)}
                icon={X}
                title="Cancel this payment?"
                description="The payment is marked cancelled and nothing is recorded in the ledger."
                confirmLabel="Cancel Payment"
                onConfirm={() =>
                    router.put(
                        routes.cancel(payment.id),
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
                description="This payment will be permanently deleted."
                onConfirm={() =>
                    router.delete(routes.destroy(payment.id), {
                        onFinish: () => setConfirm(null),
                    })
                }
            />
        </>
    );
}
