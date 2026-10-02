import account from '@/routes/account';

export type Kind = 'customer' | 'vendor';

export type Payment = {
    id: number;
    kind: Kind;
    payment_number: string;
    payment_date: string;
    payment_amount: string;
    reference_number: string | null;
    status: 'pending' | 'cleared' | 'cancelled';
    notes: string | null;
    party: { id: number; name: string; email: string };
    bank_account: {
        id: number;
        account_name: string;
        bank_name: string;
        account_number?: string;
    };
    allocations: {
        id: number;
        allocated_amount: string;
        invoice: {
            id: number;
            invoice_number: string;
            total_amount: string;
            status: string;
        };
    }[];
    note_applications?: {
        id: number;
        applied_amount: string;
        note: {
            id: number;
            credit_note_number?: string;
            debit_note_number?: string;
            total_amount: string;
        };
    }[];
};

/** Routes, permission names and labels per kind. */
export const kindConfig = (kind: Kind) =>
    kind === 'customer'
        ? {
              routes: account.customerPayments,
              perm: 'customer-payments',
              party: 'Customer',
              title: 'Customer Payments',
              note: 'Credit Notes',
          }
        : {
              routes: account.vendorPayments,
              perm: 'vendor-payments',
              party: 'Vendor',
              title: 'Vendor Payments',
              note: 'Debit Notes',
          };
