import { router } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { CircleCheck, Lock, Play } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';

type Href = NonNullable<InertiaLinkProps['href']>;
type Action = 'approve' | 'activate' | 'close';

// The draft → approved → active → closed steps shared by budget periods and budgets.
const STEPS: Record<
    Action,
    {
        from: string;
        permission: string;
        icon: LucideIcon;
        label: string;
        className: string;
    }
> = {
    approve: {
        from: 'draft',
        permission: 'approve',
        icon: CircleCheck,
        label: 'Approve',
        className: 'text-emerald-600',
    },
    activate: {
        from: 'approved',
        permission: 'active',
        icon: Play,
        label: 'Activate',
        className: 'text-sky-600',
    },
    close: {
        from: 'active',
        permission: 'close',
        icon: Lock,
        label: 'Close',
        className: 'text-amber-600',
    },
};

const TITLES: Record<Action, string> = {
    approve: 'Approve it?',
    activate: 'Activate it?',
    close: 'Close it?',
};

const DESCRIPTIONS: Record<Action, string> = {
    approve: 'Approving locks the plan: it can no longer be edited or deleted.',
    activate: 'Activating puts it in use, so spending is measured against it.',
    close: 'Closing ends it. It stays in the records for reporting.',
};

/**
 * Icon buttons for the next workflow step, plus the confirm dialog they open.
 * `resource` is the permission suffix (budget-periods / budgets); `route(action, id)` builds the URL.
 */
export function useWorkflow(
    resource: string,
    route: (action: Action, id: number) => Href,
) {
    const { t } = useTranslation();
    const can = useCan();
    const [pending, setPending] = useState<{
        id: number;
        action: Action;
    } | null>(null);

    const buttons = (record: { id: number; status: string }) =>
        (Object.keys(STEPS) as Action[])
            .filter(
                (action) =>
                    STEPS[action].from === record.status &&
                    can(`${STEPS[action].permission}-${resource}`),
            )
            .map((action) => {
                const { icon: Icon, label, className } = STEPS[action];

                return (
                    <Button
                        key={action}
                        variant="ghost"
                        size="icon"
                        aria-label={t(label)}
                        title={t(label)}
                        onClick={() => setPending({ id: record.id, action })}
                    >
                        <Icon className={className} />
                    </Button>
                );
            });

    const dialog = (
        <ConfirmDialog
            open={pending !== null}
            onOpenChange={(open) => !open && setPending(null)}
            icon={pending ? STEPS[pending.action].icon : undefined}
            title={pending ? TITLES[pending.action] : ''}
            description={pending ? DESCRIPTIONS[pending.action] : ''}
            confirmLabel={pending ? STEPS[pending.action].label : ''}
            onConfirm={() =>
                pending &&
                router.put(
                    route(pending.action, pending.id),
                    {},
                    {
                        preserveScroll: true,
                        onFinish: () => setPending(null),
                    },
                )
            }
        />
    );

    return { buttons, dialog };
}
