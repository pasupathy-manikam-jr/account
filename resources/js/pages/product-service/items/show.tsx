import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, PackagePlus, SquarePen, Tag } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { CategoryBadge, ItemThumb } from '@/components/item-cells';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import productService from '@/routes/product-service';

type Item = {
    id: number;
    name: string;
    sku: string;
    type: string;
    sale_price: string;
    purchase_price: string;
    description: string | null;
    long_description: string | null;
    is_active: boolean;
    image_url: string | null;
    total_quantity: string | null;
    category: { name: string; color: string };
    unit: { unit_name: string };
    taxes: { id: number; tax_name: string; rate: string }[];
    stocks: {
        id: number;
        quantity: string;
        warehouse: { id: number; name: string; city: string | null };
    }[];
};

const typeLabel = (type: string) =>
    type.charAt(0).toUpperCase() + type.slice(1);

export default function ItemShow({
    item,
    warehouses,
}: {
    item: Item;
    warehouses: { id: number; name: string }[];
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const can = useCan();
    const [stockOpen, setStockOpen] = useState(false);
    const stockForm = useForm({ warehouse_id: '', quantity: '' });
    const stocked = item.type !== 'service';

    const facts: [string, ReactNode][] = [
        ['Type', t(typeLabel(item.type))],
        ['Category', <CategoryBadge key="c" category={item.category} />],
        ['Unit', item.unit.unit_name],
        [
            'Sale Price',
            <span key="s" className="text-emerald-600">
                {money(Number(item.sale_price))}
            </span>,
        ],
        [
            'Purchase Price',
            <span key="p" className="text-orange-600">
                {money(Number(item.purchase_price))}
            </span>,
        ],
        [
            'Status',
            <StatusBadge
                key="st"
                status={item.is_active ? 'active' : 'inactive'}
            />,
        ],
    ];

    return (
        <>
            <Head title={item.name} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title={item.name}
                    description={item.description ?? undefined}
                    action={
                        <div className="flex gap-2">
                            {stocked && can('create-stock') && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        stockForm.reset();
                                        stockForm.clearErrors();
                                        setStockOpen(true);
                                    }}
                                >
                                    <PackagePlus /> {t('Add Stock')}
                                </Button>
                            )}
                            {can('edit-product-service-item') && (
                                <Button variant="outline" asChild>
                                    <Link
                                        href={productService.items.edit(
                                            item.id,
                                        )}
                                    >
                                        <SquarePen /> {t('Edit')}
                                    </Link>
                                </Button>
                            )}
                            <Button variant="outline" asChild>
                                <Link href={productService.items.index()}>
                                    <ArrowLeft className="rtl:rotate-180" />
                                    {t('Back')}
                                </Link>
                            </Button>
                        </div>
                    }
                />

                <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
                    <div className="overflow-hidden rounded-xl border bg-card">
                        <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                            <ItemThumb
                                item={item}
                                className="size-full rounded-none border-0"
                            />
                        </div>
                        <div className="grid gap-4 p-6">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Tag className="size-4" />
                                {item.sku}
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
                    </div>

                    <div className="grid min-w-0 gap-6">
                        <div className="rounded-xl border bg-card p-6">
                            <h2 className="mb-3 text-lg font-semibold">
                                {t('Taxes')}
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {item.taxes.length === 0 && (
                                    <span className="text-sm text-muted-foreground">
                                        {t('No taxes applied.')}
                                    </span>
                                )}
                                {item.taxes.map((tax) => (
                                    <Badge key={tax.id} variant="outline">
                                        {tax.tax_name} ({Number(tax.rate)}%)
                                    </Badge>
                                ))}
                            </div>
                            {item.long_description && (
                                <>
                                    <h2 className="mt-6 mb-2 text-lg font-semibold">
                                        {t('Description')}
                                    </h2>
                                    <p className="text-sm whitespace-pre-line text-muted-foreground">
                                        {item.long_description}
                                    </p>
                                </>
                            )}
                        </div>

                        {stocked && (
                            <div className="rounded-xl border bg-card p-6">
                                <div className="mb-4 flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">
                                        {t('Warehouse Stock')}
                                    </h2>
                                    <span className="text-sm text-muted-foreground">
                                        {t('Total')}:{' '}
                                        <span className="font-semibold text-foreground">
                                            {Number(item.total_quantity ?? 0)}{' '}
                                            {item.unit.unit_name}
                                        </span>
                                    </span>
                                </div>
                                <div className="overflow-hidden rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>
                                                    {t('Warehouse')}
                                                </TableHead>
                                                <TableHead>
                                                    {t('City')}
                                                </TableHead>
                                                <TableHead className="text-end">
                                                    {t('Quantity')}
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {item.stocks.length === 0 && (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={3}
                                                        className="py-8 text-center text-muted-foreground"
                                                    >
                                                        {t(
                                                            'No stock in any warehouse yet.',
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {item.stocks.map((stock) => (
                                                <TableRow key={stock.id}>
                                                    <TableCell className="font-medium">
                                                        {stock.warehouse.name}
                                                    </TableCell>
                                                    <TableCell>
                                                        {stock.warehouse.city ??
                                                            '—'}
                                                    </TableCell>
                                                    <TableCell className="text-end font-semibold">
                                                        {Number(stock.quantity)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <FormDialog
                open={stockOpen}
                onOpenChange={setStockOpen}
                title="Add Stock"
                description="Receive stock into a warehouse. The quantity is added to what is already there."
                icon={PackagePlus}
                onSubmit={(e) => {
                    e.preventDefault();
                    stockForm.submit(productService.items.stock(item.id), {
                        preserveScroll: true,
                        onSuccess: () => setStockOpen(false),
                    });
                }}
                processing={stockForm.processing}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="stock-warehouse">
                            {t('Warehouse')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <SelectField
                            id="stock-warehouse"
                            value={stockForm.data.warehouse_id}
                            placeholder={t('Select Warehouse')}
                            onChange={(e) =>
                                stockForm.setData(
                                    'warehouse_id',
                                    e.target.value,
                                )
                            }
                        >
                            {warehouses.map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.name}
                                </option>
                            ))}
                        </SelectField>
                        <InputError message={stockForm.errors.warehouse_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="stock-quantity">
                            {t('Quantity')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="stock-quantity"
                            inputMode="decimal"
                            value={stockForm.data.quantity}
                            onChange={(e) =>
                                stockForm.setData('quantity', e.target.value)
                            }
                        />
                        <InputError message={stockForm.errors.quantity} />
                    </div>
                </div>
            </FormDialog>
        </>
    );
}

ItemShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Items', href: productService.items.index() },
        { title: 'View', href: productService.items.index() },
    ],
};
