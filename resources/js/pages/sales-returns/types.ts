import type { SavedLine } from '@/components/sales-document';

export type SalesReturn = {
    id: number;
    return_number: string;
    return_date: string;
    reason: string;
    status: 'draft' | 'approved' | 'completed';
    subtotal: string;
    discount_amount: string;
    tax_amount: string;
    total_amount: string;
    notes: string | null;
    customer: { id: number; name: string; email: string };
    warehouse: { id: number; name: string };
    original_invoice?: {
        id: number;
        invoice_number: string;
        invoice_date: string;
    };
    credit_note?: {
        id: number;
        credit_note_number: string;
        status: string;
    } | null;
    items: (SavedLine & {
        item: { name: string; sku: string; description: string | null };
    })[];
};

export const reasonLabel = (reason: string) =>
    reason.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
