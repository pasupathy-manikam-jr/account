import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { DateCell, IdBadge } from '@/components/table-cells';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import account from '@/routes/account';
import type { Paginated } from '@/types';

type Account = {
    id: number;
    account_code: string;
    account_name: string;
    level: number;
    normal_balance: 'debit' | 'credit';
    opening_balance: string;
    current_balance: string;
    description: string | null;
    is_active: boolean;
    is_system_account: boolean;
    account_type: { name: string; category: string };
    parent_account: { account_code: string; account_name: string } | null;
    bank_account: { account_name: string } | null;
};

type HistoryLine = {
    id: number;
    description: string | null;
    debit_amount: string;
    credit_amount: string;
    journal_entry: {
        journal_number: string;
        journal_date: string;
        description: string;
    };
};

export default function ChartOfAccountShow({
    account: acc,
    history,
}: {
    account: Account;
    history: Paginated<HistoryLine>;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const page = (n: number) =>
        account.chartOfAccounts.show(acc.id, { query: { page: n } });

    const facts: [string, React.ReactNode][] = [
        ['Account Type', acc.account_type.name],
        [
            'Category',
            <StatusBadge key="c" status={acc.account_type.category} />,
        ],
        [
            'Parent Account',
            acc.parent_account
                ? `${acc.parent_account.account_name} - ${acc.parent_account.account_code}`
                : '-',
        ],
        ['Level', acc.level],
        ['Normal Balance', <StatusBadge key="n" status={acc.normal_balance} />],
        ['Opening Balance', money(Number(acc.opening_balance))],
        ['Bank Account', acc.bank_account?.account_name ?? '-'],
        [
            'Status',
            <StatusBadge
                key="s"
                status={acc.is_active ? 'active' : 'inactive'}
            />,
        ],
    ];

    return (
        <>
            <Head title={acc.account_name} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title={`${acc.account_name} - ${acc.account_code}`}
                    description={acc.description ?? undefined}
                    action={
                        <Button variant="outline" asChild>
                            <Link href={account.chartOfAccounts.index()}>
                                <ArrowLeft className="rtl:rotate-180" />
                                {t('Back')}
                            </Link>
                        </Button>
                    }
                />

                <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
                    <div className="grid gap-4 rounded-xl border bg-card p-6">
                        <div className="flex items-center gap-3">
                            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <BookOpen className="size-6" />
                            </span>
                            <div>
                                <div className="text-sm text-muted-foreground">
                                    {t('Current Balance')}
                                </div>
                                <div className="text-2xl font-bold text-primary">
                                    {money(Number(acc.current_balance))}
                                </div>
                            </div>
                        </div>
                        <dl className="grid gap-3 text-sm">
                            {facts.map(([label, value]) => (
                                <div
                                    key={label}
                                    className="flex items-center justify-between gap-4"
                                >
                                    <dt className="text-muted-foreground">
                                        {t(label)}
                                    </dt>
                                    <dd className="text-end font-medium">
                                        {value}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>

                    <div className="min-w-0 rounded-xl border bg-card p-6">
                        <h2 className="mb-4 text-lg font-semibold">
                            {t('Transaction History')}
                        </h2>
                        <div className="overflow-x-auto rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('Journal')}</TableHead>
                                        <TableHead>{t('Date')}</TableHead>
                                        <TableHead>
                                            {t('Description')}
                                        </TableHead>
                                        <TableHead className="text-end">
                                            {t('Debit')}
                                        </TableHead>
                                        <TableHead className="text-end">
                                            {t('Credit')}
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.data.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className="py-10 text-center text-muted-foreground"
                                            >
                                                {t(
                                                    'No transactions have been posted to this account yet.',
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {history.data.map((line) => (
                                        <TableRow key={line.id}>
                                            <TableCell>
                                                <IdBadge>
                                                    {
                                                        line.journal_entry
                                                            .journal_number
                                                    }
                                                </IdBadge>
                                            </TableCell>
                                            <TableCell>
                                                <DateCell
                                                    value={
                                                        line.journal_entry
                                                            .journal_date
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {
                                                        line.journal_entry
                                                            .description
                                                    }
                                                </div>
                                                {line.description && (
                                                    <div className="text-muted-foreground">
                                                        {line.description}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-end whitespace-nowrap">
                                                {Number(line.debit_amount)
                                                    ? money(
                                                          Number(
                                                              line.debit_amount,
                                                          ),
                                                      )
                                                    : '-'}
                                            </TableCell>
                                            <TableCell className="text-end whitespace-nowrap">
                                                {Number(line.credit_amount)
                                                    ? money(
                                                          Number(
                                                              line.credit_amount,
                                                          ),
                                                      )
                                                    : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {history.last_page > 1 && (
                            <div className="mt-4 flex items-center justify-end gap-2">
                                <span className="me-auto text-sm text-muted-foreground">
                                    {t('Page :page of :last', {
                                        page: history.current_page,
                                        last: history.last_page,
                                    })}
                                </span>
                                {history.current_page > 1 && (
                                    <Button variant="outline" size="sm" asChild>
                                        <Link
                                            href={page(
                                                history.current_page - 1,
                                            )}
                                            preserveScroll
                                        >
                                            {t('Previous')}
                                        </Link>
                                    </Button>
                                )}
                                {history.current_page < history.last_page && (
                                    <Button variant="outline" size="sm" asChild>
                                        <Link
                                            href={page(
                                                history.current_page + 1,
                                            )}
                                            preserveScroll
                                        >
                                            {t('Next')}
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

ChartOfAccountShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.chartOfAccounts.index() },
        { title: 'Chart Of Accounts', href: account.chartOfAccounts.index() },
        { title: 'View', href: account.chartOfAccounts.index() },
    ],
};
