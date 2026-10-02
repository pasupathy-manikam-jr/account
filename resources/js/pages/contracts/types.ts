export type ContractStatus = 'pending' | 'accepted' | 'declined' | 'closed';

export type Contract = {
    id: number;
    contract_number: string;
    subject: string;
    value: string;
    start_date: string;
    end_date: string;
    description: string | null;
    status: ContractStatus;
    type_id: number;
    user_id: number;
    user: { id: number; name: string; email: string };
    contract_type: { id: number; name: string };
};

export type Party = { id: number; name: string; email: string; type: string };

/** The demo shows an accepted contract as "Active". */
export const statusLabel = (status: string) =>
    status === 'accepted'
        ? 'Active'
        : status.charAt(0).toUpperCase() + status.slice(1);

/** "1 Year 4 Months" and how far through the term today is (0–100). */
export function contractTerm(start: string, end: string) {
    const from = new Date(`${start}T00:00:00`);
    const to = new Date(`${end}T00:00:00`);
    const months = Math.max(
        0,
        (to.getFullYear() - from.getFullYear()) * 12 +
            to.getMonth() -
            from.getMonth(),
    );
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const parts = [
        years ? `${years} ${years === 1 ? 'Year' : 'Years'}` : '',
        rest ? `${rest} ${rest === 1 ? 'Month' : 'Months'}` : '',
    ].filter(Boolean);
    const span = to.getTime() - from.getTime();
    const progress =
        span <= 0
            ? 100
            : Math.min(
                  100,
                  Math.max(
                      0,
                      Math.round(((Date.now() - from.getTime()) / span) * 100),
                  ),
              );

    return { label: parts.join(' ') || 'Less than a month', progress };
}
