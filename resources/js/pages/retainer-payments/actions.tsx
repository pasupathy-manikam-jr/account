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
import retainerPayments from '@/routes/retainer-payments';
import type { RetainerPayment } from './types';

/** pending → clear (banks the deposit) or cancel; pending payments can also be deleted. */
export function PaymentActions({
    payment,
    showView = true,
}: {
    payment: RetainerPayment;
    showView?: boolean;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const [confirm, setConfirm] = useState<
        'clear' | 'cancel' | 'delete' | null
    >(null);
    const pending = payment.status === 'pending';
    const put = (route: ReturnType<typeof retainerPayments.clear>) =>
        router.put(
            route,
            {},
            { preserveScroll: true, onFinish: () => setConfirm(null) },
        );

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
                can('view-retainer-payments') &&
                action('View', null, {
                    asChild: true,
                    children: (
                        <Link href={retainerPayments.show(payment.id)}>
                            <Eye className="text-emerald-600" />
                        </Link>
                    ),
                })}
            {pending &&
                can('cleared-retainer-payments') &&
                action('Clear', <Check className="text-emerald-600" />, {
                    onClick: () => setConfirm('clear'),
                })}
            {pending &&
                can('cancelled-retainer-payments') &&
                action('Cancel Payment', <X className="text-amber-600" />, {
                    onClick: () => setConfirm('cancel'),
                })}
            {pending &&
                can('delete-retainer-payments') &&
                action('Delete', <Trash2 className="text-destructive" />, {
                    onClick: () => setConfirm('delete'),
                })}

            <ConfirmDialog
                open={confirm === 'clear'}
                onOpenChange={(open) => !open && setConfirm(null)}
                icon={Check}
                title="Clear this payment?"
                description="Confirm the money has reached the bank. The deposit is recorded in the ledger and credited to the retainers."
                confirmLabel="Clear"
                onConfirm={() => put(retainerPayments.clear(payment.id))}
            />
            <ConfirmDialog
                open={confirm === 'cancel'}
                onOpenChange={(open) => !open && setConfirm(null)}
                icon={X}
                title="Cancel this payment?"
                description="The payment is marked cancelled and nothing is recorded in the ledger."
                confirmLabel="Cancel Payment"
                onConfirm={() => put(retainerPayments.cancel(payment.id))}
            />
            <ConfirmDialog
                open={confirm === 'delete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                description="This payment will be permanently deleted."
                onConfirm={() =>
                    router.delete(retainerPayments.destroy(payment.id), {
                        onFinish: () => setConfirm(null),
                    })
                }
            />
        </>
    );
}
