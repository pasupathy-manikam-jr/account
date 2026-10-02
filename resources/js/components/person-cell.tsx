import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';

/** A person in a table cell: initials avatar, name, and a detail line (email, company…). */
export function PersonCell({
    name,
    detail,
}: {
    name: string;
    detail?: string | null;
}) {
    const initials = useInitials();

    return (
        <div
            className="flex max-w-48 items-center gap-3"
            title={detail ? `${name}\n${detail}` : name}
        >
            <Avatar className="size-9">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials(name)}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <div className="truncate font-medium">{name}</div>
                {detail && (
                    <div className="truncate text-xs text-muted-foreground">
                        {detail}
                    </div>
                )}
            </div>
        </div>
    );
}
