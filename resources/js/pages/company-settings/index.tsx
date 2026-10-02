import { Head, useForm, usePage } from '@inertiajs/react';
import {
    Building2,
    Coins,
    FileCheck2,
    Mail,
    Save,
    Send,
    SlidersHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { DocCard } from '@/components/sales-document';
import { SelectField } from '@/components/select-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import { formatMoney, formatPhpDate } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { companySettings, dashboard } from '@/routes';
import settingsRoutes from '@/routes/company-settings';
import einvoiceRoutes from '@/routes/einvoice';

type Values = Record<string, string | null>;
type Section = 'company' | 'system' | 'currency' | 'email' | 'einvoice';

type EInvoiceSettings = {
    environment: 'sandbox' | 'production';
    unsigned: boolean;
    client_id: string;
    has_client_secret: boolean;
    has_certificate: boolean;
} | null;

const SECTIONS: {
    key: Section;
    label: string;
    icon: LucideIcon;
    description: string;
}[] = [
    {
        key: 'company',
        label: 'Company',
        icon: Building2,
        description: 'Printed on every invoice, statement and report.',
    },
    {
        key: 'system',
        label: 'System',
        icon: SlidersHorizontal,
        description:
            'How dates and times are shown, and the language for new visitors.',
    },
    {
        key: 'currency',
        label: 'Currency',
        icon: Coins,
        description:
            'How amounts are written everywhere in the app and on PDFs.',
    },
    {
        key: 'email',
        label: 'Email',
        icon: Mail,
        description:
            'The SMTP server used for sending emails. Leave the host empty to use the server default.',
    },
    {
        key: 'einvoice',
        label: 'e-Invoice',
        icon: FileCheck2,
        description:
            'LHDN MyInvois API credentials for the company TIN (set the TIN under Company first). Register an ERP system in the MyInvois portal to get them.',
    },
];

const MALAYSIAN_STATES = [
    'Johor',
    'Kedah',
    'Kelantan',
    'Melaka',
    'Negeri Sembilan',
    'Pahang',
    'Perak',
    'Perlis',
    'Pulau Pinang',
    'Sabah',
    'Sarawak',
    'Selangor',
    'Terengganu',
    'W.P. Kuala Lumpur',
    'W.P. Labuan',
    'W.P. Putrajaya',
];

export default function CompanySettings({
    values,
    hasMailPassword,
    dateFormats,
    timeFormats,
    einvoice,
}: {
    values: Values;
    hasMailPassword: boolean;
    dateFormats: string[];
    timeFormats: string[];
    einvoice: EInvoiceSettings;
}) {
    const { t } = useTranslation();
    const can = useCan();
    const { locales } = usePage().props;
    const [section, setSection] = useState<Section>('company');
    const current = SECTIONS.find((s) => s.key === section)!;
    const pick = (keys: string[]) =>
        Object.fromEntries(keys.map((k) => [k, values[k] ?? ''])) as Record<
            string,
            string
        >;

    const forms = {
        company: useForm(
            pick([
                'company_name',
                'company_registration_no',
                'sst_registration_no',
                'company_address',
                'company_city',
                'company_state',
                'company_postcode',
                'company_country',
                'company_phone',
                'company_email',
                'company_tin',
                'company_id_type',
                'company_msic_code',
                'company_msic_description',
            ]),
        ),
        system: useForm(
            pick(['date_format', 'time_format', 'default_language']),
        ),
        currency: useForm(
            pick([
                'currency_symbol',
                'currency_symbol_position',
                'currency_symbol_space',
                'decimal_format',
                'decimal_separator',
                'thousands_separator',
            ]),
        ),
        email: useForm<Record<string, string>>({
            ...pick([
                'mail_host',
                'mail_port',
                'mail_username',
                'mail_encryption',
                'mail_from_address',
                'mail_from_name',
            ]),
            mail_password: '',
        }),
        einvoice: useForm<Record<string, string>>({
            environment: einvoice?.environment ?? 'sandbox',
            unsigned: einvoice?.unsigned ? '1' : '0',
            client_id: einvoice?.client_id ?? '',
            client_secret: '',
            certificate: '',
            private_key: '',
        }),
    };
    const test = useForm({ test_email: '' });
    const form = forms[section];
    const editable = can(
        `edit-${section === 'einvoice' ? 'company' : section}-settings`,
    );

    const field = (
        name: string,
        label: string,
        opts: {
            required?: boolean;
            placeholder?: string;
            type?: string;
            span?: boolean;
        } = {},
    ) => (
        <div className={cn('grid gap-2', opts.span && 'sm:col-span-2')}>
            <Label htmlFor={name}>
                {t(label)}{' '}
                {opts.required && <span className="text-destructive">*</span>}
            </Label>
            <Input
                id={name}
                type={opts.type ?? 'text'}
                placeholder={opts.placeholder}
                disabled={!editable}
                value={form.data[name] ?? ''}
                onChange={(e) => form.setData(name, e.target.value)}
            />
            <InputError message={form.errors[name]} />
        </div>
    );

    const choice = (
        name: string,
        label: string,
        options: [string, string][],
    ) => (
        <div className="grid gap-2">
            <Label htmlFor={name}>
                {t(label)} <span className="text-destructive">*</span>
            </Label>
            <SelectField
                id={name}
                disabled={!editable}
                value={form.data[name] ?? ''}
                onChange={(e) => form.setData(name, e.target.value)}
            >
                {options.map(([value, text]) => (
                    <option key={value} value={value}>
                        {text}
                    </option>
                ))}
            </SelectField>
            <InputError message={form.errors[name]} />
        </div>
    );

    const sample = new Date(2026, 9, 1, 14, 30);
    const currency = forms.currency.data;
    const preview = formatMoney(1234567.891, {
        companyName: '',
        dateFormat: '',
        timeFormat: '',
        currencySymbol: currency.currency_symbol,
        currencySymbolPosition:
            currency.currency_symbol_position === 'after' ? 'after' : 'before',
        currencySymbolSpace: currency.currency_symbol_space === '1',
        decimalFormat: Number(currency.decimal_format),
        decimalSeparator: currency.decimal_separator,
        thousandsSeparator: currency.thousands_separator,
    });

    return (
        <>
            <Head title={t('Settings')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Settings"
                    description="Company details, display formats, currency and email for the whole system."
                />
                <div className="grid items-start gap-6 lg:grid-cols-[15rem_1fr]">
                    <nav className="grid gap-1 rounded-xl border bg-card p-2 shadow-sm lg:sticky lg:top-20">
                        {SECTIONS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setSection(key)}
                                className={cn(
                                    'flex items-center gap-2 rounded-lg px-3 py-2 text-start text-sm',
                                    section === key
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-muted',
                                )}
                            >
                                <Icon className="size-4" /> {t(label)}
                            </button>
                        ))}
                    </nav>

                    <form
                        noValidate
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.put(
                                section === 'einvoice'
                                    ? einvoiceRoutes.settings().url
                                    : settingsRoutes.update(section).url,
                                { preserveScroll: true },
                            );
                        }}
                    >
                        <DocCard
                            icon={current.icon}
                            title={`${current.label} Settings`}
                        >
                            <p className="-mt-2 mb-5 text-sm text-muted-foreground">
                                {t(current.description)}
                            </p>

                            {section === 'company' && (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {field('company_name', 'Company Name', {
                                        required: true,
                                        span: true,
                                        placeholder: 'Lim Group Sdn. Bhd.',
                                    })}
                                    {field(
                                        'company_registration_no',
                                        'SSM Registration No.',
                                        {
                                            placeholder:
                                                '202301012345 (1502345-K)',
                                        },
                                    )}
                                    {field(
                                        'sst_registration_no',
                                        'SST Registration No.',
                                        { placeholder: 'W10-1808-32000123' },
                                    )}
                                    <div className="grid gap-2 sm:col-span-2">
                                        <Label htmlFor="company_address">
                                            {t('Address')}
                                        </Label>
                                        <Textarea
                                            id="company_address"
                                            disabled={!editable}
                                            value={
                                                form.data.company_address ?? ''
                                            }
                                            onChange={(e) =>
                                                form.setData(
                                                    'company_address',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={
                                                form.errors.company_address
                                            }
                                        />
                                    </div>
                                    {field('company_city', 'City')}
                                    {field('company_postcode', 'Postcode')}
                                    {choice('company_state', 'State', [
                                        ['', t('Select State')],
                                        ...MALAYSIAN_STATES.map(
                                            (s): [string, string] => [s, s],
                                        ),
                                    ])}
                                    {field('company_country', 'Country')}
                                    {field('company_phone', 'Phone', {
                                        placeholder: '+60 3-2161 8888',
                                    })}
                                    {field('company_email', 'Email', {
                                        placeholder: 'akaun@limgroup.com.my',
                                    })}
                                    <div className="mt-2 border-t pt-4 text-sm font-medium sm:col-span-2">
                                        {t('LHDN e-Invoice')}
                                    </div>
                                    {field(
                                        'company_tin',
                                        'Tax Identification No. (TIN)',
                                        {
                                            placeholder: 'C20830570210',
                                        },
                                    )}
                                    {choice(
                                        'company_id_type',
                                        'Registration No. Type',
                                        [
                                            [
                                                'BRN',
                                                t(
                                                    'SSM Business Registration No. (BRN)',
                                                ),
                                            ],
                                            [
                                                'NRIC',
                                                t(
                                                    'MyKad / NRIC (sole proprietor)',
                                                ),
                                            ],
                                        ],
                                    )}
                                    {field('company_msic_code', 'MSIC Code', {
                                        placeholder: '62010',
                                    })}
                                    {field(
                                        'company_msic_description',
                                        'Business Activity (MSIC)',
                                        {
                                            placeholder:
                                                'Computer programming activities',
                                        },
                                    )}
                                </div>
                            )}

                            {section === 'einvoice' && (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {choice('environment', 'Environment', [
                                        ['sandbox', t('Sandbox (testing)')],
                                        ['production', t('Production (live)')],
                                    ])}
                                    {field('client_id', 'Client ID', {
                                        required: true,
                                    })}
                                    {field('client_secret', 'Client Secret', {
                                        type: 'password',
                                        placeholder: einvoice?.has_client_secret
                                            ? t(
                                                  'Saved. Leave blank to keep it.',
                                              )
                                            : '',
                                    })}
                                    {form.data.environment === 'sandbox' && (
                                        <div className="flex items-center gap-2 self-end pb-2">
                                            <Switch
                                                id="unsigned"
                                                disabled={!editable}
                                                checked={
                                                    form.data.unsigned === '1'
                                                }
                                                onCheckedChange={(on) =>
                                                    form.setData(
                                                        'unsigned',
                                                        on ? '1' : '0',
                                                    )
                                                }
                                            />
                                            <Label htmlFor="unsigned">
                                                {t(
                                                    'Send unsigned (no certificate yet)',
                                                )}
                                            </Label>
                                        </div>
                                    )}
                                    {(
                                        ['certificate', 'private_key'] as const
                                    ).map((key) => (
                                        <div
                                            key={key}
                                            className="grid gap-2 sm:col-span-2"
                                        >
                                            <Label htmlFor={key}>
                                                {t(
                                                    key === 'certificate'
                                                        ? 'Signing Certificate (PEM)'
                                                        : 'Private Key (PEM)',
                                                )}
                                            </Label>
                                            <Textarea
                                                id={key}
                                                disabled={!editable}
                                                className="font-mono text-xs"
                                                placeholder={
                                                    einvoice?.has_certificate
                                                        ? t(
                                                              'Saved. Leave blank to keep it.',
                                                          )
                                                        : '-----BEGIN ...-----'
                                                }
                                                value={form.data[key] ?? ''}
                                                onChange={(e) =>
                                                    form.setData(
                                                        key,
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={form.errors[key]}
                                            />
                                        </div>
                                    ))}
                                    {form.data.environment === 'production' && (
                                        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:col-span-2">
                                            {t(
                                                'Production sends real e-invoices to LHDN and needs a CA-issued organisation certificate. Sandbox documents are kept separately.',
                                            )}
                                        </p>
                                    )}
                                </div>
                            )}

                            {section === 'system' && (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {choice(
                                        'date_format',
                                        'Date Format',
                                        dateFormats.map(
                                            (f): [string, string] => [
                                                f,
                                                formatPhpDate(sample, f),
                                            ],
                                        ),
                                    )}
                                    {choice(
                                        'time_format',
                                        'Time Format',
                                        timeFormats.map(
                                            (f): [string, string] => [
                                                f,
                                                formatPhpDate(sample, f),
                                            ],
                                        ),
                                    )}
                                    {choice(
                                        'default_language',
                                        'Default Language',
                                        Object.entries(locales).map(
                                            ([code, [name]]): [
                                                string,
                                                string,
                                            ] => [code, name],
                                        ),
                                    )}
                                </div>
                            )}

                            {section === 'currency' && (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {field(
                                        'currency_symbol',
                                        'Currency Symbol',
                                        { required: true },
                                    )}
                                    {choice(
                                        'currency_symbol_position',
                                        'Symbol Position',
                                        [
                                            ['before', t('Before amount')],
                                            ['after', t('After amount')],
                                        ],
                                    )}
                                    {choice(
                                        'decimal_format',
                                        'Decimal Places',
                                        ['0', '1', '2', '3', '4'].map(
                                            (n): [string, string] => [n, n],
                                        ),
                                    )}
                                    {choice(
                                        'decimal_separator',
                                        'Decimal Separator',
                                        [
                                            ['.', t('Dot (.)')],
                                            [',', t('Comma (,)')],
                                        ],
                                    )}
                                    {choice(
                                        'thousands_separator',
                                        'Thousands Separator',
                                        [
                                            [',', t('Comma (,)')],
                                            ['.', t('Dot (.)')],
                                            [' ', t('Space')],
                                            ['', t('None')],
                                        ],
                                    )}
                                    <div className="flex items-center gap-2 self-end pb-2">
                                        <Switch
                                            id="currency_symbol_space"
                                            disabled={!editable}
                                            checked={
                                                form.data
                                                    .currency_symbol_space ===
                                                '1'
                                            }
                                            onCheckedChange={(on) =>
                                                form.setData(
                                                    'currency_symbol_space',
                                                    on ? '1' : '0',
                                                )
                                            }
                                        />
                                        <Label htmlFor="currency_symbol_space">
                                            {t(
                                                'Space between symbol and amount',
                                            )}
                                        </Label>
                                    </div>
                                    <div className="rounded-lg border bg-muted/40 p-4 sm:col-span-2">
                                        <div className="text-xs text-muted-foreground uppercase">
                                            {t('Preview')}
                                        </div>
                                        <div className="mt-1 text-2xl font-bold tabular-nums">
                                            {preview}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {section === 'email' && (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {field('mail_host', 'SMTP Host', {
                                        placeholder: 'smtp.gmail.com',
                                    })}
                                    {field('mail_port', 'SMTP Port', {
                                        placeholder: '587',
                                    })}
                                    {field('mail_username', 'Username')}
                                    {field('mail_password', 'Password', {
                                        type: 'password',
                                        placeholder: hasMailPassword
                                            ? t(
                                                  'Saved. Leave blank to keep it.',
                                              )
                                            : '',
                                    })}
                                    {choice('mail_encryption', 'Encryption', [
                                        ['tls', 'TLS'],
                                        ['ssl', 'SSL'],
                                        ['none', t('None')],
                                    ])}
                                    {field(
                                        'mail_from_address',
                                        'From Address',
                                        {
                                            placeholder:
                                                'akaun@limgroup.com.my',
                                        },
                                    )}
                                    {field('mail_from_name', 'From Name', {
                                        span: true,
                                    })}
                                </div>
                            )}

                            {editable && (
                                <div className="mt-6 flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={form.processing}
                                    >
                                        <Save /> {t('Save Changes')}
                                    </Button>
                                </div>
                            )}
                        </DocCard>
                    </form>

                    {section === 'email' && can('test-email') && (
                        <form
                            noValidate
                            className="lg:col-start-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                test.post(settingsRoutes.testEmail().url, {
                                    preserveScroll: true,
                                });
                            }}
                        >
                            <DocCard icon={Send} title="Send a Test Email">
                                <div className="flex flex-wrap items-start gap-3">
                                    <div className="grid min-w-64 flex-1 gap-2">
                                        <Input
                                            aria-label={t('Email')}
                                            placeholder="you@example.com"
                                            value={test.data.test_email}
                                            onChange={(e) =>
                                                test.setData(
                                                    'test_email',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={test.errors.test_email}
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        disabled={test.processing}
                                    >
                                        <Send /> {t('Send Test')}
                                    </Button>
                                </div>
                            </DocCard>
                        </form>
                    )}
                </div>
            </div>
        </>
    );
}

CompanySettings.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Settings', href: companySettings() },
    ],
};
