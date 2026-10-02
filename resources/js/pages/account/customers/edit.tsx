import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { blankAddress, CustomerForm } from '@/components/customer-form';
import type { Address } from '@/components/customer-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import account from '@/routes/account';

type Customer = {
    id: number;
    user_id: number;
    customer_code: string;
    company_name: string;
    contact_person_name: string;
    contact_person_email: string;
    contact_person_mobile: string | null;
    tax_number: string | null;
    payment_terms: string | null;
    billing_address: Partial<Record<keyof Address, string | null>>;
    shipping_address: Partial<Record<keyof Address, string | null>> | null;
    same_as_billing: boolean;
    notes: string | null;
};

// Stored addresses may miss keys or hold nulls; the form wants every key as a string.
const toAddress = (
    value: Partial<Record<keyof Address, string | null>> | null,
): Address =>
    Object.fromEntries(
        Object.keys(blankAddress).map((key) => [
            key,
            value?.[key as keyof Address] ??
                (value ? '' : blankAddress[key as keyof Address]),
        ]),
    ) as Address;

export default function EditCustomer({
    customer,
    users,
}: {
    customer: Customer;
    users: { id: number; name: string; email: string }[];
}) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Edit Customer')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Edit Customer"
                    description="Update the customer's general profile, billing, and shipping details."
                    action={
                        <Button variant="outline" asChild>
                            <Link href={account.customers.index()}>
                                <ArrowLeft className="rtl:rotate-180" />
                                {t('Back')}
                            </Link>
                        </Button>
                    }
                />
                <CustomerForm
                    users={users}
                    customerId={customer.id}
                    initial={{
                        user_id: String(customer.user_id),
                        company_name: customer.company_name,
                        contact_person_name: customer.contact_person_name,
                        contact_person_email: customer.contact_person_email,
                        contact_person_mobile:
                            customer.contact_person_mobile ?? '',
                        tax_number: customer.tax_number ?? '',
                        payment_terms: customer.payment_terms ?? '',
                        billing_address: toAddress(customer.billing_address),
                        shipping_address: toAddress(customer.shipping_address),
                        same_as_billing: customer.same_as_billing,
                        notes: customer.notes ?? '',
                    }}
                />
            </div>
        </>
    );
}

EditCustomer.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.customers.index() },
        { title: 'Customers', href: account.customers.index() },
        { title: 'Edit', href: account.customers.index() },
    ],
};
