<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Accounting module routes
|--------------------------------------------------------------------------
|
| URIs and required permissions mirror the AccountGo demo's sidebar. Every module starts on the
| shared "coming soon" page; a module's own route file in routes/modules/ replaces its entry
| automatically once it is built, so leave this list alone.
|
*/

$modules = [
    'sales-proposals.index' => ['sales-proposals', 'Proposal', 'manage-sales-proposals'],
    'sales-invoices.index' => ['sales-invoices', 'Sales Invoice', 'manage-sales-invoices'],
    'sales-returns.index' => ['sales-returns', 'Sales Invoice Returns', 'manage-sales-return-invoices'],

    'retainers.index' => ['retainers', 'Retainers', 'manage-retainer'],
    'retainer-payments.index' => ['retainer-payments', 'Retainer Payments', 'manage-retainer-payments'],

    'contracts.index' => ['contract', 'Contracts', 'manage-contracts'],
    'contract-types.index' => ['contract-types', 'Contract Types', 'manage-contract-types'],

    'purchase-invoices.index' => ['purchase-invoices', 'Purchase Invoice', 'manage-purchase-invoices'],
    'purchase-returns.index' => ['purchase-returns', 'Purchase Returns', 'manage-purchase-return-invoices'],
    'warehouses.index' => ['warehouses', 'Warehouses', 'manage-warehouses'],
    'transfers.index' => ['transfers', 'Transfers', 'manage-transfers'],

    'product-service.items.index' => ['product-service/items', 'Items', 'manage-product-service-item'],
    'product-service.item-categories.index' => ['product-service/item-categories', 'System Setup', 'manage-product-service-categories'],

    'account.customers.index' => ['account/customers', 'Customers', 'manage-customers'],
    'account.vendors.index' => ['account/vendors', 'Vendors', 'manage-vendors'],
    'account.revenues.index' => ['account/revenues', 'Revenue', 'manage-revenues'],
    'account.expenses.index' => ['account/expenses', 'Expense', 'manage-expenses'],
    'account.bank-accounts.index' => ['account/bank-accounts', 'Bank Accounts', 'manage-bank-accounts'],
    'account.bank-transactions.index' => ['account/bank-transactions', 'Bank Transactions', 'manage-bank-transactions'],
    'account.bank-transfers.index' => ['account/bank-transfers', 'Bank Transfers', 'manage-bank-transfers'],
    'account.customer-payments.index' => ['account/customer-payments', 'Customer Payments', 'manage-customer-payments'],
    'account.vendor-payments.index' => ['account/vendor-payments', 'Vendor Payments', 'manage-vendor-payments'],
    'account.debit-notes.index' => ['account/debit-notes', 'Debit Notes', 'manage-debit-notes'],
    'account.credit-notes.index' => ['account/credit-notes', 'Credit Notes', 'manage-credit-notes'],
    'account.reports.index' => ['account/reports', 'Reports', 'manage-account-reports'],
    'account.chart-of-accounts.index' => ['account/chart-of-accounts', 'Chart Of Accounts', 'manage-chart-of-accounts'],
    'account.account-types.index' => ['account/account-types', 'System Setup', 'manage-account-types'],
    'account.revenue-categories.index' => ['account/revenue-categories', 'Revenue Categories', 'manage-revenue-categories'],
    'account.expense-categories.index' => ['account/expense-categories', 'Expense Categories', 'manage-expense-categories'],

    'goal.goals.index' => ['goal/goals', 'Goals', 'manage-goals'],
    'goal.milestones.index' => ['goal/milestones', 'Milestones', 'manage-goal-milestones'],
    'goal.contributions.index' => ['goal/contributions', 'Contributions', 'manage-goal-contributions'],
    'goal.tracking.index' => ['goal/tracking', 'Tracking', 'manage-goal-tracking'],
    'goal.categories.index' => ['goal/categories', 'Category', 'manage-categories'],

    'budget-planner.budget-periods.index' => ['budget-planner/budget-periods', 'Budget Periods', 'manage-budget-periods'],
    'budget-planner.budgets.index' => ['budget-planner/budgets', 'Budget', 'manage-budgets'],
    'budget-planner.budget-allocations.index' => ['budget-planner/budget-allocations', 'Budget Allocations', 'manage-budget-allocations'],
    'budget-planner.budget-monitoring.index' => ['budget-planner/budget-monitoring', 'Budget Monitoring', 'manage-budget-monitoring'],

    'double-entry.ledger-summary.index' => ['double-entry/ledger-summary', 'Ledger Summary', 'manage-ledger-summary'],
    'double-entry.trial-balance.index' => ['double-entry/trial-balance', 'Trial Balance', 'manage-trial-balance'],
    'double-entry.balance-sheets.index' => ['double-entry/balance-sheets', 'Balance Sheets', 'manage-balance-sheets'],
    'double-entry.profit-loss.index' => ['double-entry/profit-loss', 'Profit & Loss', 'manage-profit-loss'],
    'double-entry.reports.index' => ['double-entry/reports', 'Reports', 'manage-double-entry-reports'],

    'assets.index' => ['assets', 'Assets', 'manage-assets'],
    'asset.asset-assignments.index' => ['asset/asset-assignments', 'Assignments', 'manage-asset-assignments'],
    'asset.asset-locations.index' => ['asset/asset-locations', 'Locations', 'manage-asset-locations'],
    'asset.asset-maintenance.index' => ['asset/asset-maintenance', 'Maintenance', 'manage-asset-maintenance'],
    'asset.asset-depreciation.index' => ['asset/asset-depreciation', 'Depreciation', 'manage-asset-depreciation'],
    'asset.categories.index' => ['asset/categories', 'Category', 'manage-asset-categories'],

    'email-templates.index' => ['email-templates', 'Email Templates', 'manage-email-templates'],
    'notification-templates.index' => ['notification-templates', 'Notification Templates', 'manage-notification-templates'],
    'roles.index' => ['roles', 'Roles', 'manage-roles'],
    'users.index' => ['users', 'Users', 'manage-users'],
    'media-library' => ['media-library', 'Media Library', 'manage-media'],
    'company-settings' => ['company-settings', 'Settings', 'manage-settings'],
];

// Built modules live in routes/modules/*.php and replace their placeholder below.
foreach (glob(__DIR__.'/modules/*.php') ?: [] as $file) {
    require $file;
}

$router = app('router');
$router->getRoutes()->refreshNameLookups();

Route::middleware(['auth', 'verified'])->group(function () use ($modules, $router) {
    foreach ($modules as $name => [$uri, $title, $permission]) {
        if ($router->has($name)) {
            continue;
        }

        Route::inertia($uri, 'coming-soon', ['title' => $title])
            ->middleware("permission:{$permission}")
            ->name($name);
    }
});
