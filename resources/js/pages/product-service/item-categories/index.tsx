import { Head } from '@inertiajs/react';
import { Tag } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ProductServiceSetupLayout } from '@/components/product-service-setup-nav';
import { SetupCrud } from '@/components/setup-crud';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import productService from '@/routes/product-service';

type Category = {
    id: number;
    name: string;
    color: string;
    items_count: number;
};

export default function ItemCategories({
    categories,
}: {
    categories: Category[];
}) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Category')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="System Setup"
                    description="Manage your product and service system configurations, categories, taxes, and units."
                />
                <ProductServiceSetupLayout>
                    <SetupCrud
                        title="Category"
                        singular="Category"
                        icon={Tag}
                        rows={categories}
                        permission="product-service-categories"
                        routes={productService.itemCategories}
                        inUse={(row) => row.items_count > 0}
                        fields={[
                            { key: 'name', label: 'Name' },
                            { key: 'color', label: 'Color', type: 'color' },
                        ]}
                        columns={[
                            {
                                label: 'Category',
                                render: (row) => (
                                    <span className="font-medium">
                                        {row.name}
                                    </span>
                                ),
                            },
                            {
                                label: 'Color',
                                render: (row) => (
                                    <span
                                        className="block size-6 rounded-md border"
                                        style={{ backgroundColor: row.color }}
                                        title={row.color}
                                    />
                                ),
                            },
                            {
                                label: 'Items',
                                render: (row) => row.items_count,
                            },
                        ]}
                    />
                </ProductServiceSetupLayout>
            </div>
        </>
    );
}

ItemCategories.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Product & Service', href: productService.items.index() },
        { title: 'System Setup', href: productService.itemCategories.index() },
        { title: 'Category', href: productService.itemCategories.index() },
    ],
};
