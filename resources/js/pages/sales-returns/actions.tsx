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
import salesReturns from '@/routes/sales-returns';
import type { SalesReturn } from './types';

/** draft → approve or delete; approved → complete (restock + credit note); every return opens. */
export function ReturnActions({
    salesReturn,
    showView = true,
}: {
    salesReturn: SalesReturn;
    showView?: boolean;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const [confirm, setConfirm] = useState<'complete' | 'delete' | null>(null);
    const put = (route: ReturnType<typeof salesReturns.approve>) =>
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
                can('view-sales-return-invoices') &&
                action('View', null, {
                    asChild: true,
                    children: (
                        <Link href={salesReturns.show(salesReturn.id)}>
                            <Eye className="text-emerald-600" />
                        </Link>
                    ),
                })}
            {salesReturn.status === 'draft' &&
                can('approve-sales-returns-invoices') &&
                action('Approve', <Check className="text-emerald-600" />, {
                    onClick: () => put(salesReturns.approve(salesReturn.id)),
                })}
            {salesReturn.status === 'approved' &&
                can('complete-sales-returns-invoices') &&
                action(
                    'Complete',
                    <PackageCheck className="text-violet-600" />,
                    { onClick: () => setConfirm('complete') },
                )}
            {salesReturn.status === 'draft' &&
                can('delete-sales-return-invoices') &&
                action('Delete', <Trash2 className="text-destructive" />, {
                    onClick: () => setConfirm('delete'),
                })}

            <ConfirmDialog
                open={confirm === 'complete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                icon={PackageCheck}
                title="Complete this return?"
                description="The returned goods go back into the warehouse and a draft credit note is raised for the customer."
                confirmLabel="Complete"
                onConfirm={() => put(salesReturns.complete(salesReturn.id))}
            />
            <ConfirmDialog
                open={confirm === 'delete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                description="This return will be permanently deleted."
                onConfirm={() =>
                    router.delete(salesReturns.destroy(salesReturn.id), {
                        onFinish: () => setConfirm(null),
                    })
                }
            />
        </>
    );
}
