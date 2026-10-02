import { Link, router } from '@inertiajs/react';
import {
    Check,
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
import salesProposals from '@/routes/sales-proposals';
import type { Proposal } from './types';

type Props = { proposal: Proposal; showView?: boolean };

/** The demo's per-status actions: draft → send/edit/delete, sent → accept/reject, any → download. */
export function ProposalActions({ proposal, showView = true }: Props) {
    const { t } = useTranslation();
    const can = useCan();
    const [deleting, setDeleting] = useState(false);
    const put = (route: ReturnType<typeof salesProposals.send>) =>
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
            {can('print-sales-proposals') &&
                action('Download PDF', <Download className="text-sky-600" />, {
                    asChild: true,
                    children: (
                        <a href={salesProposals.pdf(proposal.id).url}>
                            <Download className="text-sky-600" />
                        </a>
                    ),
                })}
            {proposal.status === 'draft' &&
                can('sent-sales-proposals') &&
                action('Send', <Send className="text-violet-600" />, {
                    onClick: () => put(salesProposals.send(proposal.id)),
                })}
            {proposal.status === 'sent' &&
                can('accept-sales-proposals') &&
                action('Accept', <Check className="text-emerald-600" />, {
                    onClick: () => put(salesProposals.accept(proposal.id)),
                })}
            {proposal.status === 'sent' &&
                can('reject-sales-proposals') &&
                action('Reject', <X className="text-destructive" />, {
                    onClick: () => put(salesProposals.reject(proposal.id)),
                })}
            {proposal.status === 'accepted' &&
                !proposal.invoice_id &&
                can('convert-sales-proposals') &&
                action(
                    'Convert to Invoice',
                    <RefreshCw className="text-emerald-600" />,
                    {
                        onClick: () =>
                            router.post(salesProposals.convert(proposal.id)),
                    },
                )}
            {proposal.invoice_id &&
                can('view-sales-invoices') &&
                action(
                    'View Invoice',
                    <Receipt className="text-emerald-600" />,
                    {
                        asChild: true,
                        children: (
                            <Link
                                href={salesInvoices.show(proposal.invoice_id)}
                            >
                                <Receipt className="text-emerald-600" />
                            </Link>
                        ),
                    },
                )}
            {showView &&
                can('view-sales-proposals') &&
                action('View', <Eye className="text-emerald-600" />, {
                    asChild: true,
                    children: (
                        <Link href={salesProposals.show(proposal.id)}>
                            <Eye className="text-emerald-600" />
                        </Link>
                    ),
                })}
            {proposal.status === 'draft' &&
                can('edit-sales-proposals') &&
                action('Edit', <SquarePen className="text-blue-600" />, {
                    asChild: true,
                    children: (
                        <Link href={salesProposals.edit(proposal.id)}>
                            <SquarePen className="text-blue-600" />
                        </Link>
                    ),
                })}
            {proposal.status === 'draft' &&
                can('delete-sales-proposals') &&
                action('Delete', <Trash2 className="text-destructive" />, {
                    onClick: () => setDeleting(true),
                })}

            <ConfirmDialog
                open={deleting}
                onOpenChange={setDeleting}
                description="This proposal will be permanently deleted."
                onConfirm={() =>
                    router.delete(salesProposals.destroy(proposal.id), {
                        onSuccess: () => setDeleting(false),
                    })
                }
            />
        </>
    );
}
