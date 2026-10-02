import { Link, router, useForm } from '@inertiajs/react';
import { BadgeCheck, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { SelectField } from '@/components/select-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import account from '@/routes/account';
import einvoice from '@/routes/einvoice';

export type Address = {
    name: string;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    country: string;
    zip_code: string;
};

export type CustomerFormData = {
    user_id: string;
    company_name: string;
    contact_person_name: string;
    contact_person_email: string;
    contact_person_mobile: string;
    tax_number: string;
    id_type: string;
    id_number: string;
    payment_terms: string;
    billing_address: Address;
    shipping_address: Address;
    same_as_billing: boolean;
    notes: string;
};

export const blankAddress: Address = {
    name: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    country: 'Malaysia',
    zip_code: '',
};

const STEPS = ['General Info', 'Billing Address', 'Shipping Address & Notes'];

// Which step owns each server error, so a failed save opens the step to fix.
const stepOf = (field: string) =>
    field.startsWith('billing_address')
        ? 1
        : field.startsWith('shipping_address') || field === 'notes'
          ? 2
          : 0;

const ADDRESS_FIELDS: [keyof Address, string, boolean, string][] = [
    ['name', 'Name', false, 'Enter name'],
    ['address_line_1', 'Address Line 1', true, 'Enter address line 1'],
    ['address_line_2', 'Address Line 2', false, 'Enter address line 2'],
    ['city', 'City', true, 'Enter city'],
    ['state', 'State', false, 'Enter state'],
    ['country', 'Country', true, 'Enter country'],
    ['zip_code', 'Postcode', false, 'Enter postcode'],
];

/** The demo's three-step customer form, shared by the create and edit pages. */
export function CustomerForm({
    initial,
    users,
    customerId,
}: {
    initial: CustomerFormData;
    users: { id: number; name: string; email: string }[];
    customerId?: number;
}) {
    const { t } = useTranslation();
    const [step, setStep] = useState(0);
    const form = useForm<CustomerFormData>(initial);
    const errors = form.errors as Record<string, string | undefined>;

    const submit = () =>
        form.submit(
            customerId
                ? account.customers.update(customerId)
                : account.customers.store(),
            {
                preserveScroll: true,
                onError: (errs) =>
                    setStep(Math.min(...Object.keys(errs).map(stepOf))),
            },
        );

    const field = (
        key: Exclude<
            keyof CustomerFormData,
            'billing_address' | 'shipping_address' | 'same_as_billing'
        >,
        label: string,
        required = false,
        placeholder = '',
        hint?: string,
    ) => (
        <div className="grid gap-2">
            <Label htmlFor={`customer-${key}`}>
                {t(label)}{' '}
                {required && <span className="text-destructive">*</span>}
            </Label>
            <Input
                id={`customer-${key}`}
                value={form.data[key]}
                placeholder={t(placeholder)}
                onChange={(e) => form.setData(key, e.target.value)}
            />
            {hint && <p className="text-xs text-muted-foreground">{t(hint)}</p>}
            <InputError message={errors[key]} />
        </div>
    );

    const address = (key: 'billing_address' | 'shipping_address') => (
        <div className="grid gap-4 sm:grid-cols-2">
            {ADDRESS_FIELDS.map(([part, label, required, placeholder]) => (
                <div
                    key={part}
                    className={cn(
                        'grid gap-2',
                        part.startsWith('address_line') && 'sm:col-span-2',
                    )}
                >
                    <Label htmlFor={`${key}-${part}`}>
                        {t(label)}{' '}
                        {required && (
                            <span className="text-destructive">*</span>
                        )}
                    </Label>
                    <Input
                        id={`${key}-${part}`}
                        value={form.data[key][part]}
                        placeholder={t(placeholder)}
                        onChange={(e) =>
                            form.setData(key, {
                                ...form.data[key],
                                [part]: e.target.value,
                            })
                        }
                    />
                    <InputError message={errors[`${key}.${part}`]} />
                </div>
            ))}
        </div>
    );

    return (
        <form
            noValidate
            onSubmit={(e) => {
                e.preventDefault();

                if (step < STEPS.length - 1) {
                    setStep(step + 1);
                } else {
                    submit();
                }
            }}
            className="rounded-xl border bg-card p-6"
        >
            <ol className="mb-6 flex items-center gap-3 border-b pb-6">
                {STEPS.map((label, i) => (
                    <li
                        key={label}
                        className={cn(
                            'flex items-center gap-3',
                            i < STEPS.length - 1 && 'flex-1',
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => setStep(i)}
                            className={cn(
                                'flex items-center gap-2 text-sm font-medium whitespace-nowrap',
                                i === step
                                    ? 'text-primary'
                                    : 'text-muted-foreground',
                            )}
                        >
                            <span
                                className={cn(
                                    'flex size-8 items-center justify-center rounded-full border text-sm',
                                    i < step &&
                                        'border-primary bg-primary/10 text-primary',
                                    i === step &&
                                        'border-primary bg-primary text-primary-foreground',
                                )}
                            >
                                {i < step ? (
                                    <Check className="size-4" />
                                ) : (
                                    i + 1
                                )}
                            </span>
                            <span className="hidden sm:inline">{t(label)}</span>
                        </button>
                        {i < STEPS.length - 1 && (
                            <span className="h-px flex-1 bg-border" />
                        )}
                    </li>
                ))}
            </ol>

            {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid content-start gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="customer-user_id">
                                {t('User')}{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <SelectField
                                id="customer-user_id"
                                value={form.data.user_id}
                                placeholder={t('Select a user')}
                                onChange={(e) => {
                                    const user = users.find(
                                        (u) => String(u.id) === e.target.value,
                                    );
                                    form.setData({
                                        ...form.data,
                                        user_id: e.target.value,
                                        contact_person_name:
                                            form.data.contact_person_name ||
                                            user?.name ||
                                            '',
                                        contact_person_email:
                                            form.data.contact_person_email ||
                                            user?.email ||
                                            '',
                                    });
                                }}
                            >
                                {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name} ({user.email})
                                    </option>
                                ))}
                            </SelectField>
                            <p className="text-xs text-muted-foreground">
                                {t(
                                    'Note: Only users with client role who are not already assigned to other customers will appear in this list.',
                                )}
                            </p>
                            <InputError message={errors.user_id} />
                        </div>
                        {field(
                            'company_name',
                            'Company Name',
                            true,
                            'Enter company name',
                        )}
                        {field(
                            'tax_number',
                            'Tax Number (TIN)',
                            false,
                            'e.g. C20830570210',
                            'Needed for LHDN e-invoices.',
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="customer-id_type">
                                {t('ID Type')}
                            </Label>
                            <SelectField
                                id="customer-id_type"
                                value={form.data.id_type}
                                onChange={(e) =>
                                    form.setData('id_type', e.target.value)
                                }
                            >
                                <option value="">{t('None')}</option>
                                <option value="BRN">
                                    {t('Business Registration No. (BRN)')}
                                </option>
                                <option value="NRIC">
                                    {t('MyKad / NRIC')}
                                </option>
                                <option value="PASSPORT">
                                    {t('Passport')}
                                </option>
                                <option value="ARMY">{t('Army ID')}</option>
                            </SelectField>
                            <InputError message={errors.id_type} />
                        </div>
                        {field(
                            'id_number',
                            'ID Number',
                            false,
                            'e.g. 201901000005',
                        )}
                        {form.data.tax_number &&
                            form.data.id_type &&
                            form.data.id_number && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="justify-self-start"
                                    onClick={() =>
                                        router.post(
                                            einvoice.validateTin().url,
                                            {
                                                tin: form.data.tax_number,
                                                id_type: form.data.id_type,
                                                id_number: form.data.id_number,
                                            },
                                            {
                                                preserveState: true,
                                                preserveScroll: true,
                                            },
                                        )
                                    }
                                >
                                    <BadgeCheck /> {t('Validate TIN with LHDN')}
                                </Button>
                            )}
                        {field(
                            'payment_terms',
                            'Payment Terms',
                            false,
                            'e.g., Net 30',
                        )}
                    </div>
                    <div className="grid content-start gap-4">
                        {field(
                            'contact_person_name',
                            'Contact Person',
                            true,
                            'Enter contact person name',
                        )}
                        {field(
                            'contact_person_email',
                            'Email',
                            true,
                            'Enter email address',
                        )}
                        {field(
                            'contact_person_mobile',
                            'Mobile Number',
                            false,
                            '+60123456789',
                            'Format: +[country code][phone number]',
                        )}
                    </div>
                </div>
            )}

            {step === 1 && address('billing_address')}

            {step === 2 && (
                <div className="grid gap-6">
                    <div className="flex items-center gap-3">
                        <Checkbox
                            id="same_as_billing"
                            checked={form.data.same_as_billing}
                            onCheckedChange={(checked) =>
                                form.setData(
                                    'same_as_billing',
                                    checked === true,
                                )
                            }
                        />
                        <Label htmlFor="same_as_billing">
                            {t('Same as billing address')}
                        </Label>
                    </div>
                    {!form.data.same_as_billing && address('shipping_address')}
                    <div className="grid gap-2">
                        <Label htmlFor="customer-notes">{t('Notes')}</Label>
                        <Textarea
                            id="customer-notes"
                            value={form.data.notes}
                            placeholder={t('Enter notes')}
                            onChange={(e) =>
                                form.setData('notes', e.target.value)
                            }
                        />
                        <InputError message={errors.notes} />
                    </div>
                </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3 border-t pt-6">
                {step > 0 ? (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(step - 1)}
                    >
                        <ChevronLeft className="rtl:rotate-180" />
                        {t('Previous')}
                    </Button>
                ) : (
                    <Button type="button" variant="outline" asChild>
                        <Link href={account.customers.index()}>
                            {t('Cancel')}
                        </Link>
                    </Button>
                )}
                {step < STEPS.length - 1 ? (
                    <Button type="submit">
                        {t('Next')}
                        <ChevronRight className="rtl:rotate-180" />
                    </Button>
                ) : (
                    <Button
                        type="submit"
                        disabled={form.processing}
                        className="min-w-28"
                    >
                        {form.processing && <Spinner />}
                        {t('Save')}
                    </Button>
                )}
            </div>
        </form>
    );
}
