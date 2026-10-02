export type RetainerPayment = {
    id: number;
    payment_number: string;
    payment_date: string;
    payment_amount: string;
    reference_number: string | null;
    status: 'pending' | 'cleared' | 'cancelled';
    notes: string | null;
    customer: { id: number; name: string; email: string };
    bank_account: {
        id: number;
        account_name: string;
        bank_name: string;
        account_number?: string;
    };
    allocations: {
        id: number;
        allocated_amount: string;
        retainer: {
            id: number;
            retainer_number: string;
            retainer_date?: string;
            total_amount?: string;
            paid_amount?: string;
            balance_amount?: string | null;
            status?: string;
        };
    }[];
};
