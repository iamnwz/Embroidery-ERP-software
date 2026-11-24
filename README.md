# Embroidery Factory Manager

A simple app for keeping an embroidery factory's records. Each page works like a clean Excel sheet: every table has row numbers and a total row, you can search it, and you click a row to edit it.

The main idea: **enter a record once, and the software does the calculating** (stock balances, customer and supplier balances, monthly hisab).

It is for one owner (admin) only. There are no logins and no user roles.

## How to run it

You need Node.js 18 or later.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Database (Supabase)

All records are stored in Supabase (PostgreSQL), not in the browser.

- **Environment variables:** copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. These are public values. Never put a secret or `service_role` key in the app. `.env` is git-ignored.
- **Schema:** the tables and security rules are in `supabase/migrations/`. Apply them with `supabase db push` or the SQL editor.
- **One owner account:** the first person to open the app creates the owner login. After that, the database refuses any other sign-up. Every table uses Row Level Security, so only the logged-in owner can read or write. The publishable key on its own can do nothing except check whether an owner exists.
- **Locked out of the owner account?** Delete the user in Supabase → Authentication → Users. The app will then show "Create owner account" again. The records stay.
- **How saving works:** after login, `src/store/cloud.ts` loads every table into memory. It then saves each change automatically: only the changed records are sent, in the right order, with automatic retry. The sidebar shows "All changes saved", "Saving…" or "Not saved — retrying".

## What it calculates automatically

| What | How |
|---|---|
| Order | Quantity × Rate = Total. Total − Advance − later payments = Balance |
| Stock | Opening + IN − OUT = Balance. Purchases are added as IN automatically. Items at or below their "low stock alert" level are marked **Low**. |
| Customer balance | All orders (except cancelled) − all money received |
| Supplier remaining | All purchases − all payments |
| Salary | Monthly salary + Bonus − Advance − Deduction = Payable |
| Monthly hisab | Sales − (Purchases + Salaries + Expenses) = Profit / Loss (in Reports and in the month-end Excel file) |

The V1 hisab rules are in `monthHisab()` in `src/store/selectors.ts`:

- **Sales** is the value of orders booked in the month, by order date.
- **Spending** is the full value of material purchases, plus salaries from the salary sheet, plus other expenses.

Both rules are kept simple on purpose, so they are easy to change once the owner confirms them.

## Month-end Excel file

You can open it from **Month-end Excel** in the menu, from the Dashboard, from Reports, or from Settings & backup.

1. Pick the month.
2. Download one `.xlsx` workbook, named like `Hisaab-2026-11-November_<Factory>.xlsx`.

Tabs in the workbook:

| Tab | What it holds |
|---|---|
| Hisaab Summary | Sales, received, purchases, salaries, expenses, total spending, profit/loss. Also orders, pieces produced, stock value, money to receive and to pay, and expenses by category. |
| Orders | Orders booked in the month, with Total, Advance, Paid later and Balance |
| Production | Every entry for the month, plus totals by machine and by operator |
| Stock | Opening + IN − OUT = Closing for every item at month end, with Amount and a LOW flag |
| Stock IN-OUT | Every stock entry in the month |
| Purchases | Amount, Paid and Remaining |
| Customers | Opening + Billed − Received = Closing balance, plus the money received during the month |
| Suppliers | Opening + Purchases − Paid = Remaining, plus the payments made during the month |
| Salaries | The month's salary sheet, with Payable |
| Expenses | Every expense, plus totals by category |

How the workbook is styled:

- Arial font throughout.
- A green header row on each tab, which stays visible when you scroll and has filter buttons.
- Totals rows use `SUM` formulas.
- Calculated columns (Total, Balance, Closing, Payable…) are real Excel formulas, so the file keeps adding up if a number is changed.
- Each tab is set up to print landscape on A4.

The code is in `src/lib/monthExport.ts`. The Excel library is loaded only when someone exports, so it doesn't slow down the app.

## Finding things

- **Search anything** (top of the menu, or press Ctrl+K) finds orders, designs, stock items, customers, suppliers, employees, expenses and production. Clicking a result opens that record.
- Every word you type must match, so `seq 301`, `noor 120` or `zari gold` find the right row.
- When entering stock or a purchase, type part of the item's name, type or code and pick it from the list. The list shows how much is in stock.

## Pages

| Page | What it holds |
|---|---|
| Dashboard | Day-to-day view: quick entry buttons, six key figures, deliveries due, low stock, today's production, recent expenses, and who owes what (customers) and what we owe (suppliers) |
| Orders | Order No, Date, Customer, Design, Garment, Pic, Qty, Rate, Total, Advance, Balance, Delivery, Status |
| Production | Date, Machine, Design, Operator, Produced, with totals by machine and by operator |
| Inventory | Tabs for All, SEQ, ZARI, THREAD, FABRIC, PARTS and Low stock. Columns: Opening, IN, OUT, Balance, Rate, Amount. Click an item to see its full IN / OUT / BALANCE record. |
| Purchases | One row per item bought, which goes into stock automatically. The Suppliers tab shows Amount, Paid and Remaining, plus each supplier's khata. |
| Customers | Total billed, Received and Balance, plus each customer's khata |
| Employees / Salaries | Employee list and a monthly salary sheet |
| Expenses | Date, Expense, Category, Amount, Notes |
| Reports | Monthly hisab, daily sales, expenses, customer and supplier balances, current stock, low stock, stock movement, day-by-day production, salaries, orders and purchases. Each one can be printed or saved as a single CSV. |
| Settings & backup | Factory name, backup and restore, reset the sample data, clear all data |

## Code

- React, TypeScript and Vite, with Supabase (PostgreSQL + Auth) as the database.
- `src/types.ts`: record types
- `src/config.ts`: lists you can edit (statuses, garments, inventory categories, designations, expense categories)
- `src/store/store.ts`: data storage. This is the only file to change if the records move to a database later.
- `src/store/selectors.ts`: every calculation (balances, stock, monthly hisab, khata)
- `src/data/seed.ts`: sample data
- `src/components/GlobalSearch.tsx`: the "Search anything" box
- `src/components/ItemPicker.tsx`: the type-to-find stock item picker
- `src/components/ui/index.tsx`: the shared `Sheet` table and other basic UI parts
- `src/components/forms.tsx`: the entry forms
