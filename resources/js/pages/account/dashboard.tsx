import { Head } from '@inertiajs/react';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Building2,
    UserCheck,
} from 'lucide-react';
import { PaymentsChart } from '@/components/payments-chart';
import { SummaryCard } from '@/components/summary-card';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import account from '@/routes/account';

type Entry = {
    id: number;
    title: string;
    description: string | null;
    amount: string;
    date: string;
};

type Props = {
    stats: {
        total_clients: number;
        total_vendors: number;
        total_customer_payment: string;
        total_vendor_payment: string;
    };
    monthlyCustomerPayments: { month: string; amount: number }[];
    monthlyVendorPayments: { month: string; amount: number }[];
    recentRevenues: Entry[];
    recentExpenses: Entry[];
};

function RecentList({
    title,
    entries,
    tone,
    emptyMessage,
}: {
    title: string;
    entries: Entry[];
    tone: 'revenue' | 'expense';
    emptyMessage: string;
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();

    return (
        <div className="min-w-0 rounded-xl border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t(title)}</h2>
                <span className="text-xs text-muted-foreground">
                    {t('Latest 5')}
                </span>
            </div>
            {entries.length === 0 ? (
                <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                    {t(emptyMessage)}
                </p>
            ) : (
                <ul className="grid gap-3">
                    {entries.map((entry) => (
                        <li
                            key={entry.id}
                            className="flex min-w-0 items-center justify-between gap-4 rounded-lg border px-4 py-3"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                    {entry.title}
                                </div>
                                {entry.description && (
                                    <div className="truncate text-sm text-muted-foreground">
                                        {entry.description}
                                    </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                    {date(entry.date)}
                                </div>
                            </div>
                            <div
                                className={cn(
                                    'shrink-0 text-lg font-semibold whitespace-nowrap tabular-nums',
                                    tone === 'revenue'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400',
                                )}
                            >
                                {money(Number(entry.amount))}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function AccountDashboard({
    stats,
    monthlyCustomerPayments,
    monthlyVendorPayments,
    recentRevenues,
    recentExpenses,
}: Props) {
    const { t } = useTranslation();
    const { money } = useFormat();

    return (
        <>
            <Head title={t('Account Dashboard')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold">
                        {t('Account Dashboard')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t(
                            'Track financial performance, revenues, expenses, clients, and vendor activity.',
                        )}
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        tone="orange"
                        icon={UserCheck}
                        label="Total Clients"
                        value={stats.total_clients}
                        caption="Active clients"
                    />
                    <SummaryCard
                        tone="teal"
                        icon={Building2}
                        label="Total Vendors"
                        value={stats.total_vendors}
                        caption="Active vendors"
                    />
                    <SummaryCard
                        tone="green"
                        icon={ArrowDownCircle}
                        label="Total Customer Payment"
                        value={money(Number(stats.total_customer_payment))}
                        caption="Received payments"
                    />
                    <SummaryCard
                        tone="rose"
                        icon={ArrowUpCircle}
                        label="Total Vendor Payment"
                        value={money(Number(stats.total_vendor_payment))}
                        caption="Paid to vendors"
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <PaymentsChart
                        title="Monthly Customer Payments"
                        data={monthlyCustomerPayments}
                        color="var(--color-emerald-500)"
                    />
                    <PaymentsChart
                        title="Monthly Vendor Payments"
                        data={monthlyVendorPayments}
                        color="var(--color-rose-500)"
                    />
                </div>

                <div className="grid items-start gap-6 lg:grid-cols-2">
                    <RecentList
                        title="Recent Revenue"
                        entries={recentRevenues}
                        tone="revenue"
                        emptyMessage="No revenue has been posted yet."
                    />
                    <RecentList
                        title="Recent Expenses"
                        entries={recentExpenses}
                        tone="expense"
                        emptyMessage="No expenses have been posted yet."
                    />
                </div>
            </div>
        </>
    );
}

AccountDashboard.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Account Dashboard', href: account.dashboard() },
    ],
};
