import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Calculator,
    CalendarDays,
    FileText,
    Package,
} from 'lucide-react';
import DatePicker from '@/components/date-picker';
import InputError from '@/components/input-error';
import { DocCard, TotalsList, lineAmounts } from '@/components/sales-document';
import { SelectField } from '@/components/select-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import purchaseReturns from '@/routes/purchase-returns';
import { reasonLabel } from './types';

type InvoiceLine = {
    id: number;
    name: string;
    sku: string;
    quantity: string;
    returnable: string;
    unit_price: string;
    discount_percentage: string;
    tax_percentage: string;
};

type ReturnableInvoice = {
    id: number;
    invoice_number: string;
    invoice_date: string;
    warehouse_id: number | null;
    vendor: { id: number; name: string; email: string };
    items: InvoiceLine[];
};

const today = () => new Date().toISOString().slice(0, 10);

export default function ReturnForm({
    invoices,
    warehouses,
    reasons,
}: {
    invoices: ReturnableInvoice[];
    warehouses: { id: number; name: string }[];
    reasons: string[];
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const form = useForm({
        return_date: today(),
        original_invoice_id: '',
        warehouse_id: '',
        reason: 'defective',
        notes: '',
        quantities: {} as Record<number, string>,
    });
    const errors = form.errors as Record<string, string | undefined>;
    const invoice = invoices.find(
        (i) => String(i.id) === form.data.original_invoice_id,
    );
    const lines = invoice?.items ?? [];
    const amounts = lines.map((line) =>
        lineAmounts(
            {
                item_id: String(line.id),
                quantity: form.data.quantities[line.id] || '0',
                unit_price: line.unit_price,
                discount_percentage: line.discount_percentage,
            },
            Number(line.tax_percentage),
        ),
    );
    const sum = (key: 'gross' | 'discount' | 'tax' | 'total') =>
        amounts.reduce((total, a) => total + a[key], 0) / 100;
    const required = <span className="text-destructive">*</span>;

    const submit = () => {
        form.transform((data) => ({
            return_date: data.return_date,
            original_invoice_id: data.original_invoice_id,
            warehouse_id: data.warehouse_id,
            reason: data.reason,
            notes: data.notes,
            // Only lines with a quantity are returned; their positions match the server's items.N errors.
            items: lines
                .filter((line) => Number(data.quantities[line.id]) > 0)
                .map((line) => ({
                    original_invoice_item_id: line.id,
                    quantity: data.quantities[line.id],
                })),
        }));
        form.post(purchaseReturns.store().url);
    };
    const sentIndex = (lineId: number) =>
        lines
            .filter((line) => Number(form.data.quantities[line.id]) > 0)
            .findIndex((line) => line.id === lineId);

    return (
        <>
            <Head title={t('Create Purchase Return')} />
            <form
                noValidate
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
                className="flex flex-1 flex-col gap-6 p-4 md:p-6"
            >
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">
                            {t('Create Purchase Return')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'Initiate a purchase return from a previously posted invoice. Select invoice, specify quantities to return, warehouse, and reasons.',
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={purchaseReturns.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard
                            icon={CalendarDays}
                            title="Purchase Return Details"
                        >
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="return_date">
                                        {t('Return Date')} {required}
                                    </Label>
                                    <DatePicker
                                        id="return_date"
                                        name="return_date"
                                        defaultValue={form.data.return_date}
                                        invalid={!!errors.return_date}
                                        onChange={(v) =>
                                            form.setData('return_date', v)
                                        }
                                    />
                                    <InputError message={errors.return_date} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="original_invoice_id">
                                        {t('Original Invoice')} {required}
                                    </Label>
                                    <SelectField
                                        id="original_invoice_id"
                                        value={form.data.original_invoice_id}
                                        placeholder={t('Select Invoice')}
                                        aria-invalid={
                                            !!errors.original_invoice_id
                                        }
                                        onChange={(e) => {
                                            const picked = invoices.find(
                                                (i) =>
                                                    String(i.id) ===
                                                    e.target.value,
                                            );
                                            form.setData({
                                                ...form.data,
                                                original_invoice_id:
                                                    e.target.value,
                                                warehouse_id:
                                                    picked?.warehouse_id
                                                        ? String(
                                                              picked.warehouse_id,
                                                          )
                                                        : form.data
                                                              .warehouse_id,
                                                quantities: {},
                                            });
                                        }}
                                    >
                                        {invoices.map((i) => (
                                            <option key={i.id} value={i.id}>
                                                {i.invoice_number} ·{' '}
                                                {i.vendor.name}
                                            </option>
                                        ))}
                                    </SelectField>
                                    <InputError
                                        message={errors.original_invoice_id}
                                    />
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
                                    <Label htmlFor="reason">
                                        {t('Return Reason')} {required}
                                    </Label>
                                    <SelectField
                                        id="reason"
                                        value={form.data.reason}
                                        onChange={(e) =>
                                            form.setData(
                                                'reason',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        {reasons.map((r) => (
                                            <option key={r} value={r}>
                                                {t(reasonLabel(r))}
                                            </option>
                                        ))}
                                    </SelectField>
                                    <InputError message={errors.reason} />
                                </div>
                            </div>
                        </DocCard>

                        {invoice && (
                            <DocCard icon={Package} title="Return Items">
                                <InputError message={errors.items} />
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[40rem] text-sm">
                                        <thead className="text-muted-foreground">
                                            <tr className="border-b">
                                                <th className="py-3 pe-3 text-start font-medium">
                                                    {t('Product')}
                                                </th>
                                                <th className="px-3 py-3 text-end font-medium">
                                                    {t('Sold')}
                                                </th>
                                                <th className="px-3 py-3 text-end font-medium">
                                                    {t('Returnable')}
                                                </th>
                                                <th className="w-32 px-3 py-3 text-start font-medium">
                                                    {t('Return Qty')}
                                                </th>
                                                <th className="px-3 py-3 text-end font-medium">
                                                    {t('Unit Price')}
                                                </th>
                                                <th className="py-3 ps-3 text-end font-medium">
                                                    {t('Total')}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lines.map((line, index) => {
                                                const at = sentIndex(line.id);

                                                return (
                                                    <tr
                                                        key={line.id}
                                                        className="border-b align-top last:border-0"
                                                    >
                                                        <td className="py-3 pe-3">
                                                            <div className="font-medium">
                                                                {line.name}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {line.sku}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-end">
                                                            {Number(
                                                                line.quantity,
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-3 text-end">
                                                            {Number(
                                                                line.returnable,
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <Input
                                                                inputMode="decimal"
                                                                placeholder="0"
                                                                aria-label={t(
                                                                    'Return Qty',
                                                                )}
                                                                value={
                                                                    form.data
                                                                        .quantities[
                                                                        line.id
                                                                    ] ?? ''
                                                                }
                                                                onChange={(e) =>
                                                                    form.setData(
                                                                        'quantities',
                                                                        {
                                                                            ...form
                                                                                .data
                                                                                .quantities,
                                                                            [line.id]:
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            {at >= 0 && (
                                                                <InputError
                                                                    message={
                                                                        errors[
                                                                            `items.${at}.quantity`
                                                                        ]
                                                                    }
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-3 text-end whitespace-nowrap">
                                                            {money(
                                                                Number(
                                                                    line.unit_price,
                                                                ),
                                                            )}
                                                        </td>
                                                        <td className="py-3 ps-3 text-end font-medium whitespace-nowrap">
                                                            {money(
                                                                amounts[index]
                                                                    .total /
                                                                    100,
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </DocCard>
                        )}
                    </div>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={Calculator} title="Return Summary">
                            <TotalsList
                                subtotal={sum('gross')}
                                discount={sum('discount')}
                                tax={sum('tax')}
                                total={sum('total')}
                            />
                            <Button
                                type="submit"
                                className="mt-6 w-full"
                                disabled={form.processing}
                            >
                                {form.processing && <Spinner />}
                                {t('Create Return')}
                            </Button>
                        </DocCard>
                        <DocCard icon={FileText} title="Additional Notes">
                            <Label htmlFor="notes" className="sr-only">
                                {t('Notes')}
                            </Label>
                            <Textarea
                                id="notes"
                                rows={4}
                                placeholder={t('Additional notes...')}
                                value={form.data.notes}
                                onChange={(e) =>
                                    form.setData('notes', e.target.value)
                                }
                            />
                            <InputError message={errors.notes} />
                        </DocCard>
                    </div>
                </div>
            </form>
        </>
    );
}

ReturnForm.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Purchase Returns', href: purchaseReturns.index() },
        { title: 'Create Purchase Return', href: purchaseReturns.create() },
    ],
};
