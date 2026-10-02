import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

/** Share of a plan used, coloured by how close it is to the limit. */
function percentOf(spent: number, total: number) {
    return total > 0 ? Math.round((spent / total) * 100) : 0;
}

function barColour(percent: number) {
    return percent > 100
        ? 'bg-rose-500'
        : percent >= 80
          ? 'bg-amber-500'
          : 'bg-emerald-500';
}

function Bar({ percent }: { percent: number }) {
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
                className={cn('h-full rounded-full', barColour(percent))}
                style={{ width: `${Math.min(percent, 100)}%` }}
            />
        </div>
    );
}

/** Total, % used with a bar, then spent and what is left. */
export function Utilization({
    total,
    spent,
}: {
    total: number;
    spent: number;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const percent = percentOf(spent, total);

    return (
        <div className="grid min-w-48 gap-1 text-xs">
            <div className="flex justify-between gap-2 text-sm">
                <span className="font-semibold">{money(total)}</span>
                <span className="text-muted-foreground tabular-nums">
                    {percent}%
                </span>
            </div>
            <Bar percent={percent} />
            <div className="flex justify-between gap-2 text-muted-foreground">
                <span>
                    {t('Spent')}: {money(spent)}
                </span>
                <span className={cn(spent > total && 'text-rose-600')}>
                    {t('Left')}: {money(total - spent)}
                </span>
            </div>
        </div>
    );
}

/** Three summary cards: a count, the total planned, and spending against it. */
export function SpendCards({
    count,
    countLabel,
    countHint,
    allocated,
    spent,
}: {
    count: number;
    countLabel: string;
    countHint: string;
    allocated: number;
    spent: number;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const percent = percentOf(spent, allocated);
    const card = 'rounded-xl border bg-card p-5 shadow-sm';
    const label = 'text-sm font-medium text-muted-foreground';

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <div className={card}>
                <div className={label}>{t(countLabel)}</div>
                <div className="mt-2 text-2xl font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">
                    {t(countHint)}
                </div>
            </div>
            <div className={card}>
                <div className={label}>{t('Total Allocated')}</div>
                <div className="mt-2 text-2xl font-bold">
                    {money(allocated)}
                </div>
                <div className="text-xs text-muted-foreground">
                    {t('Total amount planned')}
                </div>
            </div>
            <div className={card}>
                <div className="flex items-center justify-between">
                    <div className={label}>{t('Spending Status')}</div>
                    <span className="text-sm font-semibold tabular-nums">
                        {percent}%
                    </span>
                </div>
                <div className="mt-2 text-2xl font-bold">{money(spent)}</div>
                <div className="mt-2">
                    <Bar percent={percent} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>
                        {t('Spent')}: {money(spent)}
                    </span>
                    <span>
                        {t('Remaining')}: {money(allocated - spent)}
                    </span>
                </div>
            </div>
        </div>
    );
}
