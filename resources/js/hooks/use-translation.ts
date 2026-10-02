import { usePage } from '@inertiajs/react';
import { useEffect, useSyncExternalStore } from 'react';
import { show } from '@/routes/translations';

type Strings = Record<string, string>;

const RTL = new Set(['ar', 'he']);
const cache = new Map<string, Strings>();
const listeners = new Set<() => void>();
let current: Strings = {};
let requested = 'en';

function subscribe(listener: () => void) {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

function activate(strings: Strings) {
    current = strings;
    listeners.forEach((listener) => listener());
}

async function load(locale: string, version: string) {
    const key = `${locale}:${version}`;
    requested = key;

    if (!cache.has(key)) {
        const response = await fetch(
            show.url(locale, { query: { v: version } }),
        );
        cache.set(key, response.ok ? await response.json() : {});
    }

    // Ignore a slow response for a language the user already switched away from.
    if (requested === key) {
        activate(cache.get(key)!);
    }
}

/**
 * Translate UI strings with phrase-keyed files (lang/{locale}.json).
 * English needs no file: a missing key falls back to the key itself.
 */
export function useTranslation() {
    const { locale, translationsVersion } = usePage().props;
    const strings = useSyncExternalStore(
        subscribe,
        () => current,
        () => current,
    );

    useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = RTL.has(locale) ? 'rtl' : 'ltr';

        if (locale === 'en') {
            requested = 'en';
            activate({});
        } else {
            void load(locale, translationsVersion);
        }
    }, [locale, translationsVersion]);

    // Laravel-style ":name" placeholders, matched as whole words (":to" never eats ":total").
    const t = (key: string, replace: Record<string, string | number> = {}) =>
        (strings[key] ?? key).replace(/:(\w+)/g, (match, name: string) =>
            name in replace ? String(replace[name]) : match,
        );

    return { t, locale, isRtl: RTL.has(locale) };
}
