# Phase 1 Design — Auth + Accounts + Trades Journal

## Context

This is a new React app that tracks stock market trades, backed by an existing
Supabase project (see `database-reference.md` at repo root — the authoritative
source for schema, client setup, and conventions; do not deviate from it).

The full target feature set (per user request) includes: trades journal,
investments, account settings, and a shared "MATT Capital" fund module. This is
too large for a single spec, so the work is split into phases, each with its
own design → plan → implementation cycle:

- **Phase 1 (this spec)**: Auth + Accounts + Trades journal — a working home
  screen for logging and closing trades.
- **Phase 2** (future): Stats page (closed trades, P&L, win rate).
- **Phase 3** (future): Analyze page.
- **Phase 4** (future): Investments module.
- **Phase 5** (future): MATT Capital fund module (realtime, multi-user).
- **Phase 6** (future): User settings (API keys, display name).

Phase 1 includes nav buttons for Stats/Analyze/Matt Cap as placeholder routes
so the app's navigation feels complete, but their content is out of scope
here.

## Stack

- **Build tool**: Vite + React (JS, not TS — matches the reference doc's
  `import.meta.env` convention).
- **Backend**: Supabase (`@supabase/supabase-js` v2), same project as the
  existing site — reuses `accounts`, `trades`, and `auth.users` tables as-is.
  No schema changes.
- **Routing**: React Router.
- **Styling**: Plain CSS (no component framework) to keep full control over
  the minimal, data-dense look.

## Visual direction

Dark theme: near-black background, high-contrast text, monospace font for
tickers/prices/numbers (terminal/Bloomberg-ish feel). Minimal chrome — no
heavy borders, gradients, or decoration. Generous whitespace between sections
despite the data-dense row content; precision over decoration.

## Screens

### 1. Login / Signup
Single screen. Supabase email/password auth (`supabase.auth.signInWithPassword`
/ `signUp`). Toggle between sign-in and sign-up modes. Minimal form: email,
password.

### 2. Home (Trades)
The core screen, structure:
- **Header**: current account's `name` as the page title. Clicking it opens a
  dropdown to switch accounts or create a new one.
- **Nav row**: three buttons — **Stats**, **Analyze**, **Matt Cap** — route to
  placeholder pages in Phase 1.
- **+ Add Trade** button — opens the Add Trade form.
- **Open trades list**: only trades with `status = 'open'` for the active
  account, newest first (`created_at desc`). One row per trade, minimal
  layout: symbol, type badge (option/futures), direction (long/short), entry
  price, quantity, days-open (derived from `entry_date`). Clicking a row opens
  the Trade Detail/Close view.
- **Empty state**: "No open trades — add one to get started" when the list is
  empty.

### 3. Add Trade form (modal)
- Step 1: toggle **Option** or **Futures**.
- Step 2: form fields adapt to the choice:
  - Common: symbol, direction (long/short), quantity, entry price, entry
    date, fees, notes, chart link.
  - Option-only: option_type (call/put), strike, expiry.
- On submit: inserts into `trades` with `status: 'open'`, `account_id`,
  `user_id` from the active account/session.

### 4. Trade Detail / Close modal
- Shows all fields for the selected trade, editable.
- **Close Trade** action: prompts for exit price + exit date, updates the row
  with `status: 'closed'`. Closed trades drop out of the Home list
  immediately (they'll be viewable in the Phase 2 Stats page).
- Standard edit (non-close) also supported — update any field, save.
- Delete action available from this view.

### 5. Placeholder pages (Stats, Analyze, Matt Cap)
Same header/nav chrome as Home, body shows "Coming soon."

## Data layer

- `utils/supabase.js` — client setup, verbatim per `database-reference.md`.
- `hooks/useAuth.js` — verbatim auth pattern per reference (session +
  `onAuthStateChange` listener, cleanup on unmount).
- `hooks/useAccounts.js`:
  - Fetch accounts for the signed-in user.
  - Auto-create one row named `"Main Account"` if the user has zero accounts.
  - Track active account id in `localStorage['bt_active_account']`; default to
    the first account if nothing stored or the stored id no longer exists.
  - Expose a `switchAccount(id)` and `createAccount(name)`.
- `hooks/useTrades.js`:
  - CRUD scoped to `account_id` (insert/update/delete/select).
  - `fromRow` / `toRow` mapper functions per the reference's snake_case ↔
    camelCase convention; blank strings convert to `null` on write, back to
    `''` on read.
  - Filters open trades for Home; the close action is just an `update` setting
    `status`, `exit_price`, `exit_date`.

## Error handling

- Auth errors: inline message on the login form (e.g. "Invalid email or
  password").
- Form errors (add/edit/close trade): inline message near the submit button,
  form stays open with entered values preserved.
- Network/query errors on Home load: banner with a retry action.

## Out of scope for Phase 1

- Stats, Analyze, and Matt Cap page content (placeholders only).
- Investments module.
- User settings (API keys, display name).
- Any P&L calculation/display (deferred to Phase 2, since closed trades don't
  appear on Home).

## Testing

No local test database — this app shares the live Supabase project used by
the existing site. Verification is manual, against that live project:
1. Sign up / sign in.
2. First-login auto-creates "Main Account"; confirm it appears as the title.
3. Create a second account, switch between them, confirm trade lists filter
   correctly per account.
4. Add an option trade — confirm option-only fields appear and save
   correctly.
5. Add a futures trade — confirm option-only fields are absent.
6. Click a row, edit a field, save — confirm it persists.
7. Close a trade — confirm it disappears from the open trades list.
8. Delete a trade — confirm removal.
9. Confirm Stats/Analyze/Matt Cap nav buttons route to placeholder pages.
