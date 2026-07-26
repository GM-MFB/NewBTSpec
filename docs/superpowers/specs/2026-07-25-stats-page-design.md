# Stats Page (Investments) — Design

## Context

`/stats` has been a placeholder since Phase 1. This spec builds it out to cover
**Investments only** (Stock + Option positions), combining realized
performance (closed positions) with the current open-position figures
already computed for the Investments home screen.

## Data layer

Closed investments are never fetched today — `useInvestments` filters to
`status = 'open'` only. A new hook, `src/hooks/useInvestmentsHistory.js`,
fetches **all** investments (open + closed) for the active account,
independent of `useInvestments` (which stays open-only for the home screen).

```js
useInvestmentsHistory(accountId) -> { investments, loading, error, reload }
```

Read-only — no add/update/delete needed here.

## Stats computation

`src/lib/investmentStats.js` exports `computeInvestmentStats(investments)`,
taking the full open+closed list and returning:

- `totalRealizedPnl`, `winRate`, `totalClosed`, `totalOpen`, `avgWin`,
  `avgLoss`, `bestTrade`, `worstTrade` (overview)
- `stock: { count, totalPnl, winRate }` — closed stock positions only
- `options: { count, totalPnl, winRate, totalPremiumCollected }` — closed
  option positions only
- `byStrategy`: array of `{ strategy, label, count, totalPnl, winRate }` for
  each of the 6 strategies with at least one closed position
- `bySymbol`: array of `{ symbol, count, totalPnl }`, sorted by `totalPnl`
  descending
- `equityCurve`: array of `{ date, cumulative }`, one point per closed
  position with a `sellDate`, sorted chronologically, `cumulative` running
  total of `totalRealizedPnl`

### Realized P&L formula

Per closed investment:
- **Stock**: `(sellPrice - avgCost) × shares`
- **Option, long** (`call`, `put` strategies): `(sellPrice - avgCost) × shares × 100`
- **Option, short** (`cash_secured_put`, `covered_call`, both credit spreads):
  `(avgCost - sellPrice) × shares × 100` — premium collected minus cost to
  close. A blank `sellPrice` (e.g. expired worthless, never explicitly
  closed at a price) is treated as `0`, so the full premium counts as
  realized profit.

Positions with `status !== 'closed'` contribute `null` (excluded from
realized figures, but `totalOpen` still counts them).

## Page layout

`src/pages/StatsPage.jsx`, reachable at `/stats` (route already exists,
currently rendering `PlaceholderPage` — this replaces that wiring).

- Header (existing `Header` component, no Add/Refresh buttons — just nav +
  settings link, matching `TradesPage`'s usage).
- A toggle: **Numbers ⇄ Charts**, defaulting to Numbers.
- **Numbers view**: stat-tile sections (Overview, Stocks, Options), plus two
  tables (By Strategy, By Symbol) — same dark/mono visual language as the
  rest of the app.
- **Charts view**: four charts (equity curve line, P&L-by-strategy bar,
  win/loss pie, P&L-by-symbol bar) replacing the tiles/tables entirely while
  the toggle is set to Charts.

Building the charts must follow the `dataviz` skill's guidance (palette,
mark specs, accessibility) rather than ad hoc styling.

## PDF export

Out of scope for this spec (the user asked for it in the same message but
it's a large, separable feature — a PDF summarizing the whole account with
open/closed trades). Tracked as a follow-up; not built here.

## Out of scope

- PDF export (see above — separate follow-up).
- Trades (day-trading journal) statistics — Investments only per user
  confirmation.
- Any stat requiring data the schema doesn't have (e.g. commissions/fees on
  investments — the schema has no such column).

## Testing

Unit tests for `computeInvestmentStats` covering the realized P&L formula
for stock/long-option/short-option, win rate, best/worst trade, by-strategy
and by-symbol grouping, and the equity curve. Component tests for
`StatsPage`'s numbers/charts toggle with a mocked `useInvestmentsHistory`.
Manual smoke test against the live Supabase project once real closed
positions exist to close-test against (the account has none yet, per this
session's earlier confirmation — manual verification may need to wait until
some positions are closed).
