# Accounting modules

The feature set, menu and field names follow the AccountGo demo (https://demo.workdo.io/accountgo), which is used as a functional reference only. All code is our own. Each module lists its screens and the main fields shown in the demo.

Roles: **company** (owner, full access), **staff**, **client** (customer portal) and **vendor** (vendor portal).

## Build order: the sidebar, top to bottom

Modules are built in the order they appear in the sidebar, so each menu item works when you reach it. When an item can't work without something further down the menu (a proposal needs customers and items, for example), that piece is built just before it and noted below.

Everything that posts money goes through the double-entry engine (`App\Support\Ledger::post()`), and all reports read from those journal lines.

**Already built:** app shell, roles and permissions, shared table, form and dialog components, the posting engine, Chart of Accounts, Account Types (System Setup) and Bank Accounts.

### Overview

1. **Dashboard → Account Dashboard** (done, matches the demo): client and vendor counts, payment totals, monthly customer and vendor payment charts, recent revenue and expenses. Payments, revenue and expenses read zero until those modules exist.

### Sales & Revenue

2. **Proposal** (done; _Convert to Invoice_ arrives with Sales Invoice):
    - Line items with tax and discount; send, accept or reject; convert to an invoice.
    - _Built first, because a proposal needs them:_ **Customers**; **Items** with their **System Setup** (categories, taxes, units); and **Warehouses**.
3. **Sales Invoice** (done; _paid/partial_ arrive with Customer Payments):
    - Post and print; due date and overdue; paid and balance amounts.
    - Posts to the ledger: Dr Accounts Receivable, Cr Sales Revenue and SST Payable.
4. **Sales Invoice Returns** (done, with Credit Notes; applying credit notes arrives with Customer Payments): approve and complete; restocks the items.
    - _Built with it:_ **Credit Notes**, which a completed return creates.
5. **Retainers** and **Retainer Payments** (done; cleared deposits post to Customer Deposits and settle the converted invoice): send, accept, duplicate, convert to an invoice.
6. **Contracts** and **Contract Types** (done): value, dates, status, attachments, comments, notes, renewals, signatures.

### Purchase & Inventory

7. **Purchase Invoice** (done, with Vendors):
    - The mirror of sales, for vendors.
    - _Built first:_ **Vendors**.
8. **Purchase Returns** (done, with Debit Notes): approve and complete.
    - _Built with it:_ **Debit Notes**.
9. **Warehouses** (built in step 2) and **Transfers** (done): move stock between warehouses.
10. **Product & Service** (done): Items and System Setup (built in step 2).

### Accounting & Finance

11. **Accounting** (done), in menu order:
    - Customers and Vendors (built in steps 2 and 7).
    - Revenue and Expense (done), with Revenue and Expense Categories added to System Setup.
    - Bank Accounts (built).
    - Bank Transactions (register and reconciliation) and Bank Transfers (done).
    - Customer Payments and Vendor Payments (done), allocated across invoices and bills.
    - Debit Notes and Credit Notes (built in steps 4 and 8).
    - Reports (done): invoice and bill aging, tax summary, customer and vendor balances, and a per-party detail statement read from the ledger.
    - Chart Of Accounts and System Setup (built).
12. **Goal** (done): Goals, Milestones, Contributions, Tracking, Category. Current amounts and tracking pace are worked out from the contributions, and milestones are dated automatically when the running total reaches them.
13. **Budget Planner** (done): Budget Periods and Budgets (draft → approved → active → closed), Budget Allocations per expense account, and Budget Monitoring. Spending is read from the ledger, never typed in.
14. **Double Entry** (done; balance sheets are live with a compare-to date and a real year-end close journal instead of saved snapshots):
    - Ledger Summary, Trial Balance, Balance Sheets (with year-end close), Profit & Loss.
    - Reports: general ledger, account statement, journal entries, cash flow.
15. **Assets** (done): Assets, Assignments (with returns and condition), Locations (nested), Maintenance (scheduled → in progress → completed/cancelled), Depreciation (straight line, declining balance, sum of years; accrued depreciation posts to the ledger), Category.

### Communication

16. **Email Templates** and **Notification Templates** (done): system templates with wording per language (en/ms/zh/ar, falling back to English), a variables list and live preview. Notification templates are in-app texts (the demo's Twilio SMS is left out).

### System

17. **User Management** (done): Roles (custom roles with a grouped permission picker; built-in roles keep their names, the company role is locked) and Users (staff logins with role, password change, enable/disable login enforced at sign-in, welcome email from the New User template). Impersonation and login history are left out.
18. **Media Library** (done): upload (images, PDF and office files; no SVG/HTML), folders, rename/move, download, delete. Everyone sees only their own files and folders; the company sees all.
19. **Settings** (done): Company (name, SSM/SST numbers, address — the letterhead on every PDF), System (date/time format, default language), Currency (symbol, position, decimals, separators — used by the app and PDFs), Email (SMTP, encrypted password, test email). Brand and cache settings are left out.

## Left out

These are SaaS or marketing extras with no accounting value:

- CMS (landing page, custom pages, newsletter subscribers)
- Messenger
- AI assistant
- Twilio and Google reCAPTCHA settings
- Webhooks
- Plans, orders and the super-admin tenant layer
- Pusher, cookie, SEO and storage settings
- Login history and impersonation

Any of these can be added later if needed.
