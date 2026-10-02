import { Link, router } from '@inertiajs/react';
import { Download, Eye, FileCheck, SquarePen, Trash2 } from 'lucide-react';
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
import purchaseInvoices from '@/routes/purchase-invoices';
import type { Invoice } from './types';

/** The demo's per-status actions: every invoice downloads and opens; drafts also post, edit and delete. */
export function InvoiceActions({ invoice }: { invoice: Invoice }) {
    const { t } = useTranslation();
    const can = useCan();
    const [deleting, setDeleting] = useState(false);
    const [posting, setPosting] = useState(false);
    const draft = invoice.status === 'draft';

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
            {can('print-purchase-invoices') &&
                action('Download PDF', null, {
                    asChild: true,
                    children: (
                        <a href={purchaseInvoices.pdf(invoice.id).url}>
                            <Download className="text-sky-600" />
                        </a>
                    ),
                })}
            {can('view-purchase-invoices') &&
                action('View', null, {
                    asChild: true,
                    children: (
                        <Link href={purchaseInvoices.show(invoice.id)}>
                            <Eye className="text-emerald-600" />
                        </Link>
                    ),
                })}
            {draft &&
                can('post-purchase-invoices') &&
                action('Post', <FileCheck className="text-violet-600" />, {
                    onClick: () => setPosting(true),
                })}
            {draft &&
                can('edit-purchase-invoices') &&
                action('Edit', null, {
                    asChild: true,
                    children: (
                        <Link href={purchaseInvoices.edit(invoice.id)}>
                            <SquarePen className="text-blue-600" />
                        </Link>
                    ),
                })}
            {draft &&
                can('delete-purchase-invoices') &&
                action('Delete', <Trash2 className="text-destructive" />, {
                    onClick: () => setDeleting(true),
                })}

            <ConfirmDialog
                open={posting}
                onOpenChange={setPosting}
                icon={FileCheck}
                title="Post this invoice?"
                description="Posting takes the items out of stock and records the sale in the ledger. A posted invoice can no longer be edited or deleted."
                confirmLabel="Post"
                onConfirm={() =>
                    router.put(
                        purchaseInvoices.post(invoice.id),
                        {},
                        {
                            preserveScroll: true,
                            onFinish: () => setPosting(false),
                        },
                    )
                }
            />
            <ConfirmDialog
                open={deleting}
                onOpenChange={setDeleting}
                description="This invoice will be permanently deleted."
                onConfirm={() =>
                    router.delete(purchaseInvoices.destroy(invoice.id), {
                        onSuccess: () => setDeleting(false),
                    })
                }
            />
        </>
    );
}
