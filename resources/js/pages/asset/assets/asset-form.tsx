import { useForm } from '@inertiajs/react';
import { Package } from 'lucide-react';
import { useState } from 'react';
import DatePicker from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { SelectField } from '@/components/select-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import assetRoutes from '@/routes/assets';

export type Asset = {
    id: number;
    name: string;
    serial_code: string;
    category_id: number;
    location_id: number | null;
    description: string | null;
    purchase_date: string;
    quantity: number;
    unit_price: string;
    purchase_cost: string;
    status: string;
    out_count: number;
    category: { id: number; name: string };
    location: { id: number; name: string } | null;
};

export type Option = { id: number; name: string };

const blank = {
    name: '',
    serial_code: '',
    category_id: '',
    location_id: '',
    description: '',
    purchase_date: '',
    quantity: '1',
    unit_price: '',
};

/** Create / edit dialog for an asset, shared by the register and the asset page. */
export function useAssetForm(categories: Option[], locations: Option[]) {
    const { t } = useTranslation();
    const form = useForm(blank);
    const [editing, setEditing] = useState<Asset | null>(null);
    const [open, setOpen] = useState(false);
    const required = <span className="text-destructive">*</span>;

    const openForm = (asset: Asset | null) => {
        setEditing(asset);
        form.clearErrors();
        form.setData(
            asset
                ? {
                      name: asset.name,
                      serial_code: asset.serial_code,
                      category_id: String(asset.category_id),
                      location_id: asset.location_id
                          ? String(asset.location_id)
                          : '',
                      description: asset.description ?? '',
                      purchase_date: asset.purchase_date,
                      quantity: String(asset.quantity),
                      unit_price: asset.unit_price,
                  }
                : blank,
        );
        setOpen(true);
    };

    const text = (name: 'name' | 'serial_code' | 'quantity' | 'unit_price') => (
        <Input
            id={name}
            inputMode={
                name === 'quantity'
                    ? 'numeric'
                    : name === 'unit_price'
                      ? 'decimal'
                      : undefined
            }
            value={form.data[name]}
            onChange={(e) => form.setData(name, e.target.value)}
        />
    );

    const dialog = (
        <FormDialog
            open={open}
            onOpenChange={setOpen}
            title={editing ? 'Edit Asset' : 'Add Asset'}
            description="What it is, where it lives, and what it cost."
            icon={Package}
            processing={form.processing}
            onSubmit={(e) => {
                e.preventDefault();
                form.submit(
                    editing
                        ? assetRoutes.update(editing.id)
                        : assetRoutes.store(),
                    { preserveScroll: true, onSuccess: () => setOpen(false) },
                );
            }}
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="name">
                        {t('Name')} {required}
                    </Label>
                    {text('name')}
                    <InputError message={form.errors.name} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="serial_code">
                        {t('Serial Code')} {required}
                    </Label>
                    {text('serial_code')}
                    <InputError message={form.errors.serial_code} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="category_id">
                        {t('Category')} {required}
                    </Label>
                    <SelectField
                        id="category_id"
                        value={form.data.category_id}
                        placeholder={t('Select Category')}
                        onChange={(e) =>
                            form.setData('category_id', e.target.value)
                        }
                    >
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </SelectField>
                    <InputError message={form.errors.category_id} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="location_id">{t('Location')}</Label>
                    <SelectField
                        id="location_id"
                        value={form.data.location_id}
                        placeholder={t('Select Location')}
                        onChange={(e) =>
                            form.setData('location_id', e.target.value)
                        }
                    >
                        {locations.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.name}
                            </option>
                        ))}
                    </SelectField>
                    <InputError message={form.errors.location_id} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="purchase_date">
                        {t('Purchase Date')} {required}
                    </Label>
                    <DatePicker
                        key={`purchase-${editing?.id}`}
                        id="purchase_date"
                        name="purchase_date"
                        defaultValue={form.data.purchase_date}
                        onChange={(v) => form.setData('purchase_date', v)}
                    />
                    <InputError message={form.errors.purchase_date} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="quantity">
                        {t('Quantity')} {required}
                    </Label>
                    {text('quantity')}
                    <InputError message={form.errors.quantity} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="unit_price">
                        {t('Unit Price')} {required}
                    </Label>
                    {text('unit_price')}
                    <InputError message={form.errors.unit_price} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="description">{t('Description')}</Label>
                    <Textarea
                        id="description"
                        value={form.data.description}
                        onChange={(e) =>
                            form.setData('description', e.target.value)
                        }
                    />
                    <InputError message={form.errors.description} />
                </div>
            </div>
        </FormDialog>
    );

    return { openForm, dialog };
}
