import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Props = {
    id?: string;
    name: string;
    defaultValue?: string | null;
    placeholder?: string;
    invalid?: boolean;
    className?: string;
    onChange?: (value: string) => void;
};

/**
 * shadcn date picker that posts a Y-m-d value through a hidden input,
 * so it works inside Inertia's <Form> like any native field.
 */
export default function DatePicker({
    id,
    name,
    defaultValue,
    placeholder = 'Pick a date',
    invalid,
    className,
    onChange,
}: Props) {
    const [value, setValue] = useState(defaultValue ?? '');
    const [open, setOpen] = useState(false);
    const selected = value ? parseISO(value) : undefined;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    aria-invalid={invalid || undefined}
                    className={cn(
                        'w-full justify-start font-normal',
                        !value && 'text-muted-foreground',
                        className,
                    )}
                >
                    <CalendarIcon />
                    {selected ? format(selected, 'dd MMM yyyy') : placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selected}
                    defaultMonth={selected}
                    captionLayout="dropdown"
                    onSelect={(date) => {
                        const next = date ? format(date, 'yyyy-MM-dd') : '';
                        setValue(next);
                        onChange?.(next);
                        setOpen(false);
                    }}
                />
            </PopoverContent>
            <input type="hidden" name={name} value={value} />
        </Popover>
    );
}
