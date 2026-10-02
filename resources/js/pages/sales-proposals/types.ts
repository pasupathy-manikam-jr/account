export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export type CustomerOption = {
    id: number;
    name: string;
    email: string;
    company_name: string | null;
    payment_terms: string | null;
};

import type { SavedLine } from '@/components/sales-document';

export type ProposalLine = SavedLine;

export type Proposal = {
    id: number;
    proposal_number: string;
    proposal_date: string;
    due_date: string;
    customer_id: number;
    warehouse_id: number;
    subtotal: string;
    discount_amount: string;
    tax_amount: string;
    total_amount: string;
    status: ProposalStatus;
    invoice_id: number | null;
    invoice?: { id: number; balance_amount: string } | null;
    display_status: ProposalStatus | 'overdue';
    payment_terms: string | null;
    notes: string | null;
    customer: { id: number; name: string; email: string };
    items?: ProposalLine[];
};
