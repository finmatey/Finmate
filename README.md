# FinMate Cloud Setup Guide

## 1. Create Supabase Project
1. Sign up at https://supabase.com and create a new project.
2. Open **SQL Editor** and run `supabase-schema.sql` to create the `finmate_states` table and Row-Level Security policies.
3. Go to **Project Settings -> API** and copy your **Project URL** and **anon public** key.
4. Paste them into the top of `auth.js`:
   ```js
   const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
   ```

## 2. Enable Auth Providers
- **Email/Password:** Enabled by default under *Authentication -> Providers -> Email*. (Optional: turn off "Confirm email" for instant registration during testing.)
- **Google Sign-In:** Enable under *Authentication -> Providers -> Google*, paste your Google OAuth Client ID & Secret, and add your site URL to *Authentication -> URL Configuration -> Redirect URLs*.

## Features
Core: income/expense log, monthly budgets (per category + overall), saving goals, cash-flow chart, search, CSV/JSON export & restore, cloud sync + auth.

Added from the FinMate HTML/CSS/JS version:
- **Multi-wallet** (cash, bank, MoMo, ZaloPay): pick a wallet per transaction, filter by wallet, transfer between wallets (transfers don't count as income/expense), set opening balances.
- **Saving jars**: goals can auto-allocate a % of every new income; quick +100k / +250k; edit goals; completion bonus.
- **Friends' debt ledger** (Plan -> Sổ nợ): lend/borrow, settle (books the money into the wallet), totals.
- **AI assistant tab**: insights, chatbot, forecast of the day you run out of money, month-over-month comparison, 6/12-month report.
- **AI auto budget** (Plan -> Ngân sách): splits income into category budgets (merges with yours, with undo).
- **Rewards tab**: daily check-in streak, weekly budget bonus, FinPoints history, vouchers with QR, savings leaderboard.
- **Dark mode**, student profile (class/grade/school), "load demo data" in Settings.

Older cloud saves are upgraded automatically on load (missing fields/categories/wallets are filled in; nothing is removed).
Run `npm test` for the logic tests (`auth.test.js` needs internet because it imports Supabase from esm.sh).

## Leaderboard (FinPoints rankings)
**Setup (once):** after `supabase-schema.sql`, run `supabase-leaderboard.sql` in the Supabase SQL Editor. Nothing else to configure: it reuses the keys already in `auth.js` (only the public anon/publishable key is ever used in the browser; never put a service-role key in this repo).

**How it works**
- Points live in an append-only `point_events` table. Browsers cannot insert/update/delete it (RLS + revoked grants); only the `claim_*` database functions can, and they take no point values from the client.
- Sources: daily check-in (+15, once/day, streak tracked server-side), completed saving jar (+50, verified against your synced data, max 3/month), weekly budget discipline (+50, once/week: overall budget set, month spending within it, activity on 3+ days).
- Rankings (daily/weekly/monthly/all-time, Vietnam time), scope (all/school/class), username search, pagination and rank movement are computed in `get_leaderboard` / `get_my_rank`. Movement compares with the previous day (or previous day's ranking for "daily"); "Mới" = no points before.
- Privacy: participation is opt-in; only a pseudonymous username and points are visible to others. Email, real name and financial data are never returned. Turning participation off hides you immediately.
- Badges are derived from verified events. The leaderboard rank uses lifetime-earned points, so spending FinPoints on vouchers does not lower it.
- The board refreshes every 45 s while visible and after each claim (polling, not websockets).

**Deploy (GitHub Pages):** commit all files (including `leaderboard.js`, `leaderboard-logic.js`), push, and make sure your Pages URL is in Supabase -> Authentication -> URL Configuration. Bump the service-worker cache name when you change assets (done: `finmate-v5`). Run `npm test`.

**Limitation:** transactions/budgets are stored in the user-editable `finmate_states` row, so budget and goal checks bound abuse (one-time keys, caps) but cannot be fully tamper-proof. Fully trusted verification would require moving transaction writes behind server functions.
