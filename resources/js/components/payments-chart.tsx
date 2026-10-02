import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';

/**
 * One series of monthly amounts as a smooth line (the demo's payment charts).
 * Single series, so the card title names it and no legend box is drawn.
 */
export function PaymentsChart({
    title,
    data,
    color,
}: {
    title: string;
    data: { month: string; amount: number }[];
    color: string;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const empty = data.every((point) => point.amount === 0);

    return (
        <div className="rounded-xl border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">{t(title)}</h2>
            <div className="relative h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
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
                            width={56}
                            allowDecimals={false}
                            tick={{
                                fill: 'var(--muted-foreground)',
                                fontSize: 12,
                            }}
                        />
                        <Tooltip
                            cursor={{
                                stroke: 'var(--muted-foreground)',
                                strokeDasharray: '4 4',
                            }}
                            formatter={(value) => [
                                money(Number(value)),
                                t(title),
                            ]}
                            contentStyle={{
                                background: 'var(--popover)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                color: 'var(--popover-foreground)',
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="amount"
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{
                                r: 5,
                                strokeWidth: 2,
                                stroke: 'var(--card)',
                            }}
                        />
                    </LineChart>
                </ResponsiveContainer>
                {empty && (
                    <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground">
                        {t('No payments recorded yet.')}
                    </p>
                )}
            </div>
        </div>
    );
}
