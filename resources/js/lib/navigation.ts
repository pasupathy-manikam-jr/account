import {
    Banknote,
    BookOpen,
    Boxes,
    Calculator,
    FileSignature,
    FileText,
    Goal,
    Image,
    LayoutGrid,
    Mail,
    Bell,
    Package,
    PiggyBank,
    Receipt,
    Settings,
    ShoppingCart,
    Users,
} from 'lucide-react';
import { companySettings, mediaLibrary, userManual } from '@/routes';
import account from '@/routes/account';
import asset from '@/routes/asset';
import assets from '@/routes/assets';
import budgetPlanner from '@/routes/budget-planner';
import contractTypes from '@/routes/contract-types';
import contracts from '@/routes/contracts';
import doubleEntry from '@/routes/double-entry';
import emailTemplates from '@/routes/email-templates';
import goal from '@/routes/goal';
import notificationTemplates from '@/routes/notification-templates';
import productService from '@/routes/product-service';
import purchaseInvoices from '@/routes/purchase-invoices';
import purchaseReturns from '@/routes/purchase-returns';
import retainerPayments from '@/routes/retainer-payments';
import retainers from '@/routes/retainers';
import roles from '@/routes/roles';
import salesInvoices from '@/routes/sales-invoices';
import salesProposals from '@/routes/sales-proposals';
import salesReturns from '@/routes/sales-returns';
import transfers from '@/routes/transfers';
import users from '@/routes/users';
import warehouses from '@/routes/warehouses';
import type { NavSection } from '@/types';

// Mirrors the AccountGo demo's company sidebar.
// Each entry carries the permission its route requires (see routes/accounting.php); NavMain hides the rest.
export const navigation: NavSection[] = [
    {
        title: 'Overview',
        items: [
            {
                title: 'Dashboard',
                icon: LayoutGrid,
                children: [
                    {
                        title: 'Account Dashboard',
                        href: account.dashboard(),
                        permission: 'manage-account-dashboard',
                    },
                ],
            },
        ],
    },
    {
        title: 'Sales & Revenue',
        items: [
            {
                title: 'Proposal',
                href: salesProposals.index(),
                permission: 'manage-sales-proposals',
                icon: FileText,
            },
            {
                title: 'Sales Invoice',
                icon: Receipt,
                children: [
                    {
                        title: 'Sales Invoice',
                        href: salesInvoices.index(),
                        permission: 'manage-sales-invoices',
                    },
                    {
                        title: 'Sales Invoice Returns',
                        href: salesReturns.index(),
                        permission: 'manage-sales-return-invoices',
                    },
                ],
            },
            {
                title: 'Retainer',
                icon: PiggyBank,
                children: [
                    {
                        title: 'Retainers',
                        href: retainers.index(),
                        permission: 'manage-retainer',
                    },
                    {
                        title: 'Retainer Payments',
                        href: retainerPayments.index(),
                        permission: 'manage-retainer-payments',
                    },
                ],
            },
            {
                title: 'Contract',
                icon: FileSignature,
                children: [
                    {
                        title: 'Contracts',
                        href: contracts.index(),
                        permission: 'manage-contracts',
                    },
                    {
                        title: 'Contract Types',
                        href: contractTypes.index(),
                        permission: 'manage-contract-types',
                    },
                ],
            },
        ],
    },
    {
        title: 'Purchase & Inventory',
        items: [
            {
                title: 'Purchase',
                icon: ShoppingCart,
                children: [
                    {
                        title: 'Purchase Invoice',
                        href: purchaseInvoices.index(),
                        permission: 'manage-purchase-invoices',
                    },
                    {
                        title: 'Purchase Returns',
                        href: purchaseReturns.index(),
                        permission: 'manage-purchase-return-invoices',
                    },
                    {
                        title: 'Warehouses',
                        href: warehouses.index(),
                        permission: 'manage-warehouses',
                    },
                    {
                        title: 'Transfers',
                        href: transfers.index(),
                        permission: 'manage-transfers',
                    },
                ],
            },
            {
                title: 'Product & Service',
                icon: Package,
                children: [
                    {
                        title: 'Items',
                        href: productService.items.index(),
                        permission: 'manage-product-service-item',
                    },
                    {
                        title: 'System Setup',
                        href: productService.itemCategories.index(),
                        match: [
                            productService.taxes.index(),
                            productService.units.index(),
                        ],
                        permission: 'manage-product-service-categories',
                    },
                ],
            },
        ],
    },
    {
        title: 'Accounting & Finance',
        items: [
            {
                title: 'Accounting',
                icon: Calculator,
                children: [
                    {
                        title: 'Customers',
                        href: account.customers.index(),
                        permission: 'manage-customers',
                    },
                    {
                        title: 'Vendors',
                        href: account.vendors.index(),
                        permission: 'manage-vendors',
                    },
                    {
                        title: 'Revenue',
                        href: account.revenues.index(),
                        permission: 'manage-revenues',
                    },
                    {
                        title: 'Expense',
                        href: account.expenses.index(),
                        permission: 'manage-expenses',
                    },
                    {
                        title: 'Banking',
                        href: account.bankAccounts.index(),
                        children: [
                            {
                                title: 'Bank Accounts',
                                href: account.bankAccounts.index(),
                                permission: 'manage-bank-accounts',
                            },
                            {
                                title: 'Bank Transactions',
                                href: account.bankTransactions.index(),
                                permission: 'manage-bank-transactions',
                            },
                            {
                                title: 'Bank Transfers',
                                href: account.bankTransfers.index(),
                                permission: 'manage-bank-transfers',
                            },
                        ],
                    },
                    {
                        title: 'Customer Payments',
                        href: account.customerPayments.index(),
                        permission: 'manage-customer-payments',
                    },
                    {
                        title: 'Vendor Payments',
                        href: account.vendorPayments.index(),
                        permission: 'manage-vendor-payments',
                    },
                    {
                        title: 'Debit Notes',
                        href: account.debitNotes.index(),
                        permission: 'manage-debit-notes',
                    },
                    {
                        title: 'Credit Notes',
                        href: account.creditNotes.index(),
                        permission: 'manage-credit-notes',
                    },
                    {
                        title: 'Reports',
                        href: account.reports.index(),
                        permission: 'manage-account-reports',
                    },
                    {
                        title: 'Chart Of Accounts',
                        href: account.chartOfAccounts.index(),
                        permission: 'manage-chart-of-accounts',
                    },
                    {
                        title: 'System Setup',
                        href: account.accountTypes.index(),
                        match: [
                            account.revenueCategories.index(),
                            account.expenseCategories.index(),
                        ],
                        permission: 'manage-account-types',
                    },
                ],
            },
            {
                title: 'Goal',
                icon: Goal,
                children: [
                    {
                        title: 'Goals',
                        href: goal.goals.index(),
                        permission: 'manage-goals',
                    },
                    {
                        title: 'Milestones',
                        href: goal.milestones.index(),
                        permission: 'manage-goal-milestones',
                    },
                    {
                        title: 'Contributions',
                        href: goal.contributions.index(),
                        permission: 'manage-goal-contributions',
                    },
                    {
                        title: 'Tracking',
                        href: goal.tracking.index(),
                        permission: 'manage-goal-tracking',
                    },
                    {
                        title: 'Category',
                        href: goal.categories.index(),
                        permission: 'manage-categories',
                    },
                ],
            },
            {
                title: 'Budget Planner',
                icon: Banknote,
                children: [
                    {
                        title: 'Budget Periods',
                        href: budgetPlanner.budgetPeriods.index(),
                        permission: 'manage-budget-periods',
                    },
                    {
                        title: 'Budget',
                        href: budgetPlanner.budgets.index(),
                        permission: 'manage-budgets',
                    },
                    {
                        title: 'Budget Allocations',
                        href: budgetPlanner.budgetAllocations.index(),
                        permission: 'manage-budget-allocations',
                    },
                    {
                        title: 'Budget Monitoring',
                        href: budgetPlanner.budgetMonitoring.index(),
                        permission: 'manage-budget-monitoring',
                    },
                ],
            },
            {
                title: 'Double Entry',
                icon: BookOpen,
                children: [
                    {
                        title: 'Ledger Summary',
                        href: doubleEntry.ledgerSummary.index(),
                        permission: 'manage-ledger-summary',
                    },
                    {
                        title: 'Trial Balance',
                        href: doubleEntry.trialBalance.index(),
                        permission: 'manage-trial-balance',
                    },
                    {
                        title: 'Balance Sheets',
                        href: doubleEntry.balanceSheets.index(),
                        permission: 'manage-balance-sheets',
                    },
                    {
                        title: 'Profit & Loss',
                        href: doubleEntry.profitLoss.index(),
                        permission: 'manage-profit-loss',
                    },
                    {
                        title: 'Reports',
                        href: doubleEntry.reports.index(),
                        permission: 'manage-double-entry-reports',
                    },
                ],
            },
            {
                title: 'Assets',
                icon: Boxes,
                children: [
                    {
                        title: 'Assets',
                        href: assets.index(),
                        permission: 'manage-assets',
                    },
                    {
                        title: 'Assignments',
                        href: asset.assetAssignments.index(),
                        permission: 'manage-asset-assignments',
                    },
                    {
                        title: 'Locations',
                        href: asset.assetLocations.index(),
                        permission: 'manage-asset-locations',
                    },
                    {
                        title: 'Maintenance',
                        href: asset.assetMaintenance.index(),
                        permission: 'manage-asset-maintenance',
                    },
                    {
                        title: 'Depreciation',
                        href: asset.assetDepreciation.index(),
                        permission: 'manage-asset-depreciation',
                    },
                    {
                        title: 'Category',
                        href: asset.categories.index(),
                        permission: 'manage-asset-categories',
                    },
                ],
            },
        ],
    },
    {
        title: 'Communication',
        items: [
            {
                title: 'Email Templates',
                href: emailTemplates.index(),
                permission: 'manage-email-templates',
                icon: Mail,
            },
            {
                title: 'Notification Templates',
                href: notificationTemplates.index(),
                permission: 'manage-notification-templates',
                icon: Bell,
            },
        ],
    },
    {
        title: 'System',
        items: [
            {
                title: 'User Management',
                icon: Users,
                children: [
                    {
                        title: 'Roles',
                        href: roles.index(),
                        permission: 'manage-roles',
                    },
                    {
                        title: 'Users',
                        href: users.index(),
                        permission: 'manage-users',
                    },
                ],
            },
            {
                title: 'Media Library',
                href: mediaLibrary(),
                permission: 'manage-media',
                icon: Image,
            },
            {
                title: 'Settings',
                href: companySettings(),
                permission: 'manage-settings',
                icon: Settings,
            },
            {
                title: 'User Manual',
                href: userManual(),
                icon: BookOpen,
            },
        ],
    },
];
