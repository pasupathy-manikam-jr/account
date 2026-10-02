import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    DollarSign,
    Image as ImageIcon,
    Info,
    Tag,
    Warehouse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useMemo } from 'react';
import InputError from '@/components/input-error';
import { ItemThumb } from '@/components/item-cells';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useFormat } from '@/hooks/use-format';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import productService from '@/routes/product-service';

type Option = { id: number; name: string };

type Item = {
    id: number;
    name: string;
    sku: string;
    type: string;
    category_id: number;
    unit_id: number;
    classification_code: string;
    sale_price: string;
    purchase_price: string;
    description: string | null;
    long_description: string | null;
    is_active: boolean;
    image_url: string | null;
    taxes: { id: number }[];
    stocks: { warehouse_id: number; quantity: string }[];
};

type Props = {
    item: Item | null;
    categories: Option[];
    taxes: { id: number; tax_name: string; rate: string }[];
    units: { id: number; unit_name: string }[];
    warehouses: Option[];
    types: string[];
    /** LHDN e-invoice classification code => description */
    classifications: Record<string, string>;
};

const STOCKED = ['product', 'part'];
const typeLabel = (type: string) =>
    type.charAt(0).toUpperCase() + type.slice(1);

function Section({
    icon: Icon,
    title,
    children,
}: {
    icon: LucideIcon;
    title: string;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <section className="rounded-xl border bg-card">
            <h2 className="flex items-center gap-3 border-b px-6 py-4 font-semibold">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                </span>
                {t(title)}
            </h2>
            <div className="grid gap-4 p-6 sm:grid-cols-2">{children}</div>
        </section>
    );
}

function Field({
    id,
    label,
    required,
    error,
    wide,
    children,
}: {
    id: string;
    label: string;
    required?: boolean;
    error?: string;
    wide?: boolean;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <div className={wide ? 'grid gap-2 sm:col-span-2' : 'grid gap-2'}>
            <Label htmlFor={id}>
                {t(label)}{' '}
                {required && <span className="text-destructive">*</span>}
            </Label>
            {children}
            <InputError message={error} />
        </div>
    );
}

export default function ItemForm({
    item,
    categories,
    taxes,
    units,
    warehouses,
    types,
    classifications,
}: Props) {
    const { t } = useTranslation();
    const { money } = useFormat();
    const form = useForm({
        type: item?.type ?? 'product',
        name: item?.name ?? '',
        sku: item?.sku ?? '',
        category_id: item ? String(item.category_id) : '',
        unit_id: item ? String(item.unit_id) : '',
        classification_code: item?.classification_code ?? '022',
        tax_ids: item?.taxes.map((tax) => tax.id) ?? ([] as number[]),
        sale_price: item?.sale_price ?? '',
        purchase_price: item?.purchase_price ?? '',
        description: item?.description ?? '',
        long_description: item?.long_description ?? '',
        is_active: item?.is_active ?? true,
        image: null as File | null,
        stocks: warehouses.map((warehouse) => ({
            warehouse_id: warehouse.id,
            quantity:
                item?.stocks.find((s) => s.warehouse_id === warehouse.id)
                    ?.quantity ?? '0',
        })),
    });
    const stocked = STOCKED.includes(form.data.type);
    const preview = useMemo(
        () =>
            form.data.image
                ? URL.createObjectURL(form.data.image)
                : (item?.image_url ?? null),
        [form.data.image, item?.image_url],
    );
    const category = categories.find(
        (c) => String(c.id) === form.data.category_id,
    );

    const submit = (e: FormEvent) => {
        e.preventDefault();
        // Files can't travel in a PUT, so edits go as POST with Laravel's method spoofing.
        form.transform((data) => ({
            ...data,
            stocks: stocked ? data.stocks : [],
            ...(item ? { _method: 'put' } : {}),
        }));
        form.post(
            item
                ? productService.items.update.url(item.id)
                : productService.items.store.url(),
            { forceFormData: true, preserveScroll: true },
        );
    };

    const generateSku = () => {
        const prefix = (category?.name ?? 'ITEM')
            .replace(/[^A-Za-z]/g, '')
            .slice(0, 4)
            .toUpperCase();
        form.setData(
            'sku',
            `${prefix}-${form.data.type.slice(0, 4).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
        );
    };

    return (
        <>
            <Head title={t(item ? 'Edit Item' : 'Create Item')} />
            <form
                noValidate
                onSubmit={submit}
                className="flex flex-1 flex-col gap-6 p-4 md:p-6"
            >
                <PageHeader
                    title={item ? 'Edit Item' : 'Create Item'}
                    description="Create a new product or service item to manage stock levels, pricing, taxes, and inventory categories."
                    action={
                        <Button variant="outline" asChild>
                            <Link href={productService.items.index()}>
                                <ArrowLeft className="rtl:rotate-180" />
                                {t('Back')}
                            </Link>
                        </Button>
                    }
                />

                <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
                    <div className="grid gap-6">
                        <Section icon={Info} title="Basic Details">
                            <Field
                                id="item-type"
                                label="Item Type"
                                required
                                error={form.errors.type}
                            >
                                <SelectField
                                    id="item-type"
                                    value={form.data.type}
                                    onChange={(e) =>
                                        form.setData('type', e.target.value)
                                    }
                                >
                                    {types.map((type) => (
                                        <option key={type} value={type}>
                                            {t(typeLabel(type))}
                                        </option>
                                    ))}
                                </SelectField>
                            </Field>
                            <Field
                                id="item-name"
                                label="Name"
                                required
                                error={form.errors.name}
                            >
                                <Input
                                    id="item-name"
                                    value={form.data.name}
                                    onChange={(e) =>
                                        form.setData('name', e.target.value)
                                    }
                                />
                            </Field>
                            <Field
                                id="item-sku"
                                label="SKU"
                                required
                                error={form.errors.sku}
                            >
                                <div className="flex gap-2">
                                    <Input
                                        id="item-sku"
                                        value={form.data.sku}
                                        onChange={(e) =>
                                            form.setData('sku', e.target.value)
                                        }
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={generateSku}
                                    >
                                        {t('Generate')}
                                    </Button>
                                </div>
                            </Field>
                            <Field
                                id="item-category"
                                label="Category"
                                required
                                error={form.errors.category_id}
                            >
                                <SelectField
                                    id="item-category"
                                    value={form.data.category_id}
                                    placeholder={t('Select Category')}
                                    onChange={(e) =>
                                        form.setData(
                                            'category_id',
                                            e.target.value,
                                        )
                                    }
                                >
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </SelectField>
                            </Field>
                            <Field
                                id="item-taxes"
                                label="Tax"
                                error={form.errors.tax_ids}
                                wide
                            >
                                <div
                                    id="item-taxes"
                                    className="flex flex-wrap gap-x-6 gap-y-3 rounded-md border px-4 py-3"
                                >
                                    {taxes.map((tax) => (
                                        <label
                                            key={tax.id}
                                            className="flex items-center gap-2 text-sm"
                                        >
                                            <Checkbox
                                                checked={form.data.tax_ids.includes(
                                                    tax.id,
                                                )}
                                                onCheckedChange={(checked) =>
                                                    form.setData(
                                                        'tax_ids',
                                                        checked
                                                            ? [
                                                                  ...form.data
                                                                      .tax_ids,
                                                                  tax.id,
                                                              ]
                                                            : form.data.tax_ids.filter(
                                                                  (id) =>
                                                                      id !==
                                                                      tax.id,
                                                              ),
                                                    )
                                                }
                                            />
                                            {tax.tax_name} ({Number(tax.rate)}
                                            %)
                                        </label>
                                    ))}
                                </div>
                            </Field>
                            <Field
                                id="item-description"
                                label="Short Description"
                                error={form.errors.description}
                                wide
                            >
                                <Textarea
                                    id="item-description"
                                    rows={2}
                                    value={form.data.description}
                                    onChange={(e) =>
                                        form.setData(
                                            'description',
                                            e.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                id="item-long-description"
                                label="Description"
                                error={form.errors.long_description}
                                wide
                            >
                                <Textarea
                                    id="item-long-description"
                                    rows={5}
                                    value={form.data.long_description}
                                    onChange={(e) =>
                                        form.setData(
                                            'long_description',
                                            e.target.value,
                                        )
                                    }
                                />
                            </Field>
                        </Section>

                        <Section icon={DollarSign} title="Pricing & Units">
                            <Field
                                id="item-sale-price"
                                label="Sale Price"
                                required
                                error={form.errors.sale_price}
                            >
                                <Input
                                    id="item-sale-price"
                                    inputMode="decimal"
                                    value={form.data.sale_price}
                                    onChange={(e) =>
                                        form.setData(
                                            'sale_price',
                                            e.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                id="item-purchase-price"
                                label="Purchase Price"
                                required
                                error={form.errors.purchase_price}
                            >
                                <Input
                                    id="item-purchase-price"
                                    inputMode="decimal"
                                    value={form.data.purchase_price}
                                    onChange={(e) =>
                                        form.setData(
                                            'purchase_price',
                                            e.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                id="item-unit"
                                label="Unit"
                                required
                                error={form.errors.unit_id}
                            >
                                <SelectField
                                    id="item-unit"
                                    value={form.data.unit_id}
                                    placeholder={t('Select Unit')}
                                    onChange={(e) =>
                                        form.setData('unit_id', e.target.value)
                                    }
                                >
                                    {units.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.unit_name}
                                        </option>
                                    ))}
                                </SelectField>
                            </Field>
                            <Field
                                id="item-classification"
                                label="e-Invoice Classification"
                                required
                                error={form.errors.classification_code}
                            >
                                <SelectField
                                    id="item-classification"
                                    value={form.data.classification_code}
                                    onChange={(e) =>
                                        form.setData(
                                            'classification_code',
                                            e.target.value,
                                        )
                                    }
                                >
                                    {Object.entries(classifications).map(
                                        ([code, label]) => (
                                            <option key={code} value={code}>
                                                {code} · {label}
                                            </option>
                                        ),
                                    )}
                                </SelectField>
                            </Field>
                            <div className="flex items-center gap-3 self-end pb-2">
                                <Switch
                                    id="item-active"
                                    checked={form.data.is_active}
                                    onCheckedChange={(checked) =>
                                        form.setData('is_active', checked)
                                    }
                                />
                                <Label htmlFor="item-active">
                                    {t('Is Active')}
                                </Label>
                            </div>
                        </Section>

                        <Section icon={ImageIcon} title="Media Gallery">
                            <Field
                                id="item-image"
                                label="Image"
                                error={form.errors.image}
                                wide
                            >
                                <Input
                                    id="item-image"
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                        form.setData(
                                            'image',
                                            e.target.files?.[0] ?? null,
                                        )
                                    }
                                />
                            </Field>
                        </Section>

                        {stocked && (
                            <Section icon={Warehouse} title="Warehouse Stock">
                                {form.data.stocks.map((row, index) => (
                                    <Field
                                        key={row.warehouse_id}
                                        id={`stock-${row.warehouse_id}`}
                                        label={
                                            warehouses[index]?.name ??
                                            String(row.warehouse_id)
                                        }
                                        error={
                                            form.errors[
                                                `stocks.${index}.quantity` as keyof typeof form.errors
                                            ]
                                        }
                                    >
                                        <Input
                                            id={`stock-${row.warehouse_id}`}
                                            inputMode="decimal"
                                            value={row.quantity}
                                            onChange={(e) =>
                                                form.setData(
                                                    'stocks',
                                                    form.data.stocks.map(
                                                        (s, i) =>
                                                            i === index
                                                                ? {
                                                                      ...s,
                                                                      quantity:
                                                                          e
                                                                              .target
                                                                              .value,
                                                                  }
                                                                : s,
                                                    ),
                                                )
                                            }
                                        />
                                    </Field>
                                ))}
                            </Section>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" asChild>
                                <Link href={productService.items.index()}>
                                    {t('Cancel')}
                                </Link>
                            </Button>
                            <Button
                                type="submit"
                                disabled={form.processing}
                                className="min-w-28"
                            >
                                {form.processing && <Spinner />}
                                {t('Save')}
                            </Button>
                        </div>
                    </div>

                    <aside className="sticky top-20 grid gap-3">
                        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {t('Live Preview')}
                        </div>
                        <div className="overflow-hidden rounded-xl border bg-card">
                            <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                                <ItemThumb
                                    item={{
                                        name: form.data.name,
                                        image_url: preview,
                                    }}
                                    className="size-full rounded-none border-0"
                                />
                            </div>
                            <div className="grid gap-2 p-4">
                                <Badge
                                    variant="outline"
                                    className="w-fit border-indigo-200 bg-indigo-50 text-indigo-700"
                                >
                                    {t(typeLabel(form.data.type))}
                                </Badge>
                                <div className="font-semibold">
                                    {form.data.name || t('Untitled Item')}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Tag className="size-3" />
                                    {form.data.sku || 'SKU-XXXXXXXX'}
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
                                    <div>
                                        <div className="text-xs text-muted-foreground">
                                            {t('Sale Price')}
                                        </div>
                                        <div className="font-semibold text-emerald-600">
                                            {money(
                                                Number(form.data.sale_price) ||
                                                    0,
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground">
                                            {t('Purchase Price')}
                                        </div>
                                        <div className="font-semibold text-orange-600">
                                            {money(
                                                Number(
                                                    form.data.purchase_price,
                                                ) || 0,
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </form>
        </>
    );
}

ItemForm.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Items', href: productService.items.index() },
        { title: 'Item', href: productService.items.index() },
    ],
};
