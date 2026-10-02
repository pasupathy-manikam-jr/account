import { Head } from '@inertiajs/react';
import { Percent } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ProductServiceSetupLayout } from '@/components/product-service-setup-nav';
import { SetupCrud } from '@/components/setup-crud';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import productService from '@/routes/product-service';

type Tax = {
    id: number;
    tax_name: string;
    rate: string;
    type_code: string | null;
    items_count: number;
};

export default function Taxes({
    taxes,
    typeCodes,
}: {
    taxes: Tax[];
    /** LHDN e-invoice tax types, code => name */
    typeCodes: Record<string, string>;
}) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Taxes')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="System Setup"
                    description="Manage your product and service system configurations, categories, taxes, and units."
                />
                <ProductServiceSetupLayout>
                    <SetupCrud
                        title="Taxes"
                        singular="Tax"
                        icon={Percent}
                        rows={taxes}
                        permission="product-service-taxes"
                        routes={productService.taxes}
                        inUse={(row) => row.items_count > 0}
                        fields={[
                            { key: 'tax_name', label: 'Tax Name' },
                            { key: 'rate', label: 'Rate (%)', type: 'decimal' },
                            {
                                key: 'type_code',
                                label: 'LHDN Tax Type',
                                options: Object.entries(typeCodes),
                            },
                        ]}
                        columns={[
                            {
                                label: 'Tax Name',
                                render: (row) => (
                                    <span className="font-medium">
                                        {row.tax_name}
                                    </span>
                                ),
                            },
                            {
                                label: 'Rate (%)',
                                render: (row) => `${Number(row.rate)}%`,
                            },
                            {
                                label: 'LHDN Tax Type',
                                render: (row) =>
                                    row.type_code ? (
                                        typeCodes[row.type_code]
                                    ) : (
                                        <span className="text-destructive">
                                            {t('Not set')}
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

Taxes.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Product & Service', href: productService.items.index() },
        { title: 'System Setup', href: productService.itemCategories.index() },
        { title: 'Taxes', href: productService.taxes.index() },
    ],
};
