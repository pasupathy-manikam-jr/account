import {
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';

type TrendPoint = { month: string; monthly: number; accumulated: number };

const tooltipStyle = {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--popover-foreground)',
};

function Card({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <div className="rounded-xl border bg-card shadow-sm">
            <div className="border-b px-5 py-3">
                <div className="font-semibold">{t(title)}</div>
                <div className="text-xs text-muted-foreground">
                    {t(subtitle)}
                </div>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

/** The demo's chart row: depreciation trend, assets by status, and how many use each method. */
export function DepreciationCharts({
    trend,
    total,
    fully,
    methods,
}: {
    trend: TrendPoint[];
    total: number;
    fully: number;
    methods: { label: string; count: number }[];
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const partly = total - fully;
    const status = [
        { name: t('Depreciating'), value: partly, color: '#10b981' },
        { name: t('Fully Depreciated'), value: fully, color: '#ef4444' },
    ];
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

    return (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr_1fr]">
            <Card
                title="Depreciation Trend"
                subtitle="Monthly depreciation vs accumulated depreciation"
            >
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={trend}
                            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                            accessibilityLayer
                        >
                            <CartesianGrid
                                vertical={false}
                                stroke="var(--border)"
                            />
                            <XAxis
                                dataKey="month"
                                tickLine={false}
                                axisLine={false}
                                tick={{
                                    fill: 'var(--muted-foreground)',
                                    fontSize: 12,
                                }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={64}
                                tick={{
                                    fill: 'var(--muted-foreground)',
                                    fontSize: 12,
                                }}
                            />
                            <Tooltip
                                formatter={(value, name) => [
                                    money(Number(value)),
                                    name,
                                ]}
                                contentStyle={tooltipStyle}
                            />
                            <Legend
                                iconType="plainline"
                                wrapperStyle={{ fontSize: 12 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="accumulated"
                                name={t('Accumulated')}
                                stroke="#2563eb"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="monthly"
                                name={t('Monthly')}
                                stroke="#10b981"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card title="Assets by Status" subtitle="Status distribution">
                <div className="flex items-center gap-4">
                    <div className="relative size-40 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={status}
                                    dataKey="value"
                                    innerRadius="70%"
                                    outerRadius="100%"
                                    stroke="var(--card)"
                                    strokeWidth={2}
                                >
                                    {status.map((s) => (
                                        <Cell key={s.name} fill={s.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold">{total}</span>
                            <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                                {t('Total')}
                            </span>
                        </div>
                    </div>
                    <ul className="grid gap-2 text-sm">
                        {status.map((s) => (
                            <li key={s.name} className="flex items-start gap-2">
                                <span
                                    className="mt-1.5 size-2.5 shrink-0 rounded-full"
                                    style={{ background: s.color }}
                                />
                                <span>
                                    {s.name}
                                    <span className="block text-xs text-muted-foreground">
                                        {pct(s.value)}%
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </Card>

            <Card
                title="Depreciation Methods"
                subtitle="Active methods distribution"
            >
                <ul className="grid gap-4">
                    {methods.map((m) => (
                        <li key={m.label}>
                            <div className="flex justify-between text-sm">
                                <span>{t(m.label)}</span>
                                <span className="text-muted-foreground">
                                    {t(':count assets', { count: m.count })}{' '}
                                    <span className="font-semibold text-emerald-600">
                                        {pct(m.count)}%
                                    </span>
                                </span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{ width: `${pct(m.count)}%` }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            </Card>
        </div>
    );
}
