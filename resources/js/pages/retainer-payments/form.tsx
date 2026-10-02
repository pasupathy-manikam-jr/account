import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Calculator,
    CalendarDays,
    FileText,
    PiggyBank,
} from 'lucide-react';
import DatePicker from '@/components/date-picker';
import InputError from '@/components/input-error';
import { DocCard } from '@/components/sales-document';
import { SelectField } from '@/components/select-field';
import { IdBadge } from '@/components/table-cells';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import retainerPayments from '@/routes/retainer-payments';

type OpenRetainer = {
    id: number;
    retainer_number: string;
    retainer_date: string;
    due_date: string;
    total_amount: string;
    paid_amount: string;
    balance_amount: string;
    status: string;
    customer: { id: number; name: string; email: string };
};

const today = () => new Date().toISOString().slice(0, 10);
const cents = (value: string) => Math.round((Number(value) || 0) * 100);

export default function RetainerPaymentForm({
    retainers,
    bankAccounts,
}: {
    retainers: OpenRetainer[];
    bankAccounts: { id: number; account_name: string; bank_name: string }[];
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const form = useForm({
        payment_date: today(),
        customer_id: '',
        bank_account_id: '',
        reference_number: '',
        notes: '',
        amounts: {} as Record<number, string>,
    });
    const errors = form.errors as Record<string, string | undefined>;
    const required = <span className="text-destructive">*</span>;
    const customers = [
        ...new Map(retainers.map((r) => [r.customer.id, r.customer])).values(),
    ];
    const open = retainers.filter(
        (r) => String(r.customer.id) === form.data.customer_id,
    );
    const used = open.filter((r) => cents(form.data.amounts[r.id] ?? '') > 0);
    const total =
        used.reduce((sum, r) => sum + cents(form.data.amounts[r.id]), 0) / 100;

    const submit = () => {
        form.transform((data) => ({
            payment_date: data.payment_date,
            customer_id: data.customer_id,
            bank_account_id: data.bank_account_id,
            reference_number: data.reference_number,
            notes: data.notes,
            // The payment is exactly what is allocated, so the two can never disagree.
            payment_amount: total.toFixed(2),
            allocations: used.map((r) => ({
                retainer_id: r.id,
                allocated_amount: data.amounts[r.id],
            })),
        }));
        form.post(retainerPayments.store().url);
    };

    return (
        <>
            <Head title={t('Add Retainer Payment')} />
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
                            {t('Add Retainer Payment')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                "Record an advance payment and split it across the customer's open retainers.",
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={retainerPayments.index()}>
                            <ArrowLeft className="rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid min-w-0 gap-6">
                        <DocCard icon={CalendarDays} title="Payment Details">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="payment_date">
                                        {t('Payment Date')} {required}
                                    </Label>
                                    <DatePicker
                                        id="payment_date"
                                        name="payment_date"
                                        defaultValue={form.data.payment_date}
                                        invalid={!!errors.payment_date}
                                        onChange={(v) =>
                                            form.setData('payment_date', v)
                                        }
                                    />
                                    <InputError message={errors.payment_date} />
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
                                                amounts: {},
                                            })
                                        }
                                    >
                                        {customers.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </SelectField>
                                    <InputError message={errors.customer_id} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="bank_account_id">
                                        {t('Bank Account')} {required}
                                    </Label>
                                    <SelectField
                                        id="bank_account_id"
                                        value={form.data.bank_account_id}
                                        placeholder={t('Select Bank Account')}
                                        aria-invalid={!!errors.bank_account_id}
                                        onChange={(e) =>
                                            form.setData(
                                                'bank_account_id',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        {bankAccounts.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.account_name} ({b.bank_name})
                                            </option>
                                        ))}
                                    </SelectField>
                                    <InputError
                                        message={errors.bank_account_id}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="reference_number">
                                        {t('Reference Number')}
                                    </Label>
                                    <Input
                                        id="reference_number"
                                        placeholder={t(
                                            'e.g., bank transfer reference',
                                        )}
                                        value={form.data.reference_number}
                                        onChange={(e) =>
                                            form.setData(
                                                'reference_number',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={errors.reference_number}
                                    />
                                </div>
                            </div>
                        </DocCard>

                        <DocCard icon={PiggyBank} title="Allocate to Retainers">
                            <InputError
                                message={
                                    errors.allocations ?? errors.payment_amount
                                }
                            />
                            {open.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    {form.data.customer_id
                                        ? t(
                                              'This customer has no retainers awaiting payment.',
                                          )
                                        : t(
                                              'Select a customer to see their open retainers.',
                                          )}
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[36rem] text-sm">
                                        <thead className="text-muted-foreground">
                                            <tr className="border-b">
                                                <th className="py-3 pe-3 text-start font-medium">
                                                    {t('Retainer')}
                                                </th>
                                                <th className="px-3 py-3 text-start font-medium">
                                                    {t('Due Date')}
                                                </th>
                                                <th className="px-3 py-3 text-end font-medium">
                                                    {t('Total')}
                                                </th>
                                                <th className="px-3 py-3 text-end font-medium">
                                                    {t('Balance')}
                                                </th>
                                                <th className="w-36 py-3 ps-3 text-start font-medium">
                                                    {t('Amount')}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {open.map((r) => {
                                                const at = used.findIndex(
                                                    (u) => u.id === r.id,
                                                );

                                                return (
                                                    <tr
                                                        key={r.id}
                                                        className="border-b align-top last:border-0"
                                                    >
                                                        <td className="py-3 pe-3">
                                                            <IdBadge>
                                                                {
                                                                    r.retainer_number
                                                                }
                                                            </IdBadge>
                                                        </td>
                                                        <td className="px-3 py-3 whitespace-nowrap">
                                                            {date(r.due_date)}
                                                        </td>
                                                        <td className="px-3 py-3 text-end whitespace-nowrap">
                                                            {money(
                                                                Number(
                                                                    r.total_amount,
                                                                ),
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-3 text-end font-medium whitespace-nowrap">
                                                            {money(
                                                                Number(
                                                                    r.balance_amount,
                                                                ),
                                                            )}
                                                        </td>
                                                        <td className="py-3 ps-3">
                                                            <div className="flex gap-1">
                                                                <Input
                                                                    inputMode="decimal"
                                                                    placeholder="0.00"
                                                                    aria-label={t(
                                                                        'Amount',
                                                                    )}
                                                                    value={
                                                                        form
                                                                            .data
                                                                            .amounts[
                                                                            r.id
                                                                        ] ?? ''
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        form.setData(
                                                                            'amounts',
                                                                            {
                                                                                ...form
                                                                                    .data
                                                                                    .amounts,
                                                                                [r.id]: e
                                                                                    .target
                                                                                    .value,
                                                                            },
                                                                        )
                                                                    }
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-9"
                                                                    onClick={() =>
                                                                        form.setData(
                                                                            'amounts',
                                                                            {
                                                                                ...form
                                                                                    .data
                                                                                    .amounts,
                                                                                [r.id]: r.balance_amount,
                                                                            },
                                                                        )
                                                                    }
                                                                >
                                                                    {t('Full')}
                                                                </Button>
                                                            </div>
                                                            {at >= 0 && (
                                                                <InputError
                                                                    message={
                                                                        errors[
                                                                            `allocations.${at}.allocated_amount`
                                                                        ]
                                                                    }
                                                                />
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </DocCard>
                    </div>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={Calculator} title="Payment Summary">
                            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t('Payment Amount')}
                            </div>
                            <div className="mt-1 text-3xl font-bold text-primary">
                                {money(total)}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                                {t(':count retainer(s)', {
                                    count: used.length,
                                })}
                            </div>
                            <Button
                                type="submit"
                                className="mt-6 w-full"
                                disabled={form.processing}
                            >
                                {form.processing && <Spinner />}
                                {t('Record Payment')}
                            </Button>
                        </DocCard>
                        <DocCard icon={FileText} title="Additional Notes">
                            <Textarea
                                aria-label={t('Notes')}
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

RetainerPaymentForm.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Retainer Payments', href: retainerPayments.index() },
        { title: 'Add Retainer Payment', href: retainerPayments.create() },
    ],
};
