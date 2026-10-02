import { Head, usePage } from '@inertiajs/react';
import { LayoutGrid } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';

/** Welcome page for staff, clients and vendors until their own dashboards are built. */
export default function Dashboard() {
    const { t } = useTranslation();
    const { auth } = usePage().props;

    return (
        <>
            <Head title={t('Dashboard')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex items-center gap-4 rounded-xl border bg-card p-6">
                    <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <LayoutGrid className="size-6" />
                    </span>
                    <div>
                        <h1 className="text-2xl font-bold">
                            {t('Welcome, :name', { name: auth.user.name })}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'Use the menu to open the modules available to you.',
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Dashboard', href: dashboard() }],
};
