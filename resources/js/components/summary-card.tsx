import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

// The demo's tinted summary cards.
const TONES = {
    orange: 'border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/40 text-orange-700 dark:border-orange-900 dark:from-orange-950/60 dark:to-orange-950/20 dark:text-orange-300',
    teal: 'border-teal-200 bg-gradient-to-br from-teal-50 to-teal-100/40 text-teal-700 dark:border-teal-900 dark:from-teal-950/60 dark:to-teal-950/20 dark:text-teal-300',
    green: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/40 text-emerald-700 dark:border-emerald-900 dark:from-emerald-950/60 dark:to-emerald-950/20 dark:text-emerald-300',
    blue: 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/40 text-blue-700 dark:border-blue-900 dark:from-blue-950/60 dark:to-blue-950/20 dark:text-blue-300',
    violet: 'border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100/40 text-violet-700 dark:border-violet-900 dark:from-violet-950/60 dark:to-violet-950/20 dark:text-violet-300',
    gray: 'border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/40 text-slate-700 dark:border-slate-800 dark:from-slate-900/60 dark:to-slate-900/20 dark:text-slate-300',
    rose: 'border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/40 text-rose-700 dark:border-rose-900 dark:from-rose-950/60 dark:to-rose-950/20 dark:text-rose-300',
} as const;

export function SummaryCard({
    tone,
    icon: Icon,
    label,
    value,
    caption,
}: {
    tone: keyof typeof TONES;
    icon: LucideIcon;
    label: string;
    value: ReactNode;
    caption: string;
}) {
    const { t } = useTranslation();

    return (
        <div className={cn('rounded-xl border p-6', TONES[tone])}>
            <div className="flex items-start justify-between gap-4">
                <span className="text-sm font-medium">{t(label)}</span>
                <Icon className="size-7 shrink-0" strokeWidth={1.5} />
            </div>
            <div className="mt-3 truncate text-2xl font-bold">{value}</div>
            <div className="mt-1 text-xs">{t(caption)}</div>
        </div>
    );
}
