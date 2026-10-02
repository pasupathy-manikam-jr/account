import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Calculator,
    CalendarDays,
    FileMinus,
    FileText,
    Receipt,
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
import { kindConfig } from './types';
import type { Kind } from './types';

type OpenInvoice = {
    id: number;
    number: string;
    party_id: number;
    party: { id: number; name: string; email: string };
    due_date: string;
    total_amount: string;
    balance_amount: string;
};

type OpenNote = {
    id: number;
    number: string;
    party_id: number;
    balance_amount: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const cents = (value: string | undefined) =>
    Math.round((Number(value) || 0) * 100);

export default function PaymentForm({
    kind,
    invoices,
    notes,
    bankAccounts,
}: {
    kind: Kind;
    invoices: OpenInvoice[];
    notes: OpenNote[];
    bankAccounts: { id: number; account_name: string; bank_name: string }[];
}) {
    const { t } = useTranslation();
    const { money, date } = useFormat();
    const config = kindConfig(kind);
    const form = useForm({
        payment_date: today(),
        party_id: '',
        bank_account_id: '',
        reference_number: '',
        notes: '',
        amounts: {} as Record<number, string>,
        credits: {} as Record<number, string>,
    });
    const errors = form.errors as Record<string, string | undefined>;
    const required = <span className="text-destructive">*</span>;
    const parties = [
        ...new Map(invoices.map((i) => [i.party.id, i.party])).values(),
    ];
    const open = invoices.filter(
        (i) => String(i.party_id) === form.data.party_id,
    );
    const credit = notes.filter(
        (n) => String(n.party_id) === form.data.party_id,
    );
    const allocated = open.filter((i) => cents(form.data.amounts[i.id]) > 0);
    const applied = credit.filter((n) => cents(form.data.credits[n.id]) > 0);
    const allocatedTotal = allocated.reduce(
        (s, i) => s + cents(form.data.amounts[i.id]),
        0,
    );
    const appliedTotal = applied.reduce(
        (s, n) => s + cents(form.data.credits[n.id]),
        0,
    );
    // The cash is what the invoices take beyond the notes applied.
    const cash = Math.max(0, allocatedTotal - appliedTotal);

    const submit = () => {
        form.transform((data) => ({
            payment_date: data.payment_date,
            party_id: data.party_id,
            bank_account_id: data.bank_account_id,
            reference_number: data.reference_number,
            notes: data.notes,
            payment_amount: (cash / 100).toFixed(2),
            allocations: allocated.map((i) => ({
                invoice_id: i.id,
                amount: data.amounts[i.id],
            })),
            applications: applied.map((n) => ({
                note_id: n.id,
                amount: data.credits[n.id],
            })),
        }));
        form.post(config.routes.store().url);
    };

    return (
        <>
            <Head title={t('Add Payment')} />
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
                            {t(
                                kind === 'customer'
                                    ? 'Add Customer Payment'
                                    : 'Add Vendor Payment',
                            )}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                kind === 'customer'
                                    ? "Allocate money received across the customer's open invoices."
                                    : "Allocate money paid across the vendor's open bills.",
                            )}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={config.routes.index()}>
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
                                    <Label htmlFor="party_id">
                                        {t(config.party)} {required}
                                    </Label>
                                    <SelectField
                                        id="party_id"
                                        value={form.data.party_id}
                                        placeholder={t(
                                            kind === 'customer'
                                                ? 'Select Customer'
                                                : 'Select Vendor',
                                        )}
                                        aria-invalid={!!errors.party_id}
                                        onChange={(e) =>
                                            form.setData({
                                                ...form.data,
                                                party_id: e.target.value,
                                                amounts: {},
                                                credits: {},
                                            })
                                        }
                                    >
                                        {parties.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </SelectField>
                                    <InputError message={errors.party_id} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="payment_date">
                                        {t('Payment Date')} {required}
                                    </Label>
                                    <DatePicker
                                        id="payment_date"
                                        name="payment_date"
                                        defaultValue={form.data.payment_date}
                                        onChange={(v) =>
                                            form.setData('payment_date', v)
                                        }
                                    />
                                    <InputError message={errors.payment_date} />
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

                        <DocCard icon={Receipt} title="Allocate to Invoices">
                            <InputError
                                message={
                                    errors.allocations ?? errors.payment_amount
                                }
                            />
                            {open.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    {t(
                                        form.data.party_id
                                            ? 'Nothing is owed on any invoice.'
                                            : 'Select who the payment is with to see their open invoices.',
                                    )}
                                </p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="text-muted-foreground">
                                        <tr className="border-b">
                                            <th className="py-3 pe-3 text-start font-medium">
                                                {t('Invoice')}
                                            </th>
                                            <th className="px-3 py-3 text-start font-medium">
                                                {t('Due Date')}
                                            </th>
                                            <th className="px-3 py-3 text-end font-medium">
                                                {t('Balance')}
                                            </th>
                                            <th className="w-44 py-3 ps-3 text-start font-medium">
                                                {t('Amount')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {open.map((i) => {
                                            const at = allocated.findIndex(
                                                (a) => a.id === i.id,
                                            );

                                            return (
                                                <tr
                                                    key={i.id}
                                                    className="border-b align-top last:border-0"
                                                >
                                                    <td className="py-3 pe-3">
                                                        <IdBadge>
                                                            {i.number}
                                                        </IdBadge>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        {date(i.due_date)}
                                                    </td>
                                                    <td className="px-3 py-3 text-end font-medium whitespace-nowrap">
                                                        {money(
                                                            Number(
                                                                i.balance_amount,
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
                                                                    form.data
                                                                        .amounts[
                                                                        i.id
                                                                    ] ?? ''
                                                                }
                                                                onChange={(e) =>
                                                                    form.setData(
                                                                        'amounts',
                                                                        {
                                                                            ...form
                                                                                .data
                                                                                .amounts,
                                                                            [i.id]: e
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
                                                                            [i.id]: i.balance_amount,
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
                                                                        `allocations.${at}.amount`
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
                            )}
                        </DocCard>

                        {credit.length > 0 && (
                            <DocCard
                                icon={FileMinus}
                                title={`Apply ${config.note}`}
                            >
                                <table className="w-full text-sm">
                                    <thead className="text-muted-foreground">
                                        <tr className="border-b">
                                            <th className="py-3 pe-3 text-start font-medium">
                                                {t(
                                                    kind === 'customer'
                                                        ? 'Credit Note'
                                                        : 'Debit Note',
                                                )}
                                            </th>
                                            <th className="px-3 py-3 text-end font-medium">
                                                {t('Available')}
                                            </th>
                                            <th className="w-44 py-3 ps-3 text-start font-medium">
                                                {t('Apply')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {credit.map((n) => {
                                            const at = applied.findIndex(
                                                (a) => a.id === n.id,
                                            );

                                            return (
                                                <tr
                                                    key={n.id}
                                                    className="border-b align-top last:border-0"
                                                >
                                                    <td className="py-3 pe-3">
                                                        <IdBadge>
                                                            {n.number}
                                                        </IdBadge>
                                                    </td>
                                                    <td className="px-3 py-3 text-end whitespace-nowrap">
                                                        {money(
                                                            Number(
                                                                n.balance_amount,
                                                            ),
                                                        )}
                                                    </td>
                                                    <td className="py-3 ps-3">
                                                        <Input
                                                            inputMode="decimal"
                                                            placeholder="0.00"
                                                            aria-label={t(
                                                                'Apply',
                                                            )}
                                                            value={
                                                                form.data
                                                                    .credits[
                                                                    n.id
                                                                ] ?? ''
                                                            }
                                                            onChange={(e) =>
                                                                form.setData(
                                                                    'credits',
                                                                    {
                                                                        ...form
                                                                            .data
                                                                            .credits,
                                                                        [n.id]: e
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
                                                                        `applications.${at}.amount`
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
                            </DocCard>
                        )}
                    </div>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={Calculator} title="Payment Summary">
                            <dl className="grid gap-3 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">
                                        {t('Allocated to invoices')}
                                    </dt>
                                    <dd>{money(allocatedTotal / 100)}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">
                                        {t(
                                            kind === 'customer'
                                                ? 'Credit notes applied'
                                                : 'Debit notes applied',
                                        )}
                                    </dt>
                                    <dd>-{money(appliedTotal / 100)}</dd>
                                </div>
                                <div className="flex items-center justify-between border-t pt-3">
                                    <dt className="font-semibold">
                                        {t('Payment Amount')}
                                    </dt>
                                    <dd className="text-2xl font-bold text-primary">
                                        {money(cash / 100)}
                                    </dd>
                                </div>
                            </dl>
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

PaymentForm.layout = {
    breadcrumbs: [{ title: 'Dashboard', href: dashboard() }],
};
