import { usePage } from '@inertiajs/react';
import type { GlobalSettings } from '@/types/global';

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];
const DAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

// The PHP date() tokens offered in Settings → System (see CompanySettingsController).
const TOKENS: Record<string, (d: Date) => string> = {
    Y: (d) => String(d.getFullYear()),
    m: (d) => pad(d.getMonth() + 1),
    n: (d) => String(d.getMonth() + 1),
    d: (d) => pad(d.getDate()),
    j: (d) => String(d.getDate()),
    M: (d) => MONTHS[d.getMonth()].slice(0, 3),
    F: (d) => MONTHS[d.getMonth()],
    D: (d) => DAYS[d.getDay()].slice(0, 3),
    l: (d) => DAYS[d.getDay()],
    H: (d) => pad(d.getHours()),
    G: (d) => String(d.getHours()),
    h: (d) => pad(d.getHours() % 12 || 12),
    g: (d) => String(d.getHours() % 12 || 12),
    i: (d) => pad(d.getMinutes()),
    s: (d) => pad(d.getSeconds()),
    A: (d) => (d.getHours() < 12 ? 'AM' : 'PM'),
    a: (d) => (d.getHours() < 12 ? 'am' : 'pm'),
};

export function formatPhpDate(date: Date, format: string): string {
    return format
        .split('')
        .map((c) => TOKENS[c]?.(date) ?? c)
        .join('');
}

// "2026-12-29" is a calendar date, not a UTC instant: parse it as local so it never shifts a day.
function toDate(value: string | Date): Date {
    if (value instanceof Date) {
        return value;
    }

    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    return dateOnly
        ? new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3])
        : new Date(value);
}

export function formatMoney(amount: number, s: GlobalSettings): string {
    const [whole, fraction] = Math.abs(amount)
        .toFixed(s.decimalFormat)
        .split('.');
    const grouped = whole.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        s.thousandsSeparator,
    );
    const number = grouped + (fraction ? s.decimalSeparator + fraction : '');
    const space = s.currencySymbolSpace ? ' ' : '';
    // The sign leads the whole amount: -RM24.29, not RM-24.29.
    const sign = amount < 0 && Number(number.replace(/\D/g, '')) > 0 ? '-' : '';

    return s.currencySymbolPosition === 'before'
        ? `${sign}${s.currencySymbol}${space}${number}`
        : `${sign}${number}${space}${s.currencySymbol}`;
}

/**
 * Format dates, times and money the way Settings → System / Currency says.
 */
export function useFormat() {
    const settings = usePage().props.globalSettings;

    return {
        date: (value: string | Date) =>
            formatPhpDate(toDate(value), settings.dateFormat),
        // "10:00:00" style clock times from the API.
        time: (value: string) => {
            const [h, m, sec = '0'] = value.split(':');

            return formatPhpDate(
                new Date(2000, 0, 1, +h, +m, +sec),
                settings.timeFormat,
            );
        },
        // ISO timestamps from the API, shown in the browser's local time.
        dateTime: (value: string | Date) =>
            `${formatPhpDate(toDate(value), settings.dateFormat)} ${formatPhpDate(toDate(value), settings.timeFormat)}`,
        money: (amount: number) => formatMoney(amount, settings),
    };
}
