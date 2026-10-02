import { Head, Link, router } from '@inertiajs/react';
import { Eye, Plus, ShoppingCart, SquarePen, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { CategoryBadge, ItemThumb } from '@/components/item-cells';
import { PageHeader } from '@/components/page-header';
import { FilterSelect } from '@/components/table-filters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import productService from '@/routes/product-service';
import type { Paginated, TableFilters } from '@/types';

export type ItemRow = {
    id: number;
    name: string;
    sku: string;
    type: 'product' | 'service' | 'part';
    sale_price: string;
    purchase_price: string;
    image_url: string | null;
    is_active: boolean;
    total_quantity: string | null;
    category: { id: number; name: string; color: string };
    unit: { id: number; unit_name: string };
};

const typeLabel = (type: string) =>
    type.charAt(0).toUpperCase() + type.slice(1);

export default function Items({
    items,
    categories,
    filters,
}: {
    items: Paginated<ItemRow>;
    categories: { id: number; name: string }[];
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const can = useCan();
    const [deleting, setDeleting] = useState<ItemRow | null>(null);
    const url = productService.items.index();

    const quantity = (item: ItemRow) =>
        item.type === 'service' ? (
            <span className="text-muted-foreground">—</span>
        ) : (
            <Badge
                variant="outline"
                className="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
            >
                <ShoppingCart className="size-3" />
                {Number(item.total_quantity ?? 0)}
            </Badge>
        );

    const columns: Column<ItemRow>[] = [
        {
            key: 'name',
            label: 'Product',
            sortable: true,
            render: (item) => (
                <div className="flex items-center gap-3">
                    <ItemThumb item={item} />
                    <div className="min-w-0">
                        <div className="font-medium">{item.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Tag className="size-3" />
                            {item.sku}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            key: 'sale_price',
            label: 'Sale Price',
            sortable: true,
            render: (item) => (
                <span className="font-semibold whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                    {money(Number(item.sale_price))}
                </span>
            ),
        },
        {
            key: 'purchase_price',
            label: 'Purchase Price',
            sortable: true,
            render: (item) => (
                <span className="font-semibold whitespace-nowrap text-orange-600 dark:text-orange-400">
                    {money(Number(item.purchase_price))}
                </span>
            ),
        },
        {
            key: 'category',
            label: 'Category',
            render: (item) => <CategoryBadge category={item.category} />,
        },
        {
            key: 'unit',
            label: 'Unit',
            render: (item) => (
                <Badge variant="outline">{item.unit.unit_name}</Badge>
            ),
        },
        { key: 'quantity', label: 'Quantity', render: quantity },
        {
            key: 'type',
            label: 'Type',
            sortable: true,
            render: (item) => (
                <Badge
                    variant="outline"
                    className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
                >
                    {t(typeLabel(item.type))}
                </Badge>
            ),
        },
    ];

    const actions = (item: ItemRow) => (
        <>
            {can('view-product-service-item') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('View')}
                    asChild
                >
                    <Link href={productService.items.show(item.id)}>
                        <Eye className="text-emerald-600" />
                    </Link>
                </Button>
            )}
            {can('edit-product-service-item') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Edit')}
                    asChild
                >
                    <Link href={productService.items.edit(item.id)}>
                        <SquarePen className="text-blue-600" />
                    </Link>
                </Button>
            )}
            {can('delete-product-service-item') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Delete')}
                    onClick={() => setDeleting(item)}
                >
                    <Trash2 className="text-destructive" />
                </Button>
            )}
        </>
    );

    return (
        <>
            <Head title={t('Items')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Items"
                    description="Manage and track your products, services, pricing, and stock details."
                    action={
                        can('create-product-service-item') && (
                            <Button asChild>
                                <Link href={productService.items.create()}>
                                    <Plus /> {t('Add Item')}
                                </Link>
                            </Button>
                        )
                    }
                />

                <DataTable
                    data={items}
                    columns={columns}
                    filters={filters}
                    url={url}
                    moreFilters={
                        <>
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="category_id"
                                label="All Categories"
                                options={categories}
                            />
                            <FilterSelect
                                url={url}
                                filters={filters}
                                name="type"
                                label="All Types"
                                options={['product', 'service', 'part'].map(
                                    (type) => ({
                                        id: type,
                                        name: t(typeLabel(type)),
                                    }),
                                )}
                            />
                        </>
                    }
                    actions={actions}
                    renderCard={(item, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            <div className="flex items-start gap-3">
                                <ItemThumb item={item} className="size-14" />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate font-semibold">
                                        {item.name}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Tag className="size-3" />
                                        {item.sku}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <CategoryBadge category={item.category} />
                                <Badge variant="outline">
                                    {item.unit.unit_name}
                                </Badge>
                                {quantity(item)}
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Sale Price')}
                                    </div>
                                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        {money(Number(item.sale_price))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Purchase Price')}
                                    </div>
                                    <div className="font-semibold text-orange-600 dark:text-orange-400">
                                        {money(Number(item.purchase_price))}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                />
            </div>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This item and its stock records will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(productService.items.destroy(deleting.id), {
                        preserveScroll: true,
                        onSuccess: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

Items.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Product & Service', href: productService.items.index() },
        { title: 'Items', href: productService.items.index() },
    ],
};
