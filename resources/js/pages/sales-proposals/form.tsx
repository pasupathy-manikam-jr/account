import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Calculator,
    CalendarDays,
    Clock,
    FileText,
    Package,
    Plus,
} from 'lucide-react';
import DatePicker from '@/components/date-picker';
import InputError from '@/components/input-error';
import {
    DocCard,
    LineItemsEditor,
    TotalsList,
    blankLine,
    toEditableLines,
    useLineTotals,
} from '@/components/sales-document';
import type { ItemOption } from '@/components/sales-document';
import { SelectField } from '@/components/select-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import salesProposals from '@/routes/sales-proposals';
import type { CustomerOption, Proposal } from './types';

const today = () => new Date().toISOString().slice(0, 10);

export default function ProposalForm({
    proposal,
    customers,
    warehouses,
    items,
}: {
    proposal: Proposal | null;
    customers: CustomerOption[];
    warehouses: { id: number; name: string }[];
    items: ItemOption[];
}) {
    const { t } = useTranslation();
    const form = useForm({
        proposal_date: proposal?.proposal_date ?? today(),
        due_date: proposal?.due_date ?? '',
        customer_id: proposal ? String(proposal.customer_id) : '',
        warehouse_id: proposal ? String(proposal.warehouse_id) : '',
        payment_terms: proposal?.payment_terms ?? '',
        notes: proposal?.notes ?? '',
        items: toEditableLines(proposal?.items),
    });
    const errors = form.errors as Record<string, string | undefined>;
    const totals = useLineTotals(form.data.items, items);
    const required = <span className="text-destructive">*</span>;
    const title = proposal ? 'Edit Sales Proposal' : 'Create Sales Proposal';

    return (
        <>
            <Head title={t(title)} />
            <form
                noValidate
                onSubmit={(e) => {
                    e.preventDefault();
                    if (proposal) {
                        form.put(salesProposals.update(proposal.id).url);
                    } else {
                        form.post(salesProposals.store().url);
                    }
                }}
                className="flex flex-1 flex-col gap-6 p-4 md:p-6"
            >
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">{t(title)}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'Fill in the details below to create a new sales proposal.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={salesProposals.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard icon={CalendarDays} title="Proposal Details">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="proposal_date">
                                        {t('Proposal Date')} {required}
                                    </Label>
                                    <DatePicker
                                        id="proposal_date"
                                        name="proposal_date"
                                        defaultValue={form.data.proposal_date}
                                        invalid={!!errors.proposal_date}
                                        onChange={(v) =>
                                            form.setData('proposal_date', v)
                                        }
                                    />
                                    <InputError
                                        message={errors.proposal_date}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="due_date">
                                        {t('Due Date')} {required}
                                    </Label>
                                    <DatePicker
                                        id="due_date"
                                        name="due_date"
                                        defaultValue={form.data.due_date}
                                        placeholder={t('Select date')}
                                        invalid={!!errors.due_date}
                                        onChange={(v) =>
                                            form.setData('due_date', v)
                                        }
                                    />
                                    <InputError message={errors.due_date} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="customer_id">
                                        {t('Customer')} {required}
                                    </Label>
                                    <SelectField
                                        id="customer_id"
                                        value={form.data.customer_id}
                                        placeholder={t('Select Customer')}
                                        aria-invalid={!!errors.customer_id}
                                        onChange={(e) =>
                                            form.setData({
                                                ...form.data,
                                                customer_id: e.target.value,
                                                // Default the terms from the customer record, unless already typed.
                                                payment_terms:
                                                    form.data.payment_terms ||
                                                    customers.find(
                                                        (c) =>
                                                            String(c.id) ===
                                                            e.target.value,
                                                    )?.payment_terms ||
                                                    '',
                                            })
                                        }
                                    >
                                        {customers.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.company_name
                                                    ? `${c.company_name} (${c.name})`
                                                    : c.name}
                                            </option>
                                        ))}
                                    </SelectField>
                                    <InputError message={errors.customer_id} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="warehouse_id">
                                        {t('Warehouse')} {required}
                                    </Label>
                                    <SelectField
                                        id="warehouse_id"
                                        value={form.data.warehouse_id}
                                        placeholder={t('Select Warehouse')}
                                        aria-invalid={!!errors.warehouse_id}
                                        onChange={(e) =>
                                            form.setData(
                                                'warehouse_id',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        {warehouses.map((w) => (
                                            <option key={w.id} value={w.id}>
                                                {w.name}
                                            </option>
                                        ))}
                                    </SelectField>
                                    <InputError message={errors.warehouse_id} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="payment_terms">
                                        {t('Payment Terms')}
                                    </Label>
                                    <Input
                                        id="payment_terms"
                                        placeholder={t('e.g., Net 30')}
                                        value={form.data.payment_terms}
                                        onChange={(e) =>
                                            form.setData(
                                                'payment_terms',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={errors.payment_terms}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="notes">{t('Notes')}</Label>
                                    <Textarea
                                        id="notes"
                                        rows={1}
                                        placeholder={t('Additional notes...')}
                                        value={form.data.notes}
                                        onChange={(e) =>
                                            form.setData(
                                                'notes',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={errors.notes} />
                                </div>
                            </div>
                        </DocCard>

                        <DocCard
                            icon={Package}
                            title="Sales Proposal Items"
                            action={
                                <Button
                                    type="button"
                                    onClick={() =>
                                        form.setData('items', [
                                            ...form.data.items,
                                            blankLine,
                                        ])
                                    }
                                >
                                    <Plus /> {t('Add Item')}
                                </Button>
                            }
                        >
                            <LineItemsEditor
                                lines={form.data.items}
                                onChange={(lines) =>
                                    form.setData('items', lines)
                                }
                                items={items}
                                errors={errors}
                            />
                        </DocCard>
                    </div>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={Calculator} title="Proposal Summary">
                            <TotalsList
                                subtotal={totals.subtotal}
                                discount={totals.discount}
                                tax={totals.tax}
                                total={totals.total}
                            />
                            <Button
                                type="submit"
                                className="mt-6 w-full"
                                disabled={form.processing}
                            >
                                {form.processing && <Spinner />}
                                {t(
                                    proposal
                                        ? 'Update Proposal'
                                        : 'Create Proposal',
                                )}
                            </Button>
                        </DocCard>
                        <DocCard icon={Clock} title="Payment Terms">
                            <p className="text-sm text-muted-foreground">
                                {form.data.payment_terms ||
                                    t('No payment terms specified.')}
                            </p>
                        </DocCard>
                        <DocCard icon={FileText} title="Additional Notes">
                            <p className="text-sm whitespace-pre-line text-muted-foreground">
                                {form.data.notes || t('No notes added.')}
                            </p>
                        </DocCard>
                    </div>
                </div>
            </form>
        </>
    );
}

ProposalForm.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Proposals', href: salesProposals.index() },
        { title: 'Sales Proposal', href: salesProposals.index() },
    ],
};
