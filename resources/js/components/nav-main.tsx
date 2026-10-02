import { Link, usePage } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavItem, NavMenuItem, NavSection } from '@/types';
import { useTranslation } from '@/hooks/use-translation';
import { toUrl } from '@/lib/utils';

const matches = (title: string, query: string) =>
    title.toLowerCase().includes(query);

// Drops entries the user lacks permission for, and parents left without children.
function allowedSections(
    sections: NavSection[],
    permissions: string[],
): NavSection[] {
    const can = (permission?: string) =>
        !permission || permissions.includes(permission);

    return sections
        .map((section) => ({
            ...section,
            items: section.items.flatMap((item): NavMenuItem[] => {
                if (!item.children) {
                    return can(item.permission) ? [item] : [];
                }

                const children = item.children.flatMap((child): NavItem[] => {
                    if (!child.children) {
                        return can(child.permission) ? [child] : [];
                    }

                    const pages = child.children.filter((page) =>
                        can(page.permission),
                    );

                    return pages.length
                        ? [{ ...child, href: pages[0].href, children: pages }]
                        : [];
                });

                return children.length ? [{ ...item, children }] : [];
            }),
        }))
        .filter((section) => section.items.length > 0);
}

// Keeps sections/items whose title (or any child title) matches the query.
function filterSections(sections: NavSection[], query: string): NavSection[] {
    if (!query) {
        return sections;
    }

    return sections
        .map((section) => ({
            ...section,
            items: section.items.flatMap((item): NavMenuItem[] => {
                if (matches(item.title, query) || !item.children) {
                    return matches(item.title, query) ? [item] : [];
                }

                const children = item.children.flatMap((child): NavItem[] => {
                    if (matches(child.title, query) || !child.children) {
                        return matches(child.title, query) ? [child] : [];
                    }

                    const pages = child.children.filter((page) =>
                        matches(page.title, query),
                    );

                    return pages.length ? [{ ...child, children: pages }] : [];
                });

                return children.length ? [{ ...item, children }] : [];
            }),
        }))
        .filter((section) => section.items.length > 0);
}

export function NavMain({
    sections,
    query = '',
}: {
    sections: NavSection[];
    query?: string;
}) {
    const { currentUrl } = useCurrentUrl();
    // A page under an entry (e.g. an account's detail page) keeps that entry active.
    const isCurrentUrl = (href: NavItem['href']) => {
        const path = new URL(toUrl(href), 'http://localhost').pathname;

        return currentUrl === path || currentUrl.startsWith(`${path}/`);
    };
    const isActive = (
        entry: Pick<NavItem, 'href' | 'match' | 'children'>,
    ): boolean =>
        entry.children
            ? entry.children.some((page) => isActive(page))
            : [entry.href, ...(entry.match ?? [])].some(isCurrentUrl);
    const { auth } = usePage().props;
    const { t } = useTranslation();
    const search = query.trim().toLowerCase();
    const visible = filterSections(
        allowedSections(sections, auth.permissions),
        search,
    );
    // Accordion: one group open at a time, starting with the one holding the current page.
    const [openGroup, setOpenGroup] = useState<string | null>(
        () =>
            visible
                .flatMap((section) => section.items)
                .find((item) => item.children?.some((child) => isActive(child)))
                ?.title ?? null,
    );

    // On load, scroll the sidebar so the current page's entry sits in the middle, not below the fold.
    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            const active = document.querySelector<HTMLElement>(
                '[data-sidebar="content"] [data-active="true"]',
            );
            const container = active?.closest<HTMLElement>(
                '[data-sidebar="content"]',
            );

            if (active && container) {
                const offset =
                    active.getBoundingClientRect().top -
                    container.getBoundingClientRect().top;
                container.scrollTop +=
                    offset -
                    container.clientHeight / 2 +
                    active.offsetHeight / 2;
            }
        });

        return () => cancelAnimationFrame(frame);
    }, []);

    return visible.map((section) => (
        <SidebarGroup key={section.title} className="px-2 py-1">
            <SidebarGroupLabel className="text-[13px] font-semibold text-sidebar-foreground/70">
                {t(section.title)}
            </SidebarGroupLabel>
            <SidebarMenu>
                {section.items.map((item) =>
                    item.children ? (
                        <Collapsible
                            key={item.title}
                            asChild
                            // While searching every matching group is open; otherwise only one at a time.
                            open={!!search || openGroup === item.title}
                            onOpenChange={(open) =>
                                setOpenGroup(open ? item.title : null)
                            }
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton
                                        tooltip={{ children: t(item.title) }}
                                    >
                                        {item.icon && <item.icon />}
                                        <span>{t(item.title)}</span>
                                        <ChevronRight className="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {item.children.map((child) =>
                                            child.children ? (
                                                <NavSubGroup
                                                    key={child.title}
                                                    group={child}
                                                    forceOpen={!!search}
                                                    isActive={isActive}
                                                />
                                            ) : (
                                                <SidebarMenuSubItem
                                                    key={child.title}
                                                >
                                                    <SidebarMenuSubButton
                                                        asChild
                                                        className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                                                        isActive={isActive(
                                                            child,
                                                        )}
                                                    >
                                                        {child.external ? (
                                                            <a
                                                                href={toUrl(
                                                                    child.href,
                                                                )}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                <span>
                                                                    {t(
                                                                        child.title,
                                                                    )}
                                                                </span>
                                                            </a>
                                                        ) : (
                                                            <Link
                                                                href={
                                                                    child.href
                                                                }
                                                                prefetch
                                                            >
                                                                <span>
                                                                    {t(
                                                                        child.title,
                                                                    )}
                                                                </span>
                                                            </Link>
                                                        )}
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            ),
                                        )}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    ) : (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={isActive(item)}
                                className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                                tooltip={{ children: t(item.title) }}
                            >
                                {item.external ? (
                                    <a
                                        href={toUrl(item.href)}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {item.icon && <item.icon />}
                                        <span>{t(item.title)}</span>
                                    </a>
                                ) : (
                                    <Link href={item.href} prefetch>
                                        {item.icon && <item.icon />}
                                        <span>{t(item.title)}</span>
                                    </Link>
                                )}
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ),
                )}
            </SidebarMenu>
        </SidebarGroup>
    ));
}

/** A group inside a menu (Accounting › Banking): its own toggle, open while one of its pages is current. */
function NavSubGroup({
    group,
    forceOpen,
    isActive,
}: {
    group: NavItem;
    forceOpen: boolean;
    isActive: (entry: NavItem) => boolean;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(() => isActive(group));

    return (
        <Collapsible
            open={forceOpen || open}
            onOpenChange={setOpen}
            className="group/subgroup"
        >
            <SidebarMenuSubItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuSubButton className="cursor-pointer">
                        <span>{t(group.title)}</span>
                        <ChevronRight className="ms-auto transition-transform duration-200 group-data-[state=open]/subgroup:rotate-90 rtl:rotate-180" />
                    </SidebarMenuSubButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub className="me-0 pe-0">
                        {group.children?.map((page) => (
                            <SidebarMenuSubItem key={page.title}>
                                <SidebarMenuSubButton
                                    asChild
                                    className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                                    isActive={isActive(page)}
                                >
                                    <Link href={page.href} prefetch>
                                        <span>{t(page.title)}</span>
                                    </Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuSubItem>
        </Collapsible>
    );
}
