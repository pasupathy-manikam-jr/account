import { Head } from '@inertiajs/react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { SummaryCard } from '@/components/summary-card';
import { DateCell, IdBadge } from '@/components/table-cells';
import { FilterSelect } from '@/components/table-filters';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import doubleEntry from '@/routes/double-entry';
import type { Paginated, TableFilters } from '@/types';
import { AccountLabel, Amount, DateFilters, StatementHeader } from './shared';

type Line = {
    id: number;
    journal_date: string;
    journal_number: string;
    account_code: string;
    account_name: string;
    reference: string;
    entry_description: string;
    description: string | null;
    debit_amount: string;
    credit_amount: string;
};

export default function LedgerSummary({
    lines,
    totals,
    accounts,
    filters,
}: {
    lines: Paginated<Line>;
    totals: { debit: string; credit: string };
    accounts: { id: number; account_code: string; account_name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const url = doubleEntry.ledgerSummary.index();

    const columns: Column<Line>[] = [
        {
            key: 'journal_date',
            label: 'Date',
            sortable: true,
            render: (l) => <DateCell value={l.journal_date} />,
        },
        {
            key: 'journal_number',
            label: 'Journal',
            render: (l) => <IdBadge>{l.journal_number}</IdBadge>,
        },
        {
            key: 'account',
            label: 'Account',
            render: (l) => (
                <AccountLabel code={l.account_code} name={l.account_name} />
            ),
        },
        {
            key: 'reference',
            label: 'Reference',
            render: (l) => (
                <span className="whitespace-nowrap">{l.reference}</span>
            ),
        },
        {
            key: 'description',
            label: 'Description',
            render: (l) => (
                <div className="max-w-sm">
                    <div>{l.description ?? l.entry_description}</div>
                    {l.description && (
                        <div className="truncate text-xs text-muted-foreground">
                            {l.entry_description}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'debit_amount',
            label: 'Debit',
            sortable: true,
            render: (l) => <Amount value={l.debit_amount} dashZero />,
        },
        {
            key: 'credit_amount',
            label: 'Credit',
            sortable: true,
            render: (l) => <Amount value={l.credit_amount} dashZero />,
        },
    ];

    return (
        <>
            <Head title={t('Ledger Summary')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <StatementHeader
                    title="Ledger Summary"
                    description="Every journal line posted to the ledger, with its account, source document, and debit or credit."
                    printUrl={
                        doubleEntry.ledgerSummary.print({ query: filters }).url
                    }
                    printPermission="print-ledger-summary"
                />
                <DateFilters
                    url={url}
                    filters={filters}
                    fields={[
                        ['date_from', 'From Date'],
                        ['date_to', 'To Date'],
                    ]}
                />
                <div className="grid gap-4 md:grid-cols-2">
                    <SummaryCard
                        tone="blue"
                        icon={ArrowDownLeft}
                        label="Total Debit"
                        value={money(Number(totals.debit))}
                        caption="Debits in the selected lines"
                    />
                    <SummaryCard
                        tone="violet"
                        icon={ArrowUpRight}
                        label="Total Credit"
                        value={money(Number(totals.credit))}
                        caption="Credits in the selected lines"
                    />
                </div>
                <DataTable
                    data={lines}
                    columns={columns}
                    filters={filters}
                    url={url}
                    toolbar={
                        <FilterSelect
                            url={url}
                            filters={filters}
                            name="account_id"
                            label="All Accounts"
                            options={accounts.map((a) => ({
                                id: a.id,
                                name: `${a.account_code} - ${a.account_name}`,
                            }))}
                        />
                    }
                />
            </div>
        </>
    );
}

LedgerSummary.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Double Entry', href: doubleEntry.ledgerSummary.index() },
        { title: 'Ledger Summary', href: doubleEntry.ledgerSummary.index() },
    ],
};
