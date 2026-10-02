import { router, usePage } from '@inertiajs/react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { update } from '@/routes/locale';

// Regional-indicator emoji from an ISO country code, e.g. "GB" -> 🇬🇧.
const flag = (countryCode: string) =>
    String.fromCodePoint(
        ...countryCode.split('').map((c) => 0x1f1a5 + c.charCodeAt(0)),
    );

export function LanguageSwitcher() {
    const { locale, locales } = usePage().props;
    const [name, country] = locales[locale] ?? locales.en;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Globe />
                    <span className="hidden sm:inline">{name}</span>
                    <span aria-hidden>{flag(country)}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="max-h-96 overflow-y-auto"
            >
                {Object.entries(locales).map(([code, [label, countryCode]]) => (
                    <DropdownMenuItem
                        key={code}
                        onSelect={() =>
                            router.post(
                                update(),
                                { locale: code },
                                { preserveScroll: true },
                            )
                        }
                        className={
                            code === locale ? 'font-semibold text-primary' : ''
                        }
                    >
                        <span aria-hidden>{flag(countryCode)}</span>
                        {label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
