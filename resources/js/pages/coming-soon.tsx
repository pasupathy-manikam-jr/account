import { Head, Link } from '@inertiajs/react';
import { Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dashboard } from '@/routes';
import { useTranslation } from '@/hooks/use-translation';

export default function ComingSoon({ title }: { title: string }) {
    const { t } = useTranslation();
    return (
        <>
            <Head title={t(title)} />
            <div className="flex flex-1 flex-col p-6">
                <h1 className="text-2xl font-bold">{t(title)}</h1>
                <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
                    <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
                        <Construction className="size-7 text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold">
                        {t(':title is coming soon', { title: t(title) })}
                    </h2>
                    <p className="mt-1 mb-6 text-sm text-muted-foreground">
                        {t("This module hasn't been built yet.")}
                    </p>
                    <Button asChild variant="outline">
                        <Link href={dashboard()}>{t('Back to Dashboard')}</Link>
                    </Button>
                </div>
            </div>
        </>
    );
}
