import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { FlashToast } from '@/types/ui';

export function useFlashToast(): void {
    // Workflow actions (approve, clear, process...) report a refused transition as a `status` error.
    useEffect(() => {
        return router.on('error', (event) => {
            const message = (event as CustomEvent).detail?.errors?.status;

            if (typeof message === 'string') {
                toast.error(message);
            }
        });
    }, []);

    useEffect(() => {
        return router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;
            const data = flash?.toast as FlashToast | undefined;

            if (!data) {
                return;
            }

            toast[data.type](data.message);
        });
    }, []);
}
