import { cn } from '@/lib/utils';

export function ProgressBar({
    value,
    className,
}: {
    value: number;
    className?: string;
}) {
    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
            >
                <div
                    className={cn(
                        'h-full rounded-full',
                        value >= 100 ? 'bg-emerald-500' : 'bg-primary',
                    )}
                    style={{ width: `${value}%` }}
                />
            </div>
            <span className="w-10 text-end text-xs font-medium tabular-nums">
                {value}%
            </span>
        </div>
    );
}
