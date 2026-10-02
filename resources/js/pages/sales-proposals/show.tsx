import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    Check,
    Clock,
    Download,
    FileText,
    Receipt,
    RefreshCw,
    Send,
    User,
    Warehouse,
    X,
} from 'lucide-react';
import { PersonCell } from '@/components/person-cell';
import {
    DocCard,
    Fact,
    LineItemsTable,
    TotalsList,
} from '@/components/sales-document';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import salesInvoices from '@/routes/sales-invoices';
import salesProposals from '@/routes/sales-proposals';
import type { Proposal } from './types';

type ShownProposal = Proposal & {
    warehouse: { id: number; name: string };
    customer: Proposal['customer'] & {
        customer: {
            company_name: string;
            contact_person_mobile: string | null;
        } | null;
    };
};

export default function ProposalShow({
    proposal,
}: {
    proposal: ShownProposal;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const put = (route: ReturnType<typeof salesProposals.send>) =>
        router.put(route, {}, { preserveScroll: true });
    const overdue = proposal.display_status === 'overdue';

    return (
        <>
            <Head title={proposal.proposal_number} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">
                            {t('Sales Proposal')} #{proposal.proposal_number}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'View details, items, and conversion options for this sales proposal.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={salesProposals.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard icon={CalendarDays} title="Proposal Details">
                            <div className="grid gap-6 sm:grid-cols-2">
                                <Fact icon={CalendarDays} label="Proposal Date">
                                    {date(proposal.proposal_date)}
                                </Fact>
                                <Fact icon={Warehouse} label="Warehouse">
                                    <IdBadge>{proposal.warehouse.name}</IdBadge>
                                </Fact>
                                <Fact icon={CalendarDays} label="Due Date">
                                    <span
                                        className={
                                            overdue
                                                ? 'text-destructive'
                                                : undefined
                                        }
                                    >
                                        {date(proposal.due_date)}
                                        {overdue && ` · ${t('Overdue')}`}
                                    </span>
                                </Fact>
                                <Fact icon={Clock} label="Terms">
                                    {proposal.payment_terms || '-'}
                                </Fact>
                            </div>
                        </DocCard>

                        <DocCard icon={Receipt} title="Proposal Items">
                            <LineItemsTable lines={proposal.items ?? []} />
                            <TotalsList
                                className="ms-auto mt-4 grid max-w-xs gap-2 text-sm"
                                subtotal={Number(proposal.subtotal)}
                                discount={Number(proposal.discount_amount)}
                                tax={Number(proposal.tax_amount)}
                                total={Number(proposal.total_amount)}
                            />
                        </DocCard>

                        {proposal.notes && (
                            <DocCard icon={FileText} title="Additional Notes">
                                <p className="text-sm whitespace-pre-line">
                                    {proposal.notes}
                                </p>
                            </DocCard>
                        )}
                    </div>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={Receipt} title="Summary & Actions">
                            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t('Proposal Total')}
                            </div>
                            <div className="mt-1 text-3xl font-bold">
                                {money(Number(proposal.total_amount))}
                            </div>
                            <div className="mt-2">
                                <StatusBadge status={proposal.display_status} />
                            </div>
                            <div className="mt-6 grid gap-2">
                                {can('print-sales-proposals') && (
                                    <Button variant="outline" asChild>
                                        <a
                                            href={
                                                salesProposals.pdf(proposal.id)
                                                    .url
                                            }
                                        >
                                            <Download /> {t('Download PDF')}
                                        </a>
                                    </Button>
                                )}
                                {proposal.status === 'draft' &&
                                    can('sent-sales-proposals') && (
                                        <Button
                                            onClick={() =>
                                                put(
                                                    salesProposals.send(
                                                        proposal.id,
                                                    ),
                                                )
                                            }
                                        >
                                            <Send /> {t('Mark as Sent')}
                                        </Button>
                                    )}
                                {proposal.status === 'sent' &&
                                    can('accept-sales-proposals') && (
                                        <Button
                                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                                            onClick={() =>
                                                put(
                                                    salesProposals.accept(
                                                        proposal.id,
                                                    ),
                                                )
                                            }
                                        >
                                            <Check /> {t('Accept')}
                                        </Button>
                                    )}
                                {proposal.status === 'sent' &&
                                    can('reject-sales-proposals') && (
                                        <Button
                                            variant="destructive"
                                            onClick={() =>
                                                put(
                                                    salesProposals.reject(
                                                        proposal.id,
                                                    ),
                                                )
                                            }
                                        >
                                            <X /> {t('Reject')}
                                        </Button>
                                    )}
                                {proposal.status === 'accepted' &&
                                    !proposal.invoice_id &&
                                    can('convert-sales-proposals') && (
                                        <Button
                                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                                            onClick={() =>
                                                router.post(
                                                    salesProposals.convert(
                                                        proposal.id,
                                                    ),
                                                )
                                            }
                                        >
                                            <RefreshCw />{' '}
                                            {t('Convert to Invoice')}
                                        </Button>
                                    )}
                                {proposal.invoice_id &&
                                    can('view-sales-invoices') && (
                                        <Button variant="outline" asChild>
                                            <Link
                                                href={salesInvoices.show(
                                                    proposal.invoice_id,
                                                )}
                                            >
                                                <Receipt /> {t('View Invoice')}
                                            </Link>
                                        </Button>
                                    )}
                                {proposal.status === 'draft' &&
                                    can('edit-sales-proposals') && (
                                        <Button variant="outline" asChild>
                                            <Link
                                                href={salesProposals.edit(
                                                    proposal.id,
                                                )}
                                            >
                                                {t('Edit')}
                                            </Link>
                                        </Button>
                                    )}
                            </div>
                        </DocCard>
                        <DocCard icon={User} title="Customer Info">
                            <PersonCell
                                name={proposal.customer.name}
                                detail={proposal.customer.email}
                            />
                            {proposal.customer.customer && (
                                <div className="mt-3 text-sm text-muted-foreground">
                                    {proposal.customer.customer.company_name}
                                    {proposal.customer.customer
                                        .contact_person_mobile && (
                                        <div>
                                            {
                                                proposal.customer.customer
                                                    .contact_person_mobile
                                            }
                                        </div>
                                    )}
                                </div>
                            )}
                        </DocCard>
                    </div>
                </div>
            </div>
        </>
    );
}

ProposalShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Proposals', href: salesProposals.index() },
        { title: 'Sales Proposal Details', href: salesProposals.index() },
    ],
};
