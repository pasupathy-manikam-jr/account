import { Head } from '@inertiajs/react';
import { PageHeader } from '@/components/page-header';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard, userManual } from '@/routes';

/** README.md rendered on the server; the text is our own file, never user input. */
export default function UserManual({ html }: { html: string }) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('User Manual')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="User Manual"
                    description="How to use each part of the system."
                />
                <article
                    dir="ltr"
                    className="max-w-4xl rounded-xl border bg-card p-6 text-sm leading-relaxed shadow-sm md:p-8 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:hidden [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_hr]:my-8 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:my-3 [&_table]:my-4 [&_table]:w-full [&_td]:border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_ul]:list-disc [&_ul]:ps-6"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </div>
        </>
    );
}

UserManual.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'User Manual', href: userManual() },
    ],
};
