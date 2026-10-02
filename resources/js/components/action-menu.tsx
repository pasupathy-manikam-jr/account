import type { LucideIcon } from 'lucide-react';
import { Ellipsis } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/use-translation';

export type ActionMenuItem = {
    label: string;
    icon: LucideIcon;
    onSelect?: () => void;
    /** A plain link (e.g. a download) instead of onSelect. */
    href?: string;
    destructive?: boolean;
    /** Leave the item out, e.g. when the user lacks the permission. */
    hidden?: boolean;
};

/** The demo's row "⋯" menu: one trigger that lists the record's actions. */
export function ActionMenu({
    items,
    trigger: Trigger = Ellipsis,
}: {
    items: ActionMenuItem[];
    trigger?: LucideIcon;
}) {
    const { t } = useTranslation();
    const visible = items.filter((item) => !item.hidden);

    if (visible.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    aria-label={t('Actions')}
                >
                    <Trigger />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {visible.map(
                    ({ label, icon: Icon, onSelect, href, destructive }) =>
                        href ? (
                            <DropdownMenuItem key={label} asChild>
                                <a href={href}>
                                    <Icon /> {t(label)}
                                </a>
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem
                                key={label}
                                variant={
                                    destructive ? 'destructive' : 'default'
                                }
                                onSelect={onSelect}
                            >
                                <Icon /> {t(label)}
                            </DropdownMenuItem>
                        ),
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
