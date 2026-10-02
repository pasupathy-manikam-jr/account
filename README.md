# Accounting – User Manual

A complete accounting and billing system for Malaysian businesses: sales and purchases, banking, payments, double-entry books, budgets, goals and fixed assets, in English, Bahasa Melayu, 中文 and العربية.

Every amount that moves money is posted to the ledger as balanced debit and credit lines, so the reports, balance sheet and profit and loss always agree with the documents behind them.

---

## 1. Getting started

### 1.1 Signing in

1. Open the system's address in your browser. The sign-in page appears.
2. Enter your **email address** and **password**, then click **Login**. Tick **Remember me** to stay signed in on this device.
3. You can also **Sign in with a passkey** if you have registered one under your profile.

**Forgot your password?** Click **Forgot password?**, enter your email and follow the link sent to you.

If your login has been switched off by an administrator, sign-in shows _"Your login has been disabled"_. Contact your administrator.

### 1.2 Roles

| Role        | What they see                                                        |
| ----------- | -------------------------------------------------------------------- |
| **Company** | Everything. The owner of the books.                                  |
| **Staff**   | The parts their role allows (set under **User Management → Roles**). |
| **Client**  | Their own proposals, invoices, retainers, contracts and payments.    |
| **Vendor**  | Their own purchase invoices, returns, debit notes and payments.      |

The sidebar only shows the pages your role can open.

### 1.3 Finding your way around

- **Sidebar:** grouped as Overview, Sales & Revenue, Purchase & Inventory, Accounting & Finance, Communication and System. Use **Search menu…** at the top to jump to any page.
- **Header:** the language switcher (English, Bahasa Melayu, 中文, العربية) and your profile menu (Settings, Log out).
- **Lists:** every list has a search box, **Filters** (for extra filters), status tabs, sortable column headings, page size and pages. Many lists also have a **list / grid** switch.
- **Forms:** required fields are marked with a red **\***. If something is missing or wrong, the message appears under the field when you save.

---

## 2. Dashboard

**Dashboard → Account Dashboard** shows at a glance:

- Total clients and vendors, and the total received from customers and paid to vendors.
- Monthly charts of customer and vendor payments for the last six months.
- The five most recent revenue and expense entries.

---

## 3. Sales & Revenue

### 3.1 Proposal

A quotation to a customer.

1. **Proposal → Create Proposal**. Choose the customer, warehouse, dates and payment terms, then add item lines. Tax and discount are worked out per line.
2. Save as **Draft**, then **Mark as Sent**.
3. The customer (or you) can **Accept** or **Reject** it.
4. An accepted proposal can be **converted to an invoice** in one click.

The **Balance** column shows what is still owed: the full total until it is invoiced, then what is left on the invoice. Download a PDF from the list or the proposal page.

### 3.2 Sales Invoice

1. **Sales Invoice → Create Invoice**. Choose product or service, the customer, warehouse and lines.
2. **Post** the invoice. Posting records the sale in the ledger (Accounts Receivable, Sales Revenue, SST Payable), takes the stock out of the warehouse and records the cost of goods sold.
3. Invoices become **Partial** or **Paid** as customer payments are cleared. Past the due date with money owed they show as **Overdue**.

**Sales Invoice Returns:** record goods coming back from a customer, **Approve** and **Complete** the return to restock the items. Completing a return creates a **Credit Note** for the customer.

### 3.3 Retainer

An advance payment (deposit) before the work is invoiced.

1. Create a retainer like a proposal, **Send** it and have it **Accepted**.
2. Record deposits under **Retainer Payments** and **Clear** them once the money is in the bank.
3. **Convert to Invoice** when ready. The deposits already received settle the new invoice automatically.

The month strip at the top of Retainer Payments narrows the list to one month.

### 3.4 Contract

Manage agreements with clients: value, start and end dates, type and status (Pending, Active, Declined, Closed).

- Inside a contract: attachments, comments, notes, renewals and signatures.
- The document icon opens a **printable contract preview**.
- **Contract Types** are managed from the side form on the Contract Types page.

---

## 4. Purchase & Inventory

### 4.1 Purchase

- **Purchase Invoice:** bills from vendors. Posting a bill brings the stock into the warehouse and records the amount owed (Inventory, Tax Receivable, Accounts Payable).
- **Purchase Returns:** goods sent back to a vendor. Completing a return takes the stock out and creates a **Debit Note**.
- **Warehouses** and **Transfers:** keep stock by location and move it between warehouses.

### 4.2 Product & Service

- **Items:** products, services and parts, with SKU, prices, category, unit and taxes. Stock is tracked per warehouse.
- **System Setup:** item categories, taxes (e.g. SST rates) and units.

---

## 5. Accounting & Finance

### 5.1 Accounting

| Page                                 | Use it to                                                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customers / Vendors**              | Keep company details, contacts, billing and shipping addresses. Each comes with a login for the client or vendor portal.                             |
| **Revenue / Expense**                | Record money received or spent outside invoices and bills. **Approve**, then **Post** to the ledger.                                                 |
| **Banking → Bank Accounts**          | Your bank, cash and credit accounts, each linked to its ledger account.                                                                              |
| **Banking → Bank Transactions**      | Every movement on your bank accounts, by date, with the running balance. Click the circle to mark a line **Reconciled** against your bank statement. |
| **Banking → Bank Transfers**         | Move money between your accounts. **Process** a pending transfer once the money has moved; bank charges are recorded too.                            |
| **Customer / Vendor Payments**       | Record a payment, allocate it across open invoices or bills, apply credit or debit notes, then **Clear** it.                                         |
| **Debit / Credit Notes**             | Credits from returns, applied against future bills or invoices.                                                                                      |
| **Reports**                          | Invoice and bill aging, tax summary, customer and vendor balances, and a statement for each customer or vendor. Every report downloads as PDF.       |
| **Chart of Accounts / System Setup** | The ledger accounts and account types, plus revenue and expense categories.                                                                          |

The month strip above Revenue, Expense, payments and notes narrows each list to one month.

### 5.2 Goal

- **Goals:** a target amount with start and target dates, type, category and priority. **Activate** a goal to start adding contributions; **Complete** or **Cancel** it later.
- **Contributions:** money put towards an active goal, added from the side form.
- **Milestones:** checkpoints on the way. A milestone is achieved automatically when the goal's contributions reach its amount.
- **Tracking:** each contribution with the running total, progress and pace (ahead, on track, behind, critical).
- **Category:** group goals by purpose.

### 5.3 Budget Planner

1. **Budget Periods:** the time a budget covers (a quarter, a financial year).
2. **Budget:** a plan for one period, of type Operational, Capital or Cash Flow.
3. **Budget Allocations:** split a draft budget across expense accounts.
4. Move each period and budget through **Approve → Activate → Close**.
5. **Budget Monitoring:** month by month, what was planned against what the ledger shows was actually spent.

### 5.4 Double Entry

| Page               | Shows                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ledger Summary** | Every journal line, filterable by account and date.                                                                                                         |
| **Trial Balance**  | Each account's debit or credit balance on a date. Debits always equal credits.                                                                              |
| **Balance Sheets** | Assets, liabilities and equity on a date, optionally compared with another date. **Year-End Close** moves the year's profit or loss into Retained Earnings. |
| **Profit & Loss**  | Revenue and expenses for a period, and the net profit.                                                                                                      |
| **Reports**        | General ledger, account statement, journal entries, cash flow and expenses by month.                                                                        |

### 5.5 Assets

- **Assets:** the register: name, serial code, category, location, purchase date, quantity and unit price. Status is Available, Assigned or Under Maintenance.
- **Assignments:** hand an asset to a member of staff, and record its return and condition.
- **Locations:** buildings, floors, rooms, warehouses and sites, nested inside each other.
- **Maintenance:** schedule a job, then **Start**, **Complete** or **Cancel** it.
- **Depreciation:** straight line, declining balance or sum of years. The page shows book value, a depreciation trend and the methods in use. **Post to Ledger** records the depreciation accrued so far.
- **Category:** asset categories, managed from the side form.

---

## 6. Communication

- **Email Templates:** the emails the system sends (new user, invoice, payment reminder and more), in each language. Click a variable such as `{customer_name}` to insert it; the preview shows the result.
- **Notification Templates:** the short in-app messages, edited the same way.

A language left empty falls back to English.

---

## 7. System

### 7.1 User Management

- **Users:** add staff logins with a role. Change a password, **disable a login** (the person is signed out and can't sign in again; their records stay), or delete a user who has no records. Client and vendor logins come with their customer or vendor record.
- **Roles:** create custom roles and tick exactly which permissions they have. The built-in roles keep their names, and the Company role always has every permission.

### 7.2 Media Library

Upload images, PDFs and office files, sort them into folders, rename, move, download or delete them. Everyone sees only their own files; the company sees all.

### 7.3 Settings

| Section      | Contains                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------- |
| **Company**  | Company name, SSM and SST registration numbers, address and contact details. Printed on every PDF. |
| **System**   | Date and time format, and the default language for new visitors.                                   |
| **Currency** | Currency symbol and its position, decimal places and separators, with a live preview.              |
| **Email**    | SMTP server for outgoing email, and a **Send Test** button to check it.                            |

Your own name, password, two-factor authentication and passkeys are under **Settings** in the profile menu.

---

## 8. Tips

- **Nothing changes the books without a journal entry.** Drafts can be edited and deleted; once posted, approved or cleared, a document is locked and its effect is in the ledger.
- **Balances are never typed in.** Account balances, budget spending, goal progress and report totals are all worked out from the posted entries.
- **Use the month strip and Filters** to find a period quickly, and **Download PDF** for anything you need to send or file.
