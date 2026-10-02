import { Link, router } from '@inertiajs/react';
import {
    Check,
    Copy,
    Download,
    Eye,
    Receipt,
    RefreshCw,
    Send,
    SquarePen,
    Trash2,
    X,
} from 'lucide-react';
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
import salesInvoices from '@/routes/sales-invoices';
import retainerRoutes from '@/routes/retainers';
import type { Retainer } from './types';

type Props = { retainer: Retainer; showView?: boolean };

/** The demo's per-status actions: draft → send/edit/delete, sent → accept/reject, any → download. */
export function RetainerActions({ retainer, showView = true }: Props) {
    const { t } = useTranslation();
    const can = useCan();
    const [deleting, setDeleting] = useState(false);
    const put = (route: ReturnType<typeof retainerRoutes.send>) =>
        router.put(route, {}, { preserveScroll: true });

    const action = (
        label: string,
        icon: React.ReactNode,
        props: React.ComponentProps<typeof Button>,
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
            {can('print-retainer') &&
                action('Download PDF', <Download className="text-sky-600" />, {
                    asChild: true,
                    children: (
                        <a href={retainerRoutes.pdf(retainer.id).url}>
                            <Download className="text-sky-600" />
                        </a>
                    ),
                })}
            {retainer.status === 'draft' &&
                can('sent-retainer') &&
                action('Send', <Send className="text-violet-600" />, {
                    onClick: () => put(retainerRoutes.send(retainer.id)),
                })}
            {retainer.status === 'sent' &&
                can('accept-retainer') &&
                action('Accept', <Check className="text-emerald-600" />, {
                    onClick: () => put(retainerRoutes.accept(retainer.id)),
                })}
            {retainer.status === 'sent' &&
                can('reject-retainer') &&
                action('Reject', <X className="text-destructive" />, {
                    onClick: () => put(retainerRoutes.reject(retainer.id)),
                })}
            {['accepted', 'partial', 'paid'].includes(retainer.status) &&
                !retainer.invoice_id &&
                can('convert-to-invoice-retainer') &&
                action(
                    'Convert to Invoice',
                    <RefreshCw className="text-emerald-600" />,
                    {
                        onClick: () =>
                            router.post(retainerRoutes.convert(retainer.id)),
                    },
                )}
            {retainer.invoice_id &&
                can('view-sales-invoices') &&
                action(
                    'View Invoice',
                    <Receipt className="text-emerald-600" />,
                    {
                        asChild: true,
                        children: (
                            <Link
                                href={salesInvoices.show(retainer.invoice_id)}
                            >
                                <Receipt className="text-emerald-600" />
                            </Link>
                        ),
                    },
                )}
            {can('duplicate-retainer') &&
                action('Duplicate', <Copy className="text-amber-600" />, {
                    onClick: () =>
                        router.post(retainerRoutes.duplicate(retainer.id)),
                })}
            {showView &&
                can('view-retainer') &&
                action('View', <Eye className="text-emerald-600" />, {
                    asChild: true,
                    children: (
                        <Link href={retainerRoutes.show(retainer.id)}>
                            <Eye className="text-emerald-600" />
                        </Link>
                    ),
                })}
            {retainer.status === 'draft' &&
                can('edit-retainer') &&
                action('Edit', <SquarePen className="text-blue-600" />, {
                    asChild: true,
                    children: (
                        <Link href={retainerRoutes.edit(retainer.id)}>
                            <SquarePen className="text-blue-600" />
                        </Link>
                    ),
                })}
            {retainer.status === 'draft' &&
                can('delete-retainer') &&
                action('Delete', <Trash2 className="text-destructive" />, {
                    onClick: () => setDeleting(true),
                })}

            <ConfirmDialog
                open={deleting}
                onOpenChange={setDeleting}
                description="This retainer will be permanently deleted."
                onConfirm={() =>
                    router.delete(retainerRoutes.destroy(retainer.id), {
                        onSuccess: () => setDeleting(false),
                    })
                }
            />
        </>
    );
}
