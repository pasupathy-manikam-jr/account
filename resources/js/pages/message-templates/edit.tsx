import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Braces, Eye, Save } from 'lucide-react';
import { useRef, useState } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { DocCard } from '@/components/sales-document';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import emailTemplates from '@/routes/email-templates';
import { CHANNELS } from './index';

type Content = { locale: string; subject: string | null; body: string };

/** "{customer_name}" → "Customer Name", so the preview reads naturally. */
const sample = (variable: string) =>
    variable.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function EditMessageTemplate({
    channel,
    template,
    contents,
}: {
    channel: keyof typeof CHANNELS;
    template: {
        id: number;
        name: string;
        slug: string;
        from_name: string | null;
        variables: string[];
    };
    contents: Record<string, Content>;
}) {
    const { t } = useTranslation();
    const { locales } = usePage().props;
    const config = CHANNELS[channel];
    const email = channel === 'email';
    const [locale, setLocale] = useState('en');
    const body = useRef<HTMLTextAreaElement>(null);
    const form = useForm({
        locale: 'en',
        from_name: template.from_name ?? '',
        subject: contents.en?.subject ?? '',
        body: contents.en?.body ?? '',
    });

    const switchTo = (next: string) => {
        setLocale(next);
        form.clearErrors();
        form.setData({
            ...form.data,
            locale: next,
            subject: contents[next]?.subject ?? '',
            body: contents[next]?.body ?? '',
        });
    };

    // Put {variable} at the cursor in the message.
    const insert = (variable: string) => {
        const el = body.current;
        const token = `{${variable}}`;
        const at = el?.selectionStart ?? form.data.body.length;
        form.setData(
            'body',
            form.data.body.slice(0, at) +
                token +
                form.data.body.slice(el?.selectionEnd ?? at),
        );
        requestAnimationFrame(() => {
            el?.focus();
            el?.setSelectionRange(at + token.length, at + token.length);
        });
    };

    const fill = (text: string) =>
        text.replace(/\{(\w+)\}/g, (match, name: string) =>
            template.variables.includes(name) ? `[${sample(name)}]` : match,
        );

    return (
        <>
            <Head title={t(template.name)} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title={t('Edit Template: :name', {
                        name: t(template.name),
                    })}
                    description="Edit the wording for each language. A language left empty falls back to English."
                    action={
                        <Button variant="outline" asChild>
                            <Link href={config.routes.index()}>
                                <ArrowLeft className="rtl:rotate-180" />{' '}
                                {t('Back')}
                            </Link>
                        </Button>
                    }
                />
                <div className="grid items-start gap-6 xl:grid-cols-[1fr_22rem]">
                    <form
                        noValidate
                        className="grid min-w-0 gap-6"
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.put(config.routes.update(template.id).url, {
                                preserveScroll: true,
                            });
                        }}
                    >
                        <DocCard icon={Save} title="Template Content">
                            <div
                                role="tablist"
                                className="-mt-2 mb-5 flex flex-wrap gap-x-2 border-b"
                            >
                                {Object.entries(locales).map(
                                    ([code, [label]]) => (
                                        <button
                                            key={code}
                                            type="button"
                                            role="tab"
                                            aria-selected={locale === code}
                                            onClick={() => switchTo(code)}
                                            className={cn(
                                                '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
                                                locale === code
                                                    ? 'border-primary text-primary'
                                                    : 'border-transparent text-muted-foreground hover:text-foreground',
                                            )}
                                        >
                                            {label}
                                            {!contents[code] && (
                                                <span className="ms-1 text-xs text-muted-foreground">
                                                    ({t('empty')})
                                                </span>
                                            )}
                                        </button>
                                    ),
                                )}
                            </div>
                            <div
                                className="grid gap-4"
                                dir={locale === 'ar' ? 'rtl' : undefined}
                            >
                                {email && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="from_name">
                                            {t('From Name')}
                                        </Label>
                                        <Input
                                            id="from_name"
                                            dir="ltr"
                                            value={form.data.from_name}
                                            onChange={(e) =>
                                                form.setData(
                                                    'from_name',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={form.errors.from_name}
                                        />
                                    </div>
                                )}
                                {email && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="subject">
                                            {t('Subject')}{' '}
                                            <span className="text-destructive">
                                                *
                                            </span>
                                        </Label>
                                        <Input
                                            id="subject"
                                            value={form.data.subject}
                                            onChange={(e) =>
                                                form.setData(
                                                    'subject',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={form.errors.subject}
                                        />
                                    </div>
                                )}
                                <div className="grid gap-2">
                                    <Label htmlFor="body">
                                        {t(
                                            email
                                                ? 'Email Message'
                                                : 'Notification Message',
                                        )}{' '}
                                        <span className="text-destructive">
                                            *
                                        </span>
                                    </Label>
                                    <Textarea
                                        id="body"
                                        ref={body}
                                        rows={email ? 14 : 4}
                                        className="font-mono text-sm"
                                        value={form.data.body}
                                        onChange={(e) =>
                                            form.setData('body', e.target.value)
                                        }
                                    />
                                    <InputError message={form.errors.body} />
                                </div>
                                <div>
                                    <Button
                                        type="submit"
                                        disabled={form.processing}
                                    >
                                        <Save /> {t('Save Changes')}
                                    </Button>
                                </div>
                            </div>
                        </DocCard>
                    </form>

                    <div className="grid gap-6 xl:sticky xl:top-20">
                        <DocCard icon={Braces} title="Variables">
                            <p className="mb-3 text-xs text-muted-foreground">
                                {t('Click one to insert it into the message.')}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {template.variables.map((v) => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => insert(v)}
                                        className="rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs hover:border-primary hover:text-primary"
                                    >
                                        {`{${v}}`}
                                    </button>
                                ))}
                            </div>
                        </DocCard>
                        <DocCard icon={Eye} title="Preview">
                            <div
                                className="grid gap-2 text-sm"
                                dir={locale === 'ar' ? 'rtl' : undefined}
                            >
                                {email && (
                                    <div className="font-semibold">
                                        {fill(form.data.subject)}
                                    </div>
                                )}
                                <div className="whitespace-pre-line text-muted-foreground">
                                    {fill(form.data.body)}
                                </div>
                            </div>
                        </DocCard>
                    </div>
                </div>
            </div>
        </>
    );
}

EditMessageTemplate.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Communication', href: emailTemplates.index() },
        { title: 'Edit Template', href: emailTemplates.index() },
    ],
};
