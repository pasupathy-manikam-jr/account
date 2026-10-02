import { Head } from '@inertiajs/react';
import { Tag } from 'lucide-react';
import { InlineCrud } from '@/components/inline-crud';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import goalRoutes from '@/routes/goal';

type Category = {
    id: number;
    category_name: string;
    category_code: string;
    description: string | null;
    is_active: boolean;
    goals_count: number;
};

export default function GoalCategories({
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
                    description="Manage and organize goal categories, codes, descriptions, and status settings."
                />
                <InlineCrud
                    singular="Category"
                    rows={categories}
                    icon={Tag}
                    permission="categories"
                    routes={goalRoutes.categories}
                    searchKeys={[
                        'category_name',
                        'category_code',
                        'description',
                    ]}
                    statusKey="is_active"
                    inUse={(row) => row.goals_count > 0}
                    fields={[
                        {
                            key: 'category_name',
                            label: 'Category Name',
                            required: true,
                            placeholder: 'Enter category name',
                        },
                        {
                            key: 'category_code',
                            label: 'Category Code',
                            required: true,
                            placeholder: 'Enter category code',
                        },
                        {
                            key: 'description',
                            label: 'Description',
                            type: 'textarea',
                            placeholder: 'Enter description',
                        },
                        {
                            key: 'is_active',
                            label: 'Status',
                            type: 'switch',
                            hint: 'Active categories can be chosen for goals.',
                        },
                    ]}
                    columns={[
                        {
                            label: 'Category',
                            render: (row) => (
                                <div className="max-w-md">
                                    <div className="font-medium">
                                        {row.category_name}
                                    </div>
                                    {row.description && (
                                        <div className="text-xs text-muted-foreground">
                                            {row.description}
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                        {
                            label: 'Code',
                            render: (row) => (
                                <IdBadge>{row.category_code}</IdBadge>
                            ),
                        },
                        {
                            label: 'Status',
                            render: (row) => (
                                <StatusBadge
                                    status={
                                        row.is_active ? 'active' : 'inactive'
                                    }
                                />
                            ),
                        },
                    ]}
                />
            </div>
        </>
    );
}

GoalCategories.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Goal', href: goalRoutes.goals.index() },
        { title: 'Categories', href: goalRoutes.categories.index() },
    ],
};
