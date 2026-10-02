import { Head, Link } from '@inertiajs/react';
import { SquarePen } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { IdBadge } from '@/components/table-cells';
import { FilterSelect } from '@/components/table-filters';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import emailTemplates from '@/routes/email-templates';
import notificationTemplates from '@/routes/notification-templates';
import type { Paginated, TableFilters } from '@/types';

type Template = {
    id: number;
    slug: string;
    name: string;
    module: string;
    contents_count: number;
};

export const CHANNELS = {
    email: {
        routes: emailTemplates,
        permission: 'email-templates',
        title: 'Manage Email Templates',
        description:
            'The emails the system sends, in every language. Edit the wording; placeholders like {name} are filled in when it is sent.',
        crumb: 'Email Templates',
    },
    notification: {
        routes: notificationTemplates,
        permission: 'notification-templates',
        title: 'Manage Notification Templates',
        description:
            'The short in-app notification messages, in every language. Placeholders like {name} are filled in when it is shown.',
        crumb: 'Notification Templates',
    },
} as const;

export default function MessageTemplates({
    channel,
    templates,
    filters,
}: {
    channel: keyof typeof CHANNELS;
    templates: Paginated<Template>;
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const config = CHANNELS[channel];
    const url = config.routes.index();

    const columns: Column<Template>[] = [
        {
            key: 'name',
            label: channel === 'notification' ? 'Subject' : 'Name',
            sortable: true,
            render: (row) => (
                <div>
                    <div className="font-medium">{t(row.name)}</div>
                    <IdBadge>{row.slug}</IdBadge>
                </div>
            ),
        },
        {
            key: 'module',
            label: 'Module',
            sortable: true,
            render: (row) => <StatusBadge status={row.module} />,
        },
        {
            key: 'languages',
            label: 'Languages',
            render: (row) => t(':count of 4', { count: row.contents_count }),
        },
    ];

    return (
        <>
            <Head title={t(config.crumb)} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title={config.title}
                    description={config.description}
                />
                <DataTable
                    data={templates}
                    columns={columns}
                    filters={filters}
                    url={url}
                    toolbar={
                        <FilterSelect
                            url={url}
                            filters={filters}
                            name="module"
                            label="All Modules"
                            options={[
                                { id: 'general', name: t('General') },
                                { id: 'accounting', name: t('Accounting') },
                            ]}
                        />
                    }
                    actions={(row) =>
                        can(`edit-${config.permission}`) && (
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t('Edit')}
                                asChild
                            >
                                <Link href={config.routes.edit(row.id)}>
                                    <SquarePen className="text-blue-600" />
                                </Link>
                            </Button>
                        )
                    }
                />
            </div>
        </>
    );
}

MessageTemplates.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Communication', href: emailTemplates.index() },
    ],
};
