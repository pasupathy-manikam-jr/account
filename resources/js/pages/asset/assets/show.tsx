import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    Hash,
    Layers,
    MapPin,
    Package,
    SquarePen,
    TrendingDown,
    UserRound,
    Wrench,
} from 'lucide-react';
import { PersonCell } from '@/components/person-cell';
import { DocCard, Fact } from '@/components/sales-document';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import asset from '@/routes/asset';
import assetRoutes from '@/routes/assets';
import { useAssetForm } from './asset-form';
import type { Asset, Option } from './asset-form';

type Shown = Asset & {
    assignments: {
        id: number;
        assigned_date: string;
        expected_return_date: string | null;
        returned_date: string | null;
        condition: string;
        status: string;
        assignee: { id: number; name: string; email: string };
    }[];
    maintenances: {
        id: number;
        title: string;
        maintenance_type: string;
        scheduled_date: string;
        status: string;
        cost: string;
    }[];
};

type Depreciation = {
    method: string;
    useful_life_years: number;
    salvage_value: string;
    start_date: string;
    posted_amount: string;
    posted_through: string | null;
    cost: string;
    annual: string;
    accumulated: string;
    book_value: string;
    unposted: string;
    status: string;
    schedule: { year: number; from: string; amount: string }[];
};

const METHODS: Record<string, string> = {
    straight_line: 'Straight Line',
    declining_balance: 'Declining Balance',
    sum_of_years: 'Sum of Years',
};

export default function AssetShow({
    asset: item,
    depreciation,
    categories,
    locations,
}: {
    asset: Shown;
    depreciation: Depreciation | null;
    categories: Option[];
    locations: Option[];
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const can = useCan();
    const assetForm = useAssetForm(categories, locations);
    const row =
        'flex items-center justify-between gap-4 rounded-lg border px-4 py-3';

    return (
        <>
            <Head title={item.name} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">{item.name}</h1>
                        <div className="mt-1 flex items-center gap-2">
                            <IdBadge>{item.serial_code}</IdBadge>
                            <StatusBadge status={item.status} />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {can('edit-assets') && (
                            <Button
                                variant="outline"
                                onClick={() => assetForm.openForm(item)}
                            >
                                <SquarePen /> {t('Edit')}
                            </Button>
                        )}
                        <Button variant="outline" asChild>
                            <Link href={assetRoutes.index()}>
                                <ArrowLeft className="rtl:rotate-180" />
                                {t('Back')}
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_22rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard icon={Package} title="Asset Details">
                            <div className="grid gap-6 sm:grid-cols-3">
                                <Fact icon={Layers} label="Category">
                                    {item.category.name}
                                </Fact>
                                <Fact icon={MapPin} label="Location">
                                    {item.location?.name ?? '-'}
                                </Fact>
                                <Fact icon={CalendarDays} label="Purchase Date">
                                    {date(item.purchase_date)}
                                </Fact>
                                <Fact icon={Hash} label="Quantity">
                                    {item.quantity}
                                </Fact>
                                <Fact icon={Hash} label="Unit Price">
                                    {money(Number(item.unit_price))}
                                </Fact>
                                <Fact icon={Hash} label="Purchase Cost">
                                    <span className="font-semibold">
                                        {money(Number(item.purchase_cost))}
                                    </span>
                                </Fact>
                            </div>
                            {item.description && (
                                <p className="mt-6 text-sm whitespace-pre-line text-muted-foreground">
                                    {item.description}
                                </p>
                            )}
                        </DocCard>

                        <DocCard icon={UserRound} title="Assignments">
                            {item.assignments.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t('Never assigned.')}
                                </p>
                            ) : (
                                <ul className="grid gap-2">
                                    {item.assignments.map((a) => (
                                        <li key={a.id} className={row}>
                                            <PersonCell
                                                name={a.assignee.name}
                                                detail={`${date(a.assigned_date)} → ${a.returned_date ? date(a.returned_date) : a.expected_return_date ? date(a.expected_return_date) : t('Open-ended')}`}
                                            />
                                            <div className="flex gap-2">
                                                <StatusBadge
                                                    status={a.condition}
                                                />
                                                <StatusBadge
                                                    status={a.status}
                                                />
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </DocCard>

                        <DocCard icon={Wrench} title="Maintenance">
                            {item.maintenances.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t('No maintenance recorded.')}
                                </p>
                            ) : (
                                <ul className="grid gap-2">
                                    {item.maintenances.map((m) => (
                                        <li key={m.id} className={row}>
                                            <div className="min-w-0">
                                                <div className="font-medium">
                                                    {m.title}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {date(m.scheduled_date)}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <StatusBadge
                                                    status={m.maintenance_type}
                                                />
                                                <StatusBadge
                                                    status={m.status}
                                                />
                                                <span className="w-24 text-end font-semibold tabular-nums">
                                                    {money(Number(m.cost))}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </DocCard>
                    </div>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={TrendingDown} title="Depreciation">
                            {depreciation === null ? (
                                <div className="grid gap-3 text-sm text-muted-foreground">
                                    {t('No depreciation schedule yet.')}
                                    {can('manage-asset-depreciation') && (
                                        <Button variant="outline" asChild>
                                            <Link
                                                href={asset.assetDepreciation.index()}
                                            >
                                                {t('Set Up Depreciation')}
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid gap-4 text-sm">
                                    <div>
                                        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                            {t('Book Value')}
                                        </div>
                                        <div className="text-3xl font-bold">
                                            {money(
                                                Number(depreciation.book_value),
                                            )}
                                        </div>
                                        <div className="mt-1">
                                            <StatusBadge
                                                status={depreciation.status}
                                            />
                                        </div>
                                    </div>
                                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                                        <dt className="text-muted-foreground">
                                            {t('Method')}
                                        </dt>
                                        <dd className="text-end">
                                            {t(METHODS[depreciation.method])}
                                        </dd>
                                        <dt className="text-muted-foreground">
                                            {t('Useful Life')}
                                        </dt>
                                        <dd className="text-end">
                                            {t(':count years', {
                                                count: depreciation.useful_life_years,
                                            })}
                                        </dd>
                                        <dt className="text-muted-foreground">
                                            {t('Salvage Value')}
                                        </dt>
                                        <dd className="text-end">
                                            {money(
                                                Number(
                                                    depreciation.salvage_value,
                                                ),
                                            )}
                                        </dd>
                                        <dt className="text-muted-foreground">
                                            {t('Accumulated')}
                                        </dt>
                                        <dd className="text-end">
                                            {money(
                                                Number(
                                                    depreciation.accumulated,
                                                ),
                                            )}
                                        </dd>
                                        <dt className="text-muted-foreground">
                                            {t('Posted to Ledger')}
                                        </dt>
                                        <dd className="text-end">
                                            {money(
                                                Number(
                                                    depreciation.posted_amount,
                                                ),
                                            )}
                                        </dd>
                                    </dl>
                                    <table className="w-full text-sm">
                                        <thead className="text-xs text-muted-foreground">
                                            <tr>
                                                <th className="py-1 text-start font-medium">
                                                    {t('Year')}
                                                </th>
                                                <th className="py-1 text-start font-medium">
                                                    {t('From')}
                                                </th>
                                                <th className="py-1 text-end font-medium">
                                                    {t('Depreciation')}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {depreciation.schedule.map((y) => (
                                                <tr
                                                    key={y.year}
                                                    className="border-t"
                                                >
                                                    <td className="py-1.5">
                                                        {y.year}
                                                    </td>
                                                    <td className="py-1.5">
                                                        {date(y.from)}
                                                    </td>
                                                    <td className="py-1.5 text-end tabular-nums">
                                                        {money(
                                                            Number(y.amount),
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </DocCard>
                    </div>
                </div>
            </div>
            {assetForm.dialog}
        </>
    );
}

AssetShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Assets', href: assetRoutes.index() },
        { title: 'Asset Details', href: assetRoutes.index() },
    ],
};
