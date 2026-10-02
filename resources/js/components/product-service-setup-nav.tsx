import { Link } from '@inertiajs/react';
import { Percent, Ruler, Tag } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCan } from '@/hooks/use-can';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import productService from '@/routes/product-service';

const TABS = [
    {
        title: 'Category',
        href: productService.itemCategories.index(),
        permission: 'manage-product-service-categories',
        icon: Tag,
    },
    {
        title: 'Taxes',
        href: productService.taxes.index(),
        permission: 'manage-product-service-taxes',
        icon: Percent,
    },
    {
        title: 'Units',
        href: productService.units.index(),
        permission: 'manage-product-service-units',
        icon: Ruler,
    },
];

/** The demo's Product & Service → System Setup screen: a tab card on the left, the current list on the right. */
export function ProductServiceSetupLayout({
    children,
}: {
    children: ReactNode;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <div className="grid items-start gap-6 lg:grid-cols-[16rem_1fr]">
            <nav className="grid gap-1 rounded-xl border bg-card p-3">
                {TABS.filter((tab) => can(tab.permission)).map((tab) => {
                    const active = isCurrentUrl(tab.href);

                    return (
                        <Link
                            key={tab.title}
                            href={tab.href}
                            prefetch
                            className={cn(
                                'flex items-center gap-3 rounded-md border-s-4 px-3 py-2.5 text-sm font-medium transition-colors',
                                active
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            <tab.icon className="size-4" />
                            {t(tab.title)}
                        </Link>
                    );
                })}
            </nav>
            <div className="min-w-0 rounded-xl border bg-card p-6">
                {children}
            </div>
        </div>
    );
}
