import { Head, Link, router } from '@inertiajs/react';
import { Building2, Eye, Plus, SquarePen, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { Address } from '@/components/vendor-form';
import { DataTable } from '@/components/data-table';
import type { Column } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { IdBadge } from '@/components/table-cells';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ViewDialog } from '@/components/view-dialog';
import { useCan } from '@/hooks/use-can';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/hooks/use-translation';
import { dashboard } from '@/routes';
import account from '@/routes/account';
import type { Paginated, TableFilters } from '@/types';

type StoredAddress = Partial<Record<keyof Address, string | null>>;

type Vendor = {
    id: number;
    vendor_code: string;
    company_name: string;
    contact_person_name: string;
    contact_person_email: string;
    contact_person_mobile: string | null;
    tax_number: string | null;
    payment_terms: string | null;
    billing_address: StoredAddress;
    shipping_address: StoredAddress | null;
    same_as_billing: boolean;
    notes: string | null;
    user: { id: number; name: string; email: string };
};

function AddressBlock({ address }: { address: StoredAddress }) {
    const place = [address.city, address.state, address.zip_code]
        .filter(Boolean)
        .join(', ');

    return (
        <div className="grid gap-0.5">
            {address.name && (
                <span className="font-semibold">{address.name}</span>
            )}
            {address.address_line_1 && <span>{address.address_line_1}</span>}
            {address.address_line_2 && <span>{address.address_line_2}</span>}
            {place && <span>{place}</span>}
            {address.country && (
                <span className="text-xs text-muted-foreground">
                    {address.country}
                </span>
            )}
        </div>
    );
}

export default function Vendors({
    vendors,
    filters,
}: {
    vendors: Paginated<Vendor>;
    filters: TableFilters;
}) {
    const { t } = useTranslation();
    const getInitials = useInitials();
    const can = useCan();
    const [viewing, setViewing] = useState<Vendor | null>(null);
    const [deleting, setDeleting] = useState<Vendor | null>(null);

    const person = (c: Vendor) => (
        <div className="flex items-center gap-3">
            <Avatar className="size-9">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {getInitials(c.user.name)}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <div className="truncate font-medium">{c.user.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                    {c.company_name}
                </div>
            </div>
        </div>
    );

    const columns: Column<Vendor>[] = [
        {
            key: 'company_name',
            label: 'User',
            className: 'min-w-64',
            sortable: true,
            render: person,
        },
        {
            key: 'vendor_code',
            label: 'Vendor Code',
            sortable: true,
            render: (c) => <IdBadge>{c.vendor_code}</IdBadge>,
        },
        {
            key: 'contact_person_name',
            label: 'Contact Person',
            className: 'min-w-56',
            sortable: true,
            render: (c) => (
                <div className="grid">
                    <span>{c.contact_person_name}</span>
                    {c.contact_person_mobile && (
                        <span className="text-xs text-muted-foreground">
                            {c.contact_person_mobile}
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'contact_person_email',
            label: 'Email',
            sortable: true,
            render: (c) => (
                <a
                    href={`mailto:${c.contact_person_email}`}
                    className="block max-w-48 truncate hover:underline"
                    title={c.contact_person_email}
                >
                    {c.contact_person_email}
                </a>
            ),
        },
        {
            key: 'tax_number',
            label: 'Tax Number',
            render: (c) =>
                c.tax_number ? <IdBadge>{c.tax_number}</IdBadge> : '-',
        },
    ];

    const actions = (c: Vendor) => (
        <>
            {can('view-vendors') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('View')}
                    onClick={() => setViewing(c)}
                >
                    <Eye className="text-emerald-600" />
                </Button>
            )}
            {can('edit-vendors') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Edit')}
                    asChild
                >
                    <Link href={account.vendors.edit(c.id)}>
                        <SquarePen className="text-blue-600" />
                    </Link>
                </Button>
            )}
            {can('delete-vendors') && (
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Delete')}
                    onClick={() => setDeleting(c)}
                >
                    <Trash2 className="text-destructive" />
                </Button>
            )}
        </>
    );

    return (
        <>
            <Head title={t('Vendors')} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="Manage Vendors"
                    description="Manage your vendors, view details and perform actions."
                    action={
                        can('create-vendors') && (
                            <Button asChild>
                                <Link href={account.vendors.create()}>
                                    <Plus /> {t('Add Vendor')}
                                </Link>
                            </Button>
                        )
                    }
                />

                <DataTable
                    data={vendors}
                    columns={columns}
                    filters={filters}
                    url={account.vendors.index()}
                    actions={actions}
                    renderCard={(c, cardActions) => (
                        <div className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5">
                            {person(c)}
                            <div className="flex items-center justify-between gap-2 text-sm">
                                <IdBadge>{c.vendor_code}</IdBadge>
                                {c.payment_terms && (
                                    <span className="text-muted-foreground">
                                        {c.payment_terms}
                                    </span>
                                )}
                            </div>
                            <div className="grid gap-1 text-sm">
                                <span className="font-medium">
                                    {c.contact_person_name}
                                </span>
                                <span className="truncate text-muted-foreground">
                                    {c.contact_person_email}
                                </span>
                            </div>
                            <div className="mt-auto flex justify-end border-t pt-3">
                                {cardActions}
                            </div>
                        </div>
                    )}
                />
            </div>

            <ViewDialog
                open={viewing !== null}
                onClose={() => setViewing(null)}
                icon={Building2}
                title="Vendor Details"
                description={viewing?.company_name}
                fields={
                    viewing
                        ? [
                              [
                                  'Vendor Code',
                                  <IdBadge key="code">
                                      {viewing.vendor_code}
                                  </IdBadge>,
                              ],
                              ['Contact Person', viewing.contact_person_name],
                              ['Company Name', viewing.company_name],
                              ['Email', viewing.contact_person_email],
                              ['Tax Number', viewing.tax_number],
                              ['Mobile', viewing.contact_person_mobile],
                              ['Payment Terms', viewing.payment_terms],
                              [
                                  'Linked User',
                                  `${viewing.user.name} (${viewing.user.email})`,
                              ],
                              [
                                  'Billing Address',
                                  <AddressBlock
                                      key="billing"
                                      address={viewing.billing_address}
                                  />,
                              ],
                              [
                                  'Shipping Address',
                                  viewing.same_as_billing ||
                                  !viewing.shipping_address ? (
                                      t('Same as billing address')
                                  ) : (
                                      <AddressBlock
                                          key="shipping"
                                          address={viewing.shipping_address}
                                      />
                                  ),
                              ],
                              ['Notes', viewing.notes, true],
                          ]
                        : []
                }
            />

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                description="This vendor will be permanently deleted."
                onConfirm={() =>
                    deleting &&
                    router.delete(account.vendors.destroy(deleting.id), {
                        preserveScroll: true,
                        onSuccess: () => setDeleting(null),
                    })
                }
            />
        </>
    );
}

Vendors.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Accounting', href: account.vendors.index() },
        { title: 'Vendors', href: account.vendors.index() },
    ],
};
