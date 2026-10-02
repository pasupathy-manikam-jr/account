import { Plus, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { SelectField } from '@/components/select-field';
import { IdBadge } from '@/components/table-cells';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';

/*
 * Building blocks shared by priced sales documents (proposals, invoices…): the section card, the
 * line-items editor with its live totals, and the read-only items table with its totals.
 */

export type ItemOption = {
    id: number;
    name: string;
    sku: string;
    type: string;
    sale_price: string;
    taxes: { id: number; tax_name: string; rate: string }[];
};

export type EditableLine = {
    item_id: string;
    quantity: string;
    unit_price: string;
    discount_percentage: string;
};

export type SavedLine = {
    id: number;
    item_id: number;
    quantity: string;
    unit_price: string;
    discount_percentage: string;
    discount_amount: string;
    taxes: { name: string; rate: string }[] | null;
    tax_amount: string;
    total_amount: string;
    item?: { name: string; sku: string; description: string | null };
};

export const blankLine: EditableLine = {
    item_id: '',
    quantity: '1',
    unit_price: '0',
    discount_percentage: '0',
};

/** "Sales Tax 10%" already names its rate; plain names get it appended: "GST (6%)". */
export const taxLabel = (name: string, rate: string | number) =>
    name.includes('%') ? name : `${name} (${Number(rate)}%)`;

export const toEditableLines = (lines: SavedLine[] | undefined) =>
    lines?.map((line) => ({
        item_id: String(line.item_id),
        quantity: String(Number(line.quantity)),
        unit_price: line.unit_price,
        discount_percentage: String(Number(line.discount_percentage)),
    })) ?? [blankLine];

// Same maths as App\Support\DocumentTotals, in cents, for the live preview; the server recalculates on save.
const cents = (value: string | number) =>
    Math.round((Number(value) || 0) * 100);
const percentOf = (amount: number, pct: string | number) =>
    Math.round((amount * cents(pct)) / 10000);

export function lineAmounts(line: EditableLine, taxRate: number) {
    const gross = Math.round(
        (cents(line.quantity) * cents(line.unit_price)) / 100,
    );
    const discount = percentOf(gross, line.discount_percentage);
    const tax = percentOf(gross - discount, taxRate);

    return { gross, discount, tax, total: gross - discount + tax };
}

export const itemTaxRate = (item: ItemOption | undefined) =>
    item?.taxes.reduce((sum, tax) => sum + Number(tax.rate), 0) ?? 0;

/** Live document totals (in ringgit) for the editable lines. */
export function useLineTotals(lines: EditableLine[], items: ItemOption[]) {
    const amounts = lines.map((line) =>
        lineAmounts(
            line,
            itemTaxRate(items.find((i) => String(i.id) === line.item_id)),
        ),
    );
    const sum = (key: 'gross' | 'discount' | 'tax' | 'total') =>
        amounts.reduce((total, a) => total + a[key], 0) / 100;

    return {
        amounts,
        subtotal: sum('gross'),
        discount: sum('discount'),
        tax: sum('tax'),
        total: sum('total'),
    };
}

export function DocCard({
    icon: Icon,
    title,
    action,
    children,
}: {
    icon: LucideIcon;
    title: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
                <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" />
                    </span>
                    <h2 className="font-semibold">{t(title)}</h2>
                </div>
                {action}
            </div>
            <div className="p-6">{children}</div>
        </section>
    );
}

export function Fact({
    icon: Icon,
    label,
    children,
}: {
    icon: LucideIcon;
    label: string;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex items-start gap-3">
            <Icon className="mt-0.5 size-4 text-muted-foreground" />
            <div>
                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t(label)}
                </div>
                <div className="mt-0.5 font-medium">{children}</div>
            </div>
        </div>
    );
}

/** The editable product lines: product, qty, unit price, discount %, its taxes and the line total. */
export function LineItemsEditor({
    lines,
    onChange,
    items,
    errors,
}: {
    lines: EditableLine[];
    onChange: (lines: EditableLine[]) => void;
    items: ItemOption[];
    errors: Record<string, string | undefined>;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const { amounts } = useLineTotals(lines, items);
    const itemById = (id: string) => items.find((i) => String(i.id) === id);
    const setLine = (index: number, changes: Partial<EditableLine>) =>
        onChange(
            lines.map((line, i) =>
                i === index ? { ...line, ...changes } : line,
            ),
        );
    const required = <span className="text-destructive">*</span>;

    return (
        <>
            <InputError message={errors.items} />
            <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-sm">
                    <thead className="text-muted-foreground">
                        <tr className="border-b">
                            <th className="py-3 pe-3 text-start font-medium">
                                {t('Product')} {required}
                            </th>
                            <th className="w-24 px-3 py-3 text-start font-medium">
                                {t('Qty')} {required}
                            </th>
                            <th className="w-32 px-3 py-3 text-start font-medium">
                                {t('Unit Price')} {required}
                            </th>
                            <th className="w-24 px-3 py-3 text-start font-medium">
                                {t('Discount %')}
                            </th>
                            <th className="px-3 py-3 text-start font-medium">
                                {t('Tax')}
                            </th>
                            <th className="px-3 py-3 text-end font-medium">
                                {t('Total')}
                            </th>
                            <th className="w-12" />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((line, index) => {
                            const item = itemById(line.item_id);
                            const err = (field: string) =>
                                errors[`items.${index}.${field}`];

                            return (
                                <tr
                                    key={index}
                                    className="border-b align-top last:border-0"
                                >
                                    <td className="py-3 pe-3">
                                        <SelectField
                                            value={line.item_id}
                                            placeholder={t('Select Product')}
                                            aria-label={t('Product')}
                                            aria-invalid={!!err('item_id')}
                                            onChange={(e) =>
                                                setLine(index, {
                                                    item_id: e.target.value,
                                                    unit_price:
                                                        itemById(e.target.value)
                                                            ?.sale_price ??
                                                        line.unit_price,
                                                })
                                            }
                                        >
                                            {items.map((i) => (
                                                <option key={i.id} value={i.id}>
                                                    {i.name} ({i.sku})
                                                </option>
                                            ))}
                                        </SelectField>
                                        <InputError message={err('item_id')} />
                                    </td>
                                    {(
                                        [
                                            'quantity',
                                            'unit_price',
                                            'discount_percentage',
                                        ] as const
                                    ).map((field) => (
                                        <td key={field} className="px-3 py-3">
                                            <Input
                                                inputMode="decimal"
                                                aria-label={t(
                                                    field === 'quantity'
                                                        ? 'Qty'
                                                        : field === 'unit_price'
                                                          ? 'Unit Price'
                                                          : 'Discount %',
                                                )}
                                                aria-invalid={!!err(field)}
                                                value={line[field]}
                                                onChange={(e) =>
                                                    setLine(index, {
                                                        [field]: e.target.value,
                                                    })
                                                }
                                            />
                                            <InputError message={err(field)} />
                                        </td>
                                    ))}
                                    <td className="px-3 py-3 text-xs text-muted-foreground">
                                        {item && item.taxes.length > 0
                                            ? item.taxes.map((tax) => (
                                                  <div key={tax.id}>
                                                      {taxLabel(
                                                          tax.tax_name,
                                                          tax.rate,
                                                      )}
                                                  </div>
                                              ))
                                            : t('No tax')}
                                    </td>
                                    <td className="px-3 py-3 text-end font-medium whitespace-nowrap">
                                        {money(amounts[index].total / 100)}
                                    </td>
                                    <td className="py-3 text-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={t('Remove')}
                                            disabled={lines.length === 1}
                                            onClick={() =>
                                                onChange(
                                                    lines.filter(
                                                        (_, i) => i !== index,
                                                    ),
                                                )
                                            }
                                        >
                                            <Trash2 className="text-destructive" />
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <button
                type="button"
                onClick={() => onChange([...lines, blankLine])}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 py-3 text-sm font-medium text-primary hover:bg-primary/10"
            >
                <Plus className="size-4" /> {t('Add another item')}
            </button>
        </>
    );
}

/** Subtotal / discount / tax / total rows, optionally followed by paid and balance due. */
export function TotalsList({
    subtotal,
    discount,
    tax,
    total,
    paid,
    balance,
    paidLabel = 'Paid Amount',
    balanceLabel = 'Balance Due',
    className = 'grid gap-3 text-sm',
}: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paid?: number;
    balance?: number;
    paidLabel?: string;
    balanceLabel?: string;
    className?: string;
}) {
    const { t } = useTranslation();
    const { money } = useFormat();

    return (
        <dl className={className}>
            <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('Subtotal')}</dt>
                <dd>{money(subtotal)}</dd>
            </div>
            {discount > 0 && (
                <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('Discount')}</dt>
                    <dd className="text-destructive">-{money(discount)}</dd>
                </div>
            )}
            <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('Tax')}</dt>
                <dd>{money(tax)}</dd>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
                <dt className="font-semibold">{t('Total Amount')}</dt>
                <dd className="text-xl font-bold text-primary">
                    {money(total)}
                </dd>
            </div>
            {paid !== undefined && (
                <>
                    <div className="flex justify-between">
                        <dt className="text-muted-foreground">
                            {t(paidLabel)}
                        </dt>
                        <dd className="text-emerald-600 dark:text-emerald-400">
                            {money(paid)}
                        </dd>
                    </div>
                    <div className="flex items-center justify-between border-t pt-3">
                        <dt className="font-semibold">{t(balanceLabel)}</dt>
                        <dd className="text-xl font-bold">
                            {money(balance ?? 0)}
                        </dd>
                    </div>
                </>
            )}
        </dl>
    );
}

/** Read-only lines with SKU, description and the per-tax breakdown. */
export function LineItemsTable({ lines }: { lines: SavedLine[] }) {
    const { t } = useTranslation();
    const { money } = useFormat();

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
                <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                    <tr className="border-b">
                        <th className="py-3 pe-3 text-start font-medium">
                            {t('Product')}
                        </th>
                        <th className="px-3 py-3 text-end font-medium">
                            {t('Qty')}
                        </th>
                        <th className="px-3 py-3 text-end font-medium">
                            {t('Unit Price')}
                        </th>
                        <th className="px-3 py-3 text-end font-medium">
                            {t('Discount')}
                        </th>
                        <th className="px-3 py-3 text-end font-medium">
                            {t('Tax')}
                        </th>
                        <th className="py-3 ps-3 text-end font-medium">
                            {t('Total')}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {lines.map((line) => (
                        <tr
                            key={line.id}
                            className="border-b align-top last:border-0"
                        >
                            <td className="py-4 pe-3">
                                <div className="font-medium">
                                    {line.item?.name}
                                </div>
                                <div className="mt-1">
                                    <IdBadge>
                                        {t('SKU')}: {line.item?.sku}
                                    </IdBadge>
                                </div>
                                {line.item?.description && (
                                    <div className="mt-1 max-w-sm text-xs text-muted-foreground">
                                        {line.item.description}
                                    </div>
                                )}
                            </td>
                            <td className="px-3 py-4 text-end">
                                {Number(line.quantity)}
                            </td>
                            <td className="px-3 py-4 text-end whitespace-nowrap">
                                {money(Number(line.unit_price))}
                            </td>
                            <td className="px-3 py-4 text-end whitespace-nowrap">
                                {Number(line.discount_amount)
                                    ? `${money(Number(line.discount_amount))} (${Number(line.discount_percentage)}%)`
                                    : '-'}
                            </td>
                            <td className="px-3 py-4 text-end text-xs whitespace-nowrap">
                                {(line.taxes ?? []).map((tax) => (
                                    <div
                                        key={tax.name}
                                        className="text-muted-foreground"
                                    >
                                        {taxLabel(tax.name, tax.rate)}
                                    </div>
                                ))}
                                <div className="text-sm">
                                    {Number(line.tax_amount)
                                        ? money(Number(line.tax_amount))
                                        : '-'}
                                </div>
                            </td>
                            <td className="py-4 ps-3 text-end font-semibold whitespace-nowrap">
                                {money(Number(line.total_amount))}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
