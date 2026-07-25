# Investments Home + Trades Relocation — Design

## Context

Phase 1 built a day-trading journal (`trades`) as the app's home screen. After
using it, the user clarified their priority: the home screen should show
**Investments** (their existing long-term portfolio data, already present in
Supabase's `investments` table), with the Trades journal moved behind its own
nav entry for later use. This spec covers that pivot.

Prerequisite: a one-time additive schema migration
(`docs/superpowers/specs/2026-07-25-investments-strategy-migration.sql`) adds
two nullable columns to `investments` — `strategy` (text) and `strike_2`
(numeric) — to support option strategies with two legs (credit spreads). The
user runs this themselves in the Supabase SQL Editor before this feature can
be used; no existing columns change, so the old site is unaffected. Existing
rows get `strategy = NULL, strike_2 = NULL` — no automatic backfill.

## Routing changes

- `/` now renders **InvestmentsPage** (new).
- `/trades` renders the existing, already-working Trades screen (moved as-is
  from its current location at `/`).
- Header nav becomes 4 buttons: **Trades**, Stats, Analyze, Matt Cap (Stats/
  Analyze/Matt Cap remain placeholders).

## Investments screen

Same shell pattern as the Trades screen: header (account name/switcher, 4-
button nav), **+ Add Investment** button, list of **open investments only**
(`status = 'open'`), newest first. Closed investments are deferred to the
future Stats phase, same convention as trades.

### Investment row

Minimal row: symbol, asset-type/strategy badge, and either shares + avg_cost
(Stock) or strike/expiry (Option). Click row → detail/close modal. No P&L
calculation (same deferral as trades).

### Add Investment form

Step 1: **Asset type** — Stock or Option (the schema's `asset_type` column
allows other values, but this app's form only offers these two; stored as
`'Stock'` / `'Option'` to match existing casing convention in
`database-reference.md`).

Common fields (both types): symbol, name, sector, buy_date, notes,
chart_link.

**Stock-only fields**: shares, avg_cost, stop_loss, target_price.

**Option-only fields**: a **strategy** dropdown with 6 choices — Call, Put,
Cash Secured Put, Covered Call, Put Credit Spread, Call Credit Spread — plus
strike and expiry. Selecting a strategy determines the stored
`option_type`/`option_direction` per this table:

| Strategy | option_type | option_direction | strike_2 |
|---|---|---|---|
| Call | call | long | not used |
| Put | put | long | not used |
| Cash Secured Put | put | short | not used |
| Covered Call | call | short | not used |
| Put Credit Spread | put | short | long leg's strike |
| Call Credit Spread | call | short | long leg's strike |

For the two spread strategies, a second field ("Long leg strike") appears
and saves to `strike_2`. All other strategies leave `strike_2` null.

On submit: inserts into `investments` with `status: 'open'`, `account_id`,
`user_id` from the active account/session.

### Investment Detail/Close modal

Mirrors the Trades detail modal: shows all fields (editable), a **Close**
action (enter `sell_price` + `sell_date` → `status: 'closed'`, drops out of
the Home list), and a **Delete** action. Inline error handling matches the
Trades modals (error shown in place, form stays open with values preserved
on failure).

## Data layer

- `src/lib/investmentMappers.js` — `fromRow`/`toRow`, snake_case ↔ camelCase,
  blank ↔ null, same convention as `tradeMappers.js`. Additionally maps the
  UI's `strategy` field to/from `optionType`/`optionDirection` for the 4
  non-spread strategies (so `strategy` is the single source of truth in the
  UI layer; the DB still stores the underlying `option_type`/
  `option_direction` columns per `database-reference.md`).
- `src/hooks/useInvestments.js` — same shape as `useTrades.js`: `{ investments,
  loading, error, reload, addInvestment, updateInvestment, closeInvestment,
  deleteInvestment }`, scoped by `account_id`, filtered to `status: 'open'`.

## Trades relocation

No functional changes to the Trades feature itself — `HomePage.jsx` (trades)
is renamed/moved to `TradesPage.jsx` at route `/trades`. `Header.jsx` gains a
4th nav button. A new `InvestmentsPage.jsx` becomes the `/` route.

## Out of scope

- Backfilling `strategy`/`strike_2` on existing investment rows.
- P&L calculation for investments.
- Stats/Analyze/Matt Cap page content (still placeholders).
- Enforcing the 6-strategy set or Stock/Option asset types at the database
  level (validation lives in the app form only, per the "don't change
  existing constraints" boundary from `database-reference.md`).

## Testing

Same approach as Phase 1: unit tests for mappers/hooks with a mocked
Supabase client, component tests for the new Investments UI, and a manual
smoke test against the live Supabase project (after the user runs the SQL
migration) covering: add a Stock investment, add each of the 6 Option
strategies (verifying strike_2 only appears/saves for the two spreads), edit,
close, delete, and confirm Trades still works unchanged at `/trades`.
