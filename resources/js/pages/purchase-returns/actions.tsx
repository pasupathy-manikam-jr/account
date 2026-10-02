import { Link, router } from '@inertiajs/react';
import { Check, Eye, PackageCheck, Trash2 } from 'lucide-react';
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
import purchaseReturns from '@/routes/purchase-returns';
import type { PurchaseReturn } from './types';

/** draft → approve or delete; approved → complete (restock + debit note); every return opens. */
export function ReturnActions({
    purchaseReturn,
    showView = true,
}: {
    purchaseReturn: PurchaseReturn;
    showView?: boolean;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const [confirm, setConfirm] = useState<'complete' | 'delete' | null>(null);
    const put = (route: ReturnType<typeof purchaseReturns.approve>) =>
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
                can('view-purchase-return-invoices') &&
                action('View', null, {
                    asChild: true,
                    children: (
                        <Link href={purchaseReturns.show(purchaseReturn.id)}>
                            <Eye className="text-emerald-600" />
                        </Link>
                    ),
                })}
            {purchaseReturn.status === 'draft' &&
                can('approve-purchase-returns-invoices') &&
                action('Approve', <Check className="text-emerald-600" />, {
                    onClick: () =>
                        put(purchaseReturns.approve(purchaseReturn.id)),
                })}
            {purchaseReturn.status === 'approved' &&
                can('complete-purchase-returns-invoices') &&
                action(
                    'Complete',
                    <PackageCheck className="text-violet-600" />,
                    { onClick: () => setConfirm('complete') },
                )}
            {purchaseReturn.status === 'draft' &&
                can('delete-purchase-return-invoices') &&
                action('Delete', <Trash2 className="text-destructive" />, {
                    onClick: () => setConfirm('delete'),
                })}

            <ConfirmDialog
                open={confirm === 'complete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                icon={PackageCheck}
                title="Complete this return?"
                description="The goods leave the warehouse and a draft debit note is raised for the vendor."
                confirmLabel="Complete"
                onConfirm={() =>
                    put(purchaseReturns.complete(purchaseReturn.id))
                }
            />
            <ConfirmDialog
                open={confirm === 'delete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                description="This return will be permanently deleted."
                onConfirm={() =>
                    router.delete(purchaseReturns.destroy(purchaseReturn.id), {
                        onFinish: () => setConfirm(null),
                    })
                }
            />
        </>
    );
}
