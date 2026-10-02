import type { SavedLine } from '@/components/sales-document';

export type InvoiceStatus = 'draft' | 'posted' | 'partial' | 'paid';

export type Invoice = {
    id: number;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    vendor_id: number;
    warehouse_id: number;
    subtotal: string;
    discount_amount: string;
    tax_amount: string;
    total_amount: string;
    paid_amount: string;
    balance_amount: string;
    status: InvoiceStatus;
    display_status: InvoiceStatus | 'overdue';
    payment_terms: string | null;
    notes: string | null;
    vendor: { id: number; name: string; email: string };
    warehouse?: { id: number; name: string };
    items?: SavedLine[];
};
