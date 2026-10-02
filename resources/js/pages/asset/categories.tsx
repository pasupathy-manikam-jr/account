import { Head } from '@inertiajs/react';
import { FolderOpen } from 'lucide-react';
import { InlineCrud } from '@/components/inline-crud';
import { PageHeader } from '@/components/page-header';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import asset from '@/routes/asset';
import assets from '@/routes/assets';

type Category = { id: number; name: string; assets_count: number };

export default function AssetCategories({
    categories,
}: {
    categories: Category[];
}) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Categories')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Categories"
                    description="Organize and classify your assets using distinct categories for better structure and easier reporting."
                />
                <InlineCrud
                    singular="Category"
                    rows={categories}
                    icon={FolderOpen}
                    permission="asset-categories"
                    routes={asset.categories}
                    searchKeys={['name']}
                    inUse={(row) => row.assets_count > 0}
                    fields={[
                        {
                            key: 'name',
                            label: 'Name',
                            required: true,
                            placeholder: 'Enter Name',
                        },
                    ]}
                    columns={[
                        {
                            label: 'Name',
                            render: (row) => (
                                <span className="font-medium">{row.name}</span>
                            ),
                        },
                    ]}
                />
            </div>
        </>
    );
}

AssetCategories.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Assets', href: assets.index() },
        { title: 'Categories', href: asset.categories.index() },
    ],
};
