import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { blankAddress, CustomerForm } from '@/components/customer-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import account from '@/routes/account';

export default function CreateCustomer({
    users,
}: {
    users: { id: number; name: string; email: string }[];
}) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Create Customer')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Create Customer"
                    description="Add a new customer with their general profile, billing, and shipping details."
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
                    initial={{
                        user_id: '',
                        company_name: '',
                        contact_person_name: '',
                        contact_person_email: '',
                        contact_person_mobile: '',
                        tax_number: '',
                        payment_terms: '',
                        billing_address: blankAddress,
                        shipping_address: blankAddress,
                        same_as_billing: true,
                        notes: '',
                    }}
                />
            </div>
        </>
    );
}

CreateCustomer.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.customers.index() },
        { title: 'Customers', href: account.customers.index() },
        { title: 'Create', href: account.customers.create() },
    ],
};
