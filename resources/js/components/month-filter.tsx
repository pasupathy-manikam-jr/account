import type { InertiaLinkProps } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { applyFilters } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import type { TableFilters } from '@/types';

type Href = NonNullable<InertiaLinkProps['href']>;

const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

/**
 * The demo's month strip above a list: arrows step through the years, a month narrows the list to it
 * (?month=YYYY-MM), and "All" clears it.
 */
export function MonthFilter({
    url,
    filters,
}: {
    url: Href;
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const selected = typeof filters.month === 'string' ? filters.month : '';
    const [year, setYear] = useState(
        () => Number(selected.slice(0, 4)) || new Date().getFullYear(),
    );
    const choose = (month: string | undefined) =>
        applyFilters(url, filters, { month });

    // Step one month back or forward from the chosen one (or from the current month when none is chosen).
    const step = (by: number) => {
        const base = selected
            ? new Date(
                  Number(selected.slice(0, 4)),
                  Number(selected.slice(5)) - 1,
                  1,
              )
            : new Date();
        const next = new Date(base.getFullYear(), base.getMonth() + by, 1);
        setYear(next.getFullYear());
        choose(
            `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`,
        );
    };

    return (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
                <Button
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-full"
                    aria-label={t('Previous month')}
                    onClick={() => step(-1)}
                >
                    <ChevronLeft className="rtl:rotate-180" />
                </Button>
                <div className="flex items-center gap-3 text-sm font-semibold">
                    {selected
                        ? `${t(MONTHS[Number(selected.slice(5)) - 1])} ${selected.slice(0, 4)}`
                        : t('All months')}
                    {selected && (
                        <button
                            type="button"
                            className="text-xs font-normal text-primary hover:underline"
                            onClick={() => choose(undefined)}
                        >
                            {t('Show all')}
                        </button>
                    )}
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-full"
                    aria-label={t('Next month')}
                    onClick={() => step(1)}
                >
                    <ChevronRight className="rtl:rotate-180" />
                </Button>
            </div>
            <div className="flex items-stretch">
                <button
                    type="button"
                    aria-label={t('Previous year')}
                    className="flex w-10 shrink-0 items-center justify-center border-e text-muted-foreground hover:bg-muted"
                    onClick={() => setYear(year - 1)}
                >
                    <ChevronLeft className="size-4 rtl:rotate-180" />
                </button>
                <div className="grid flex-1 grid-cols-6 sm:grid-cols-12">
                    {MONTHS.map((name, i) => {
                        const value = `${year}-${String(i + 1).padStart(2, '0')}`;
                        const active = value === selected;

                        return (
                            <button
                                key={name}
                                type="button"
                                aria-pressed={active}
                                onClick={() =>
                                    choose(active ? undefined : value)
                                }
                                className={cn(
                                    'border-e py-2 text-center last:border-e-0',
                                    active
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-muted',
                                )}
                            >
                                <div
                                    className={cn(
                                        'text-[11px] font-medium',
                                        !active && 'text-muted-foreground',
                                    )}
                                >
                                    {t(name)}
                                </div>
                                <div className="text-sm font-semibold">
                                    {year === new Date().getFullYear()
                                        ? String(i + 1).padStart(2, '0')
                                        : `${String(i + 1).padStart(2, '0')}/${String(year).slice(2)}`}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    aria-label={t('Next year')}
                    className="flex w-10 shrink-0 items-center justify-center border-s text-muted-foreground hover:bg-muted"
                    onClick={() => setYear(year + 1)}
                >
                    <ChevronRight className="size-4 rtl:rotate-180" />
                </button>
            </div>
        </div>
    );
}
