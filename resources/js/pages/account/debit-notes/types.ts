import type { SavedLine } from '@/components/sales-document';

export type DebitNote = {
    id: number;
    debit_note_number: string;
    debit_note_date: string;
    reason: string;
    status: 'draft' | 'approved' | 'partial' | 'applied';
    subtotal: string;
    discount_amount: string;
    tax_amount: string;
    total_amount: string;
    applied_amount: string;
    balance_amount: string;
    notes: string | null;
    vendor: { id: number; name: string; email: string };
    invoice: { id: number; invoice_number: string };
    purchase_return: { id: number; return_number: string } | null;
    approver?: { id: number; name: string } | null;
    items?: SavedLine[];
};
