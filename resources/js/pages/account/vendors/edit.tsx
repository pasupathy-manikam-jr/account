import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { blankAddress, VendorForm } from '@/components/vendor-form';
import type { Address } from '@/components/vendor-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import account from '@/routes/account';

type Vendor = {
    id: number;
    user_id: number;
    vendor_code: string;
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

export default function EditVendor({
    vendor,
    users,
}: {
    vendor: Vendor;
    users: { id: number; name: string; email: string }[];
}) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Edit Vendor')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Edit Vendor"
                    description="Update the vendor's general profile, billing, and shipping details."
                    action={
                        <Button variant="outline" asChild>
                            <Link href={account.vendors.index()}>
                                <ArrowLeft className="rtl:rotate-180" />
                                {t('Back')}
                            </Link>
                        </Button>
                    }
                />
                <VendorForm
                    users={users}
                    vendorId={vendor.id}
                    initial={{
                        user_id: String(vendor.user_id),
                        company_name: vendor.company_name,
                        contact_person_name: vendor.contact_person_name,
                        contact_person_email: vendor.contact_person_email,
                        contact_person_mobile:
                            vendor.contact_person_mobile ?? '',
                        tax_number: vendor.tax_number ?? '',
                        payment_terms: vendor.payment_terms ?? '',
                        billing_address: toAddress(vendor.billing_address),
                        shipping_address: toAddress(vendor.shipping_address),
                        same_as_billing: vendor.same_as_billing,
                        notes: vendor.notes ?? '',
                    }}
                />
            </div>
        </>
    );
}

EditVendor.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.vendors.index() },
        { title: 'Vendors', href: account.vendors.index() },
        { title: 'Edit', href: account.vendors.index() },
    ],
};
