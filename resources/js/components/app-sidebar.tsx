import { Link } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState } from 'react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInput,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useTranslation } from '@/hooks/use-translation';
import { navigation } from '@/lib/navigation';
import { dashboard } from '@/routes';

export function AppSidebar() {
    const [query, setQuery] = useState('');
    const { t, isRtl } = useTranslation();

    return (
        <Sidebar
            collapsible="icon"
            variant="inset"
            side={isRtl ? 'right' : 'left'}
        >
            <SidebarHeader className="gap-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                <div className="relative group-data-[collapsible=icon]:hidden">
                    <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <SidebarInput
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('Search menu...')}
                        aria-label={t('Search menu...')}
                        className="h-9 ps-8 text-foreground placeholder:text-muted-foreground"
                    />
                </div>
            </SidebarHeader>

            <SidebarContent>
                <NavMain sections={navigation} query={query} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
