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
import purchaseInvoices from '@/routes/purchase-invoices';
import type { CustomerOption as VendorOption } from '@/pages/sales-proposals/types';
import type { Invoice } from './types';

const today = () => new Date().toISOString().slice(0, 10);

export default function PurchaseInvoiceForm({
    invoice,
    vendors,
    warehouses,
    items,
}: {
    invoice: Invoice | null;
    vendors: VendorOption[];
    warehouses: { id: number; name: string }[];
    items: ItemOption[];
}) {
    const { t } = useTranslation();
    const form = useForm({
        invoice_date: invoice?.invoice_date ?? today(),
        due_date: invoice?.due_date ?? '',
        vendor_id: invoice ? String(invoice.vendor_id) : '',
        warehouse_id: invoice ? String(invoice.warehouse_id) : '',
        payment_terms: invoice?.payment_terms ?? '',
        notes: invoice?.notes ?? '',
        items: toEditableLines(invoice?.items),
    });
    const errors = form.errors as Record<string, string | undefined>;
    const totals = useLineTotals(form.data.items, items);
    const required = <span className="text-destructive">*</span>;
    const title = invoice ? 'Edit Purchase Invoice' : 'Create Purchase Invoice';

    return (
        <>
            <Head title={t(title)} />
            <form
                noValidate
                onSubmit={(e) => {
                    e.preventDefault();
                    if (invoice) {
                        form.put(purchaseInvoices.update(invoice.id).url);
                    } else {
                        form.post(purchaseInvoices.store().url);
                    }
                }}
                className="flex flex-1 flex-col gap-6 p-4 md:p-6"
            >
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">{t(title)}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'Record a vendor bill for stock received into a warehouse.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={purchaseInvoices.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard
                            icon={CalendarDays}
                            title="Purchase Invoice Details"
                        >
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="invoice_date">
                                        {t('Invoice Date')} {required}
                                    </Label>
                                    <DatePicker
                                        id="invoice_date"
                                        name="invoice_date"
                                        defaultValue={form.data.invoice_date}
                                        invalid={!!errors.invoice_date}
                                        onChange={(v) =>
                                            form.setData('invoice_date', v)
                                        }
                                    />
                                    <InputError message={errors.invoice_date} />
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
                                    <Label htmlFor="vendor_id">
                                        {t('Vendor')} {required}
                                    </Label>
                                    <SelectField
                                        id="vendor_id"
                                        value={form.data.vendor_id}
                                        placeholder={t('Select Vendor')}
                                        aria-invalid={!!errors.vendor_id}
                                        onChange={(e) =>
                                            form.setData({
                                                ...form.data,
                                                vendor_id: e.target.value,
                                                // Default the terms from the customer record, unless already typed.
                                                payment_terms:
                                                    form.data.payment_terms ||
                                                    vendors.find(
                                                        (c) =>
                                                            String(c.id) ===
                                                            e.target.value,
                                                    )?.payment_terms ||
                                                    '',
                                            })
                                        }
                                    >
                                        {vendors.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.company_name
                                                    ? `${c.company_name} (${c.name})`
                                                    : c.name}
                                            </option>
                                        ))}
                                    </SelectField>
                                    <InputError message={errors.vendor_id} />
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
                            title="Purchase Invoice Items"
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
                        <DocCard icon={Calculator} title="Invoice Summary">
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
                                    invoice
                                        ? 'Update Invoice'
                                        : 'Create Invoice',
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

PurchaseInvoiceForm.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Purchase Invoice', href: purchaseInvoices.index() },
        { title: 'Purchase Invoice', href: purchaseInvoices.index() },
    ],
};
