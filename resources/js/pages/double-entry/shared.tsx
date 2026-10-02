import type { InertiaLinkProps } from '@inertiajs/react';
import { Download } from 'lucide-react';
import type { ReactNode } from 'react';
import DatePicker from '@/components/date-picker';
import { PageHeader } from '@/components/page-header';
import { applyFilters } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import type { TableFilters } from '@/types';

type Href = NonNullable<InertiaLinkProps['href']>;

/** Page title with a "Download PDF" button for users who may print it. */
export function StatementHeader({
    title,
    description,
    printUrl,
    printPermission,
}: {
    title: string;
    description: string;
    printUrl: string;
    printPermission: string;
}) {
    const { t } = useTranslation();
    const can = useCan();

    return (
        <PageHeader
            title={title}
            description={description}
            action={
                can(printPermission) && (
                    <Button variant="outline" asChild>
                        <a href={printUrl}>
                            <Download /> {t('Download PDF')}
                        </a>
                    </Button>
                )
            }
        />
    );
}

/** Date pickers bound to query-string filters; each change reloads the statement. */
export function DateFilters({
    url,
    filters,
    fields,
    children,
}: {
    url: Href;
    filters: TableFilters;
    fields: [name: string, label: string][];
    children?: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-wrap items-end gap-4">
            {fields.map(([name, label]) => (
                <div key={name} className="grid gap-1.5">
                    <Label htmlFor={name}>{t(label)}</Label>
                    <DatePicker
                        key={String(filters[name] ?? '')}
                        id={name}
                        name={name}
                        className="w-48"
                        defaultValue={
                            filters[name] ? String(filters[name]) : ''
                        }
                        onChange={(value) =>
                            applyFilters(url, filters, { [name]: value })
                        }
                    />
                </div>
            ))}
            {children}
        </div>
    );
}

/** "4100 · Sales Revenue" with the code muted; computed lines (no code) show the name only. */
export function AccountLabel({ code, name }: { code: string; name: string }) {
    return (
        <span>
            {code && (
                <span className="me-2 font-mono text-xs text-muted-foreground">
                    {code}
                </span>
            )}
            {name}
        </span>
    );
}

/** A money cell: right-aligned, tabular, "-" for zero. */
export function Amount({
    value,
    className,
    dashZero = false,
}: {
    value: string | number;
    className?: string;
    dashZero?: boolean;
}) {
    const { money } = useFormat();
    const n = Number(value);

    return (
        <span className={cn('whitespace-nowrap tabular-nums', className)}>
            {dashZero && n === 0 ? '-' : money(n)}
        </span>
    );
}
