import { router, useForm } from '@inertiajs/react';
import { Ban, ExternalLink, FileCheck2, RefreshCw, Send } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { DocCard } from '@/components/sales-document';
import { FormDialog } from '@/components/form-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import einvoiceRoutes from '@/routes/einvoice';

export type EInvoiceSummary = {
    id: number;
    status:
        | 'pending'
        | 'submitted'
        | 'valid'
        | 'invalid'
        | 'cancelled'
        | 'failed';
    environment: 'sandbox' | 'production';
    uuid: string | null;
    validation_url: string | null;
    validated_at: string | null;
    cancel_until: string | null;
    errors: string[];
} | null;

const RETRYABLE = ['pending', 'invalid', 'failed'];

/**
 * LHDN MyInvois status for a sales document, with send / retry and cancel (within 72 hours of validation).
 * The page reloads itself while LHDN is still validating.
 */
export function EInvoiceCard({
    einvoice,
    type,
    documentId,
    ready,
    permission,
}: {
    einvoice: EInvoiceSummary;
    type: 'sales-invoices' | 'credit-notes';
    documentId: number;
    /** Posted / approved: the document can be sent. */
    ready: boolean;
    /** Permission that may send and cancel this kind of document. */
    permission: string;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const { date } = useFormat();
    const [cancelling, setCancelling] = useState(false);
    const [sending, setSending] = useState(false);
    const cancel = useForm({ reason: '' });
    const status = einvoice?.status;
    const canSend =
        can(permission) && ready && (!status || RETRYABLE.includes(status));

    if (!einvoice && !canSend) {
        return null;
    }

    return (
        <DocCard icon={FileCheck2} title="LHDN e-Invoice">
            {einvoice ? (
                <div className="grid gap-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={einvoice.status} />
                        {einvoice.environment === 'sandbox' && (
                            <StatusBadge status="sandbox" />
                        )}
                    </div>
                    {status === 'submitted' && (
                        <p className="text-muted-foreground">
                            {t(
                                'Waiting for LHDN to validate. Check again in a few seconds.',
                            )}
                        </p>
                    )}
                    {status === 'submitted' && can(permission) && (
                        <Button
                            variant="outline"
                            onClick={() =>
                                router.put(
                                    einvoiceRoutes.poll(einvoice.id).url,
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                        >
                            <RefreshCw /> {t('Check status')}
                        </Button>
                    )}
                    {einvoice.uuid && (
                        <div className="break-all">
                            <span className="text-muted-foreground">
                                UUID:{' '}
                            </span>
                            <span className="font-mono text-xs">
                                {einvoice.uuid}
                            </span>
                        </div>
                    )}
                    {einvoice.validated_at && (
                        <div className="text-muted-foreground">
                            {t('Validated')}: {date(einvoice.validated_at)}
                        </div>
                    )}
                    {einvoice.errors.length > 0 && (
                        <ul className="list-disc space-y-1 rounded-lg border border-red-200 bg-red-50 py-2 ps-6 pe-3 text-xs text-red-700">
                            {einvoice.errors.map((error) => (
                                <li key={error}>{error}</li>
                            ))}
                        </ul>
                    )}
                    {einvoice.validation_url && (
                        <Button variant="outline" asChild>
                            <a
                                href={einvoice.validation_url}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <ExternalLink /> {t('View on MyInvois')}
                            </a>
                        </Button>
                    )}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {t('Not sent to LHDN yet.')}
                </p>
            )}

            <div className="mt-4 grid gap-2">
                {canSend && (
                    <Button
                        disabled={sending}
                        onClick={() =>
                            router.post(
                                einvoiceRoutes.submit({ type, id: documentId })
                                    .url,
                                {},
                                {
                                    preserveScroll: true,
                                    onStart: () => setSending(true),
                                    onFinish: () => setSending(false),
                                },
                            )
                        }
                    >
                        <Send />{' '}
                        {status ? t('Send to LHDN again') : t('Send to LHDN')}
                    </Button>
                )}
                {einvoice?.cancel_until && can(permission) && (
                    <Button
                        variant="outline"
                        onClick={() => setCancelling(true)}
                    >
                        <Ban /> {t('Cancel e-Invoice')}
                    </Button>
                )}
                {einvoice?.cancel_until && (
                    <p className="text-xs text-muted-foreground">
                        {t('Can be cancelled until')}{' '}
                        {date(einvoice.cancel_until)}
                    </p>
                )}
            </div>

            {einvoice && (
                <FormDialog
                    open={cancelling}
                    onOpenChange={setCancelling}
                    title="Cancel e-Invoice"
                    description="LHDN allows cancelling within 72 hours of validation. After that, issue a credit note."
                    icon={Ban}
                    submitLabel="Cancel e-Invoice"
                    processing={cancel.processing}
                    onSubmit={(e) => {
                        e.preventDefault();
                        cancel.put(einvoiceRoutes.cancel(einvoice.id).url, {
                            preserveScroll: true,
                            onSuccess: () => setCancelling(false),
                        });
                    }}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="einvoice-cancel-reason">
                            {t('Reason')}{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="einvoice-cancel-reason"
                            value={cancel.data.reason}
                            onChange={(e) =>
                                cancel.setData('reason', e.target.value)
                            }
                        />
                        <InputError message={cancel.errors.reason} />
                    </div>
                </FormDialog>
            )}
        </DocCard>
    );
}
