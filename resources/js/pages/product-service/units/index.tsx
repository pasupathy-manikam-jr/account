import { Head } from '@inertiajs/react';
import { Ruler } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ProductServiceSetupLayout } from '@/components/product-service-setup-nav';
import { SetupCrud } from '@/components/setup-crud';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import productService from '@/routes/product-service';

type Unit = { id: number; unit_name: string; items_count: number };

export default function Units({ units }: { units: Unit[] }) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Units')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="System Setup"
                    description="Manage your product and service system configurations, categories, taxes, and units."
                />
                <ProductServiceSetupLayout>
                    <SetupCrud
                        title="Units"
                        singular="Unit"
                        icon={Ruler}
                        rows={units}
                        permission="product-service-units"
                        routes={productService.units}
                        inUse={(row) => row.items_count > 0}
                        fields={[{ key: 'unit_name', label: 'Unit Name' }]}
                        columns={[
                            {
                                label: 'Unit Name',
                                render: (row) => (
                                    <span className="font-medium">
                                        {row.unit_name}
                                    </span>
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

Units.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Product & Service', href: productService.items.index() },
        { title: 'System Setup', href: productService.itemCategories.index() },
        { title: 'Units', href: productService.units.index() },
    ],
};
