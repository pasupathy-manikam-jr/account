import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** A category badge tinted with the category's own colour. */
export function CategoryBadge({
    category,
}: {
    category: { name: string; color: string };
}) {
    return (
        <Badge
            variant="outline"
            className="whitespace-nowrap"
            style={{
                color: category.color,
                borderColor: `${category.color}66`,
                backgroundColor: `${category.color}14`,
            }}
        >
            {category.name}
        </Badge>
    );
}

/** An item's image, or a package icon when it has none. */
export function ItemThumb({
    item,
    className = 'size-11',
}: {
    item: { name: string; image_url: string | null };
    className?: string;
}) {
    return item.image_url ? (
        <img
            src={item.image_url}
            alt={item.name}
            className={`${className} shrink-0 rounded-lg border object-cover`}
        />
    ) : (
        <span
            className={`${className} flex shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground`}
        >
            <Package className="size-1/2" />
        </span>
    );
}
