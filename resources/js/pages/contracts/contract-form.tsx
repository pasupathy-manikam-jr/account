import { useForm } from '@inertiajs/react';
import { FileSignature } from 'lucide-react';
import DatePicker from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { SelectField } from '@/components/select-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import contracts from '@/routes/contracts';
import { statusLabel } from './types';
import type { Contract, Party } from './types';

const blank = {
    subject: '',
    user_id: '',
    type_id: '',
    value: '',
    start_date: '',
    end_date: '',
    status: 'pending',
    description: '',
};

/** Add / edit a contract (used on the list and the detail page). Render it only while open. */
export function ContractFormDialog({
    open,
    onOpenChange,
    contract,
    users,
    contractTypes,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contract: Contract | null;
    users: Party[];
    contractTypes: { id: number; name: string }[];
}) {
    const { t } = useTranslation();
    // Mounted fresh each time it opens (see the parent), so it starts from the contract being edited.
    const form = useForm(
        contract
            ? {
                  subject: contract.subject,
                  user_id: String(contract.user_id),
                  type_id: String(contract.type_id),
                  value: contract.value,
                  start_date: contract.start_date,
                  end_date: contract.end_date,
                  status: contract.status as string,
                  description: contract.description ?? '',
              }
            : blank,
    );
    const required = <span className="text-destructive">*</span>;

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title={contract ? 'Edit Contract' : 'Add Contract'}
            description="Who the contract is with, its value, term and agreement text."
            icon={FileSignature}
            onSubmit={(e) => {
                e.preventDefault();
                form.submit(
                    contract
                        ? contracts.update(contract.id)
                        : contracts.store(),
                    {
                        preserveScroll: true,
                        onSuccess: () => onOpenChange(false),
                    },
                );
            }}
            processing={form.processing}
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="contract-subject">
                        {t('Subject')} {required}
                    </Label>
                    <Input
                        id="contract-subject"
                        value={form.data.subject}
                        onChange={(e) =>
                            form.setData('subject', e.target.value)
                        }
                    />
                    <InputError message={form.errors.subject} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="contract-user">
                        {t('Assigned to')} {required}
                    </Label>
                    <SelectField
                        id="contract-user"
                        value={form.data.user_id}
                        placeholder={t('Select User')}
                        aria-invalid={!!form.errors.user_id}
                        onChange={(e) =>
                            form.setData('user_id', e.target.value)
                        }
                    >
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </SelectField>
                    <InputError message={form.errors.user_id} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="contract-type">
                        {t('Contract Type')} {required}
                    </Label>
                    <SelectField
                        id="contract-type"
                        value={form.data.type_id}
                        placeholder={t('Select Contract Type')}
                        aria-invalid={!!form.errors.type_id}
                        onChange={(e) =>
                            form.setData('type_id', e.target.value)
                        }
                    >
                        {contractTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                                {type.name}
                            </option>
                        ))}
                    </SelectField>
                    <InputError message={form.errors.type_id} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="contract-value">
                        {t('Contract Value')} {required}
                    </Label>
                    <Input
                        id="contract-value"
                        inputMode="decimal"
                        value={form.data.value}
                        onChange={(e) => form.setData('value', e.target.value)}
                    />
                    <InputError message={form.errors.value} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="contract-status">
                        {t('Status')} {required}
                    </Label>
                    <SelectField
                        id="contract-status"
                        value={form.data.status}
                        onChange={(e) => form.setData('status', e.target.value)}
                    >
                        {['pending', 'accepted', 'declined', 'closed'].map(
                            (s) => (
                                <option key={s} value={s}>
                                    {t(statusLabel(s))}
                                </option>
                            ),
                        )}
                    </SelectField>
                    <InputError message={form.errors.status} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="contract-start">
                        {t('Start Date')} {required}
                    </Label>
                    <DatePicker
                        id="contract-start"
                        name="start_date"
                        defaultValue={form.data.start_date}
                        invalid={!!form.errors.start_date}
                        onChange={(v) => form.setData('start_date', v)}
                    />
                    <InputError message={form.errors.start_date} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="contract-end">
                        {t('End Date')} {required}
                    </Label>
                    <DatePicker
                        id="contract-end"
                        name="end_date"
                        defaultValue={form.data.end_date}
                        invalid={!!form.errors.end_date}
                        onChange={(v) => form.setData('end_date', v)}
                    />
                    <InputError message={form.errors.end_date} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="contract-description">
                        {t('Description')}
                    </Label>
                    <Textarea
                        id="contract-description"
                        rows={4}
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
}
