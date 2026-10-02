import { Form, Head, usePage } from '@inertiajs/react';
import {
    BookOpen,
    FileBarChart,
    FileDown,
    Landmark,
    Languages,
    Lock,
    Mail,
    Package,
    PiggyBank,
    Receipt,
    ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import { LanguageSwitcher } from '@/components/language-switcher';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
    canRegister: boolean;
};

// What the system does, for the panel beside the sign-in form. No figures: this page is public.
const features: { icon: LucideIcon; title: string; text: string }[] = [
    {
        icon: BookOpen,
        title: 'Double-Entry Ledger',
        text: 'Every transaction posts balanced journal lines, so the books always add up.',
    },
    {
        icon: Receipt,
        title: 'SST-Ready Invoicing',
        text: 'Proposals, invoices, retainers and credit notes with tax worked out per line.',
    },
    {
        icon: Landmark,
        title: 'Banking & Payments',
        text: 'Bank accounts, transfers, reconciliation and customer and vendor payments.',
    },
    {
        icon: PiggyBank,
        title: 'Budgets & Goals',
        text: 'Plan by account and watch real spending from the ledger against it.',
    },
    {
        icon: Package,
        title: 'Assets & Depreciation',
        text: 'Track assets, assignments and maintenance, and post depreciation.',
    },
    {
        icon: FileBarChart,
        title: 'Reports in a Click',
        text: 'Trial balance, profit and loss, balance sheet, aging and cash flow.',
    },
];

const highlights: { icon: LucideIcon; label: string }[] = [
    { icon: Languages, label: 'English, Malay, Chinese & Arabic' },
    { icon: ShieldCheck, label: 'Roles & permissions' },
    { icon: FileDown, label: 'PDF for every document' },
];

export default function Login({
    status,
    canResetPassword,
    canRegister,
}: Props) {
    const { name } = usePage().props;
    const { t } = useTranslation();

    return (
        <div className="relative grid min-h-dvh bg-background lg:grid-cols-2">
            <Head title={t('Log in')} />

            <div className="absolute end-4 top-4 z-10">
                <LanguageSwitcher />
            </div>

            <div className="flex flex-col px-6 py-10 sm:px-12">
                <div className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-wide">
                    <AppLogoIcon className="size-8 fill-current text-primary" />
                    {name}
                </div>

                <div className="mx-auto my-auto w-full max-w-md py-10">
                    <h1 className="text-3xl font-semibold">
                        {t('Welcome back!')}
                    </h1>
                    <div className="mt-3 h-1 w-8 rounded-full bg-primary" />
                    <p className="mt-5 text-muted-foreground">
                        {t('Sign in to continue to your account')}
                    </p>

                    {status && (
                        <div className="mt-6 text-sm font-medium text-primary">
                            {status}
                        </div>
                    )}

                    <div className="mt-6">
                        <PasskeyVerify />
                    </div>

                    <Form
                        noValidate
                        {...store.form()}
                        resetOnSuccess={['password']}
                        className="mt-8 grid gap-6"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">
                                        {t('Email address')}{' '}
                                        <span className="text-destructive">
                                            *
                                        </span>
                                    </Label>
                                    <div className="relative">
                                        <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            type="email"
                                            name="email"
                                            autoFocus
                                            tabIndex={1}
                                            autoComplete="email"
                                            placeholder="email@example.com"
                                            className="h-11 pl-10"
                                        />
                                    </div>
                                    <InputError message={errors.email} />
                                </div>

                                <div className="grid gap-2">
                                    <div className="flex items-center">
                                        <Label htmlFor="password">
                                            {t('Password')}{' '}
                                            <span className="text-destructive">
                                                *
                                            </span>
                                        </Label>
                                        {canResetPassword && (
                                            <TextLink
                                                href={request()}
                                                className="ml-auto text-sm text-primary no-underline"
                                                tabIndex={5}
                                            >
                                                {t('Forgot password?')}
                                            </TextLink>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <Lock className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <PasswordInput
                                            id="password"
                                            name="password"
                                            tabIndex={2}
                                            autoComplete="current-password"
                                            placeholder={t('Password')}
                                            className="h-11 pl-10"
                                        />
                                    </div>
                                    <InputError message={errors.password} />
                                </div>

                                <div className="flex items-center space-x-3">
                                    <Checkbox
                                        id="remember"
                                        name="remember"
                                        tabIndex={3}
                                    />
                                    <Label htmlFor="remember">
                                        {t('Remember me')}
                                    </Label>
                                </div>

                                <Button
                                    type="submit"
                                    className="mt-2 h-11 w-full"
                                    tabIndex={4}
                                    disabled={processing}
                                    data-test="login-button"
                                >
                                    {processing && <Spinner />}
                                    {t('Login')}
                                </Button>

                                {canRegister && (
                                    <div className="text-center text-sm text-muted-foreground">
                                        {t("Don't have an account?")}{' '}
                                        <TextLink
                                            href={register()}
                                            tabIndex={5}
                                        >
                                            {t('Sign up')}
                                        </TextLink>
                                    </div>
                                )}
                            </>
                        )}
                    </Form>
                </div>

                <p className="text-center text-sm text-muted-foreground">
                    {t('Copyright')} © {name}
                </p>
            </div>

            <div className="hidden flex-col bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 px-12 py-12 lg:flex">
                <h2 className="text-5xl leading-tight font-bold">
                    {t('Manage Your Financial Operations Smarter with')}{' '}
                    <span className="text-primary">{name}</span>
                </h2>
                <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                    {t(
                        'Manage accounts, track invoices, handle expenses and drive growth – all in one powerful platform.',
                    )}
                </p>

                <div className="mt-12 grid max-w-2xl gap-4 sm:grid-cols-2">
                    {features.map(({ icon: Icon, title, text }) => (
                        <div
                            key={title}
                            className="flex gap-4 rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur"
                        >
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Icon className="size-5" />
                            </span>
                            <div>
                                <div className="font-semibold">{t(title)}</div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {t(text)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 flex max-w-2xl flex-wrap gap-x-6 gap-y-3">
                    {highlights.map(({ icon: Icon, label }) => (
                        <span
                            key={label}
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                        >
                            <Icon className="size-4 text-primary" />
                            {t(label)}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
