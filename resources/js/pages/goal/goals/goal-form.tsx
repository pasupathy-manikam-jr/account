import { useForm } from '@inertiajs/react';
import { Target } from 'lucide-react';
import DatePicker from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import InputError from '@/components/input-error';
import { SelectField } from '@/components/select-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/use-translation';
import goalRoutes from '@/routes/goal';
import { GOAL_TYPES, PRIORITIES, titleCase } from './types';
import type { Goal, GoalOptions } from './types';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Add or edit a goal in a modal; `goal` null means add. Mount it only while open, so each opening
 * starts from the goal's saved values.
 */
export function GoalForm({
    onClose,
    goal,
    categories,
    chartOfAccounts,
}: GoalOptions & {
    onClose: () => void;
    goal: Goal | null;
}) {
    const { t } = useTranslation();
    const form = useForm({
        goal_name: goal?.goal_name ?? '',
        description: goal?.description ?? '',
        category_id: goal?.category_id ? String(goal.category_id) : '',
        goal_type: goal?.goal_type ?? 'savings',
        priority: goal?.priority ?? 'medium',
        target_amount: goal?.target_amount ?? '',
        start_date: goal?.start_date ?? today(),
        target_date: goal?.target_date ?? '',
        chart_of_account_id: goal?.chart_of_account_id
            ? String(goal.chart_of_account_id)
            : '',
    });
    const required = <span className="text-destructive">*</span>;

    return (
        <FormDialog
            open
            onOpenChange={(open) => !open && onClose()}
            title={goal ? 'Edit Goal' : 'Create Goal'}
            description="Set a target amount and the dates to reach it by."
            icon={Target}
            processing={form.processing}
            onSubmit={(e) => {
                e.preventDefault();
                form.submit(
                    goal
                        ? goalRoutes.goals.update(goal.id)
                        : goalRoutes.goals.store(),
                    {
                        preserveScroll: true,
                        onSuccess: onClose,
                    },
                );
            }}
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="goal_name">
                        {t('Goal Name')} {required}
                    </Label>
                    <Input
                        id="goal_name"
                        value={form.data.goal_name}
                        onChange={(e) =>
                            form.setData('goal_name', e.target.value)
                        }
                    />
                    <InputError message={form.errors.goal_name} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="category_id">{t('Category')}</Label>
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
                                {c.category_name}
                            </option>
                        ))}
                    </SelectField>
                    <InputError message={form.errors.category_id} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="goal_type">
                        {t('Goal Type')} {required}
                    </Label>
                    <SelectField
                        id="goal_type"
                        value={form.data.goal_type}
                        onChange={(e) =>
                            form.setData('goal_type', e.target.value)
                        }
                    >
                        {GOAL_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {t(titleCase(type))}
                            </option>
                        ))}
                    </SelectField>
                    <InputError message={form.errors.goal_type} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="priority">
                        {t('Priority')} {required}
                    </Label>
                    <SelectField
                        id="priority"
                        value={form.data.priority}
                        onChange={(e) =>
                            form.setData('priority', e.target.value)
                        }
                    >
                        {PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                                {t(titleCase(p))}
                            </option>
                        ))}
                    </SelectField>
                    <InputError message={form.errors.priority} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="target_amount">
                        {t('Target Amount')} {required}
                    </Label>
                    <Input
                        id="target_amount"
                        inputMode="decimal"
                        value={form.data.target_amount}
                        onChange={(e) =>
                            form.setData('target_amount', e.target.value)
                        }
                    />
                    <InputError message={form.errors.target_amount} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="start_date">
                        {t('Start Date')} {required}
                    </Label>
                    <DatePicker
                        id="start_date"
                        name="start_date"
                        defaultValue={form.data.start_date}
                        invalid={!!form.errors.start_date}
                        onChange={(v) => form.setData('start_date', v)}
                    />
                    <InputError message={form.errors.start_date} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="target_date">
                        {t('Target Date')} {required}
                    </Label>
                    <DatePicker
                        id="target_date"
                        name="target_date"
                        defaultValue={form.data.target_date}
                        placeholder={t('Select target date')}
                        invalid={!!form.errors.target_date}
                        onChange={(v) => form.setData('target_date', v)}
                    />
                    <InputError message={form.errors.target_date} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="chart_of_account_id">
                        {t('Chart of Account')}
                    </Label>
                    <SelectField
                        id="chart_of_account_id"
                        value={form.data.chart_of_account_id}
                        placeholder={t('Select GL Account')}
                        onChange={(e) =>
                            form.setData('chart_of_account_id', e.target.value)
                        }
                    >
                        {chartOfAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.account_code} - {a.account_name}
                            </option>
                        ))}
                    </SelectField>
                    <InputError message={form.errors.chart_of_account_id} />
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
}
