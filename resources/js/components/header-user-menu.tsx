import { usePage } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/hooks/use-translation';

/** The avatar menu at the top right of the header (profile, settings, log out), as in the demo. */
export function HeaderUserMenu() {
    const { auth } = usePage().props;
    const { t } = useTranslation();
    const getInitials = useInitials();

    if (!auth.user) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className="flex items-center gap-1 rounded-full p-0.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t('Profile menu')}
                data-test="header-user-menu"
            >
                <Avatar className="size-9 overflow-hidden rounded-full">
                    <AvatarImage src={auth.user.avatar} alt={auth.user.name} />
                    <AvatarFallback className="rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {getInitials(auth.user.name)}
                    </AvatarFallback>
                </Avatar>
                <ChevronDown className="me-1 size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-56 rounded-lg" align="end">
                <UserMenuContent user={auth.user} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
