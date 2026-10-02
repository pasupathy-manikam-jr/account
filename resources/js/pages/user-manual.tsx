import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { dashboard, userManual } from '@/routes';

type Heading = { id: string; text: string; level: 2 | 3 };

/** Gives every h2/h3 an id and lists them, so the manual gets its own contents menu. */
function withContents(html: string): { html: string; headings: Heading[] } {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const headings: Heading[] = [];

    doc.querySelectorAll('h2, h3').forEach((el) => {
        const text = el.textContent ?? '';
        el.id = text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        headings.push({
            id: el.id,
            text,
            level: el.tagName === 'H2' ? 2 : 3,
        });
    });

    return { html: doc.body.innerHTML, headings };
}

/** README.md rendered on the server; the text is our own file, never user input. */
export default function UserManual({ html }: { html: string }) {
    const { t } = useTranslation();
    const manual = useMemo(() => withContents(html), [html]);
    const [current, setCurrent] = useState(manual.headings[0]?.id);

    // Highlight the section being read: the last heading above the top fifth of the screen.
    useEffect(() => {
        const onScroll = () => {
            const passed = manual.headings.filter(
                (h) =>
                    (document.getElementById(h.id)?.getBoundingClientRect()
                        .top ?? 0) <
                    window.innerHeight / 5,
            );
            setCurrent((passed.at(-1) ?? manual.headings[0])?.id);
        };
        window.addEventListener('scroll', onScroll, { passive: true });

        return () => window.removeEventListener('scroll', onScroll);
    }, [manual]);

    return (
        <>
            <Head title={t('User Manual')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="User Manual"
                    description="How to use each part of the system."
                />
                <div
                    dir="ltr"
                    className="grid items-start gap-6 lg:grid-cols-[16rem_1fr]"
                >
                    <nav
                        aria-label={t('Contents')}
                        className="rounded-xl border bg-card p-3 text-sm shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
                    >
                        <div className="px-2 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {t('Contents')}
                        </div>
                        <ul className="grid gap-0.5">
                            {manual.headings.map((h) => (
                                <li key={h.id}>
                                    <a
                                        href={`#${h.id}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            document
                                                .getElementById(h.id)
                                                ?.scrollIntoView({
                                                    behavior: 'smooth',
                                                });
                                            setCurrent(h.id);
                                        }}
                                        className={cn(
                                            'block rounded-md px-2 py-1.5 transition-colors hover:bg-muted',
                                            h.level === 3 &&
                                                'ps-5 text-muted-foreground',
                                            h.level === 2 && 'font-medium',
                                            current === h.id &&
                                                'bg-primary/10 text-primary',
                                        )}
                                    >
                                        {h.text}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                    <article
                        className="min-w-0 rounded-xl border bg-card p-6 text-sm leading-relaxed shadow-sm md:p-8 [&_:is(h2,h3)]:scroll-mt-20 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:hidden [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_hr]:my-8 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:my-3 [&_table]:my-4 [&_table]:w-full [&_td]:border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_ul]:list-disc [&_ul]:ps-6"
                        dangerouslySetInnerHTML={{ __html: manual.html }}
                    />
                </div>
            </div>
        </>
    );
}

UserManual.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'User Manual', href: userManual() },
    ],
};
