export type RetainerStatus =
    | 'draft'
    | 'sent'
    | 'accepted'
    | 'rejected'
    | 'partial'
    | 'paid';

export type CustomerOption = {
    id: number;
    name: string;
    email: string;
    company_name: string | null;
    payment_terms: string | null;
};

import type { SavedLine } from '@/components/sales-document';

export type RetainerLine = SavedLine;

export type Retainer = {
    id: number;
    retainer_number: string;
    retainer_date: string;
    due_date: string;
    customer_id: number;
    warehouse_id: number;
    subtotal: string;
    discount_amount: string;
    tax_amount: string;
    total_amount: string;
    paid_amount: string;
    balance_amount: string;
    status: RetainerStatus;
    invoice_id: number | null;
    display_status: RetainerStatus | 'overdue';
    payment_terms: string | null;
    notes: string | null;
    customer: { id: number; name: string; email: string };
    items?: RetainerLine[];
};
