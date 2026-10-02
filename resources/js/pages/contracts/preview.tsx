import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Printer } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import contracts from '@/routes/contracts';
import { contractTerm, statusLabel } from './types';
import type { Contract } from './types';

type Signature = {
    id: number;
    signer_name: string;
    signature_data: string;
    signed_at: string;
};

export default function ContractPreview({
    contract,
    company,
}: {
    contract: Contract & { signatures: Signature[] };
    company: string;
}) {
    const { t } = useTranslation();
    const { money, date, dateTime } = useFormat();
    const term = contractTerm(contract.start_date, contract.end_date);
    const facts: [string, string][] = [
        ['Contract Number', contract.contract_number],
        ['Contract Type', contract.contract_type.name],
        ['Status', t(statusLabel(contract.status))],
        ['Contract Value', money(Number(contract.value))],
        ['Start Date', date(contract.start_date)],
        ['End Date', date(contract.end_date)],
        ['Term', t(term.label)],
    ];

    return (
        <>
            <Head title={`${contract.contract_number} – ${t('Preview')}`} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="print:hidden">
                    <PageHeader
                        title="Contract Preview"
                        description="Preview and print contract details."
                        action={
                            <div className="flex gap-2">
                                <Button variant="outline" asChild>
                                    <Link href={contracts.index()}>
                                        <ArrowLeft className="rtl:rotate-180" />{' '}
                                        {t('Back')}
                                    </Link>
                                </Button>
                                <Button onClick={() => window.print()}>
                                    <Printer /> {t('Print')}
                                </Button>
                            </div>
                        }
                    />
                </div>

                {/* The document itself; print styles drop everything around it. */}
                <article className="mx-auto w-full max-w-3xl rounded-xl border bg-card p-8 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
                    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
                        <div>
                            <div className="text-sm font-semibold text-primary">
                                {company}
                            </div>
                            <h1 className="mt-1 text-2xl font-bold">
                                {contract.subject}
                            </h1>
                        </div>
                        <div className="text-end">
                            <div className="text-xs tracking-wide text-muted-foreground uppercase">
                                {t('Contract')}
                            </div>
                            <div className="font-mono text-lg font-semibold">
                                #{contract.contract_number}
                            </div>
                        </div>
                    </header>

                    <section className="grid gap-6 py-6 sm:grid-cols-2">
                        <div>
                            <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                {t('Contract Information')}
                            </h2>
                            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                                {facts.map(([label, value]) => (
                                    <div key={label} className="contents">
                                        <dt className="text-muted-foreground">
                                            {t(label)}
                                        </dt>
                                        <dd className="font-medium">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                        <div>
                            <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                {t('Parties')}
                            </h2>
                            <div className="grid gap-3 text-sm">
                                <div className="rounded-lg border p-3">
                                    <div className="text-xs text-muted-foreground">
                                        {t('Company')}
                                    </div>
                                    <div className="font-medium">{company}</div>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <div className="text-xs text-muted-foreground">
                                        {t('Assigned To')}
                                    </div>
                                    <div className="font-medium">
                                        {contract.user.name}
                                    </div>
                                    <div className="text-muted-foreground">
                                        {contract.user.email}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {contract.description && (
                        <section className="border-t py-6">
                            <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                {t('Description')}
                            </h2>
                            <p className="text-sm leading-relaxed whitespace-pre-line">
                                {contract.description}
                            </p>
                        </section>
                    )}

                    <section className="border-t pt-6">
                        <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {t('Signatures')}
                        </h2>
                        {contract.signatures.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {t('Not signed yet.')}
                            </p>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2">
                                {contract.signatures.map((s) => (
                                    <div
                                        key={s.id}
                                        className="rounded-lg border p-3 text-sm"
                                    >
                                        <img
                                            src={s.signature_data}
                                            alt={s.signer_name}
                                            className="h-16 w-auto"
                                        />
                                        <div className="mt-2 border-t pt-2 font-medium">
                                            {s.signer_name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {dateTime(s.signed_at)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </article>
            </div>
        </>
    );
}

ContractPreview.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Contracts', href: contracts.index() },
        { title: 'Preview', href: contracts.index() },
    ],
};
