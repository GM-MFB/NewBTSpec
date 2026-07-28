# Day Trading Tab Revamp — Design

## Purpose

Rework the Day Trading tab into the app's primary day-trading journal: log
Stock, Call, Put, and Futures trades in one step (they're always already
closed by the time you log them), see all trades on one page with a
monthly P&L calendar as the main focal point, and view dedicated stats on
a sub-tab.

## Data Model & P&L

No changes to existing `trades` columns; one new nullable column is added:

```sql
alter table trades add column point_value numeric;
```

- `trades.type` gains a third value: `'stock'` (alongside existing
  `'option'` and `'futures'`).
- Every trade is now created with `status: 'closed'` — Add Trade collects
  entry **and** exit price/date together, replacing the old
  add-open-then-close-later flow. The `status` column stays in the schema
  for backward compatibility with any pre-existing `'open'` rows, but new
  trades never use it.
- `point_value` (dollars per 1.00-point move) is only set for futures
  trades. It is nullable so stock/option rows are unaffected.

P&L is computed client-side, never stored, via `src/lib/tradeStats.js`:

```js
function pnlFor(trade) {
  if (trade.exitPrice == null || trade.entryPrice == null) return null // legacy open trade
  const sign = trade.direction === 'short' ? -1 : 1
  const rawMove = (trade.exitPrice - trade.entryPrice) * sign
  const gross =
    trade.type === 'option' ? rawMove * trade.quantity * 100
    : trade.type === 'futures' ? rawMove * trade.quantity * (trade.pointValue ?? 0)
    : rawMove * trade.quantity // stock
  return gross - (trade.fees ?? 0)
}
```

### Futures point-value lookup

`src/lib/futuresContracts.js` exports a small table of common contracts and
their standard point values (dollars per 1.00-point move):

| Symbol | Point Value |
|---|---|
| ES | 50 |
| MES | 5 |
| NQ | 20 |
| MNQ | 2 |
| YM | 5 |
| MYM | 0.50 |
| RTY | 50 |
| M2K | 5 |
| CL | 1000 |
| MCL | 100 |
| GC | 100 |
| MGC | 10 |
| SI | 5000 |
| NG | 10000 |
| ZB | 1000 |
| ZN | 1000 |

`lookupPointValue(symbol)` returns the value for a known symbol (case-
insensitive) or `undefined` otherwise. In the Add/Edit Trade form, typing a
recognized futures symbol auto-fills the "$ per Point" field; it remains a
plain editable number input either way, so any symbol (recognized or not)
can be traded with a manually entered value.

### Legacy open trades

Any trade still in the DB with `status: 'open'` (no `exitPrice`) continues
to appear in the trade list with an "Open" badge instead of a P&L figure.
It's excluded from the calendar (no exit date to place it on) and from
stats totals, but remains fully editable — editing it to add exit
price/date turns it into a normal closed trade going forward (the edit
form doesn't force `status`, so saving with exit fields filled in is
sufficient; no explicit status flip is needed since nothing reads `status`
anymore except to decide "legacy open" display).

## Add/Edit Trade Form

`AddTradeModal` is extended (not replaced) with:

- **Type toggle**: Stock | Option | Futures (previously only Option |
  Futures — Stock is new).
- **Always shown**: `symbol` (uppercased), `direction` (Long/Short),
  `quantity`, `entryPrice`, `entryDate`, `exitPrice`, `exitDate`, `fees`
  (optional), `notes` (optional), `chartLink` (optional).
- **Option only**: `optionType` (Call/Put), `strike`, `expiry`.
- **Futures only**: `pointValue` ("$ per Point"), auto-filled via
  `lookupPointValue(symbol)` when the symbol is recognized, always
  editable.

The modal gains an `initialValues` prop, following the exact pattern just
added to `AddInvestmentModal`: passing `initialValues` pre-fills every
field, shows the form immediately (skipping the type-picker gate), locks
the type toggle (can't switch Stock/Option/Futures mid-edit), and swaps the
dialog's `aria-label` to "Edit Trade". This makes the same component serve
both Add and Edit, and `TradeDetailModal.jsx` is deleted — editing now
happens through `AddTradeModal` exactly like investments.

## Trade Row & List

`TradeRow.jsx` is redesigned to match the just-shipped `InvestmentRow`
pattern:

- Clicking the row body (not the action buttons) expands a details panel
  showing the trade's `chartLink` (as an abbreviated external hyperlink)
  and `notes`, with "No chart link added." / "No notes added." placeholders
  when blank — collapses on a second click.
- Action buttons, left to right: **Chart** (a `Link` to
  `/charts?symbol=<symbol>`, reusing the Charts tab), **Edit** (opens
  `AddTradeModal` with `initialValues`), **Delete** (calls `onDelete`,
  no confirmation — matches existing investment-row delete behavior).
  There is no "Close" button anymore.
- The row shows type as a badge: `Stock`, `Call`, `Put`, or `Futures`
  (previously `option`/`futures` raw values — Call/Put now derived from
  `optionType` the same way the old badge logic did).
- P&L is shown next to price/quantity meta, colored green (≥0) / red (<0)
  via the same `.price-favorable`/`.price-unfavorable` classes
  `InvestmentRow` already uses. Legacy open trades show an "Open" badge
  in place of the P&L figure.

The trades list itself (`TradesPage.jsx`'s Calendar tab) shows every trade
for the active account, newest first — both closed (the norm going
forward) and any legacy open ones.

## Calendar (Calendar tab, default, main focal point)

New `src/components/TradeCalendar.jsx` + `src/lib/tradeCalendar.js`:

- `buildMonthGrid(trades, year, month)` buckets trades by `exitDate` into
  a map of `date → totalPnl`, then returns a 6-row×7-column grid of day
  cells (including leading/trailing days from adjacent months, grayed out)
  — pure date math, no new library needed (`date-fns` etc. stay unused,
  consistent with the rest of the app).
- Each in-month day cell shows the day-of-month number and, if any trades
  closed that day, the summed P&L for the day in green/red. Days with no
  trades show no P&L line.
- Header controls: `‹` / `›` to move between months, a "Today" button to
  jump back to the current month, and the visible "Month Year" label.
  Opens to the current month on first load.
- Clicking a day cell does nothing (pure visual summary, per your
  decision) — no popover, no filtering.
- Legacy open trades (no `exitDate`) are excluded from the calendar
  entirely, since there's no date to place them on.

Below the calendar on the same tab: the full trade list described above.

## Stats Tab

New `src/lib/tradeStatsSummary.js`, structurally parallel to the existing
`investmentStats.js` (`computeInvestmentStats`):

```js
computeTradeStats(trades) → {
  totalRealizedPnl, winRate, totalClosed, avgWin, avgLoss,
  bestTrade, worstTrade,           // trade objects, or null
  byType: [{ type: 'Stock'|'Call'|'Put'|'Futures', count, totalPnl, winRate, avgWin, avgLoss }, ...],
  bySymbol: [{ symbol, count, totalPnl }, ...],
  equityCurve: [{ date, cumulative }, ...],
}
```

Legacy open trades (no P&L) are excluded from all these computations. The
Stats tab renders stat tiles (Total Realized P&L, Win Rate, Total Trades,
Avg Win, Avg Loss, Best Trade, Worst Trade) plus `recharts` charts (P&L by
type, P&L by symbol, equity curve, win/loss) — reusing the exact visual
pattern and CSS classes already established by `StatsPage.jsx` /
`StatsCharts.jsx`, and a from/to date-range filter matching the existing
Stats page's `isWithinDateRange` filter, filtered on `exitDate`.

## Navigation & Routing

`TradesPage.jsx` gains a two-tab bar at the top — `Calendar` (default) and
`Stats` — following the exact `TABS` array + button-toggle pattern already
used in `AnalyzePage.jsx`. Both tabs stay under the existing `/daytrading`
route (no new route) and share one `Header` instance, one active-account
context, and one `useTrades(activeAccountId)` call.

`useTrades.js` drops its `.eq('status', 'open')` filter — it now loads all
trades for the account regardless of status, since new trades are always
closed and legacy open ones still need to display (with their "Open"
badge). `addTrade` is updated to always insert `status: 'closed'` and to
accept the exit fields up front. `closeTrade` is removed (no longer
reachable from the UI — nothing calls it once `TradeDetailModal` is
deleted); `updateTrade` and `deleteTrade` are unchanged.

## Testing

- `src/lib/tradeStats.test.js` — `pnlFor` for stock/option/futures, long
  and short, with and without fees, returns `null` for a trade missing
  `exitPrice`.
- `src/lib/futuresContracts.test.js` — `lookupPointValue` for known and
  unknown symbols, case-insensitivity.
- `src/lib/tradeCalendar.test.js` — `buildMonthGrid` bucketing, leading/
  trailing days, multiple trades summing on the same day, days with zero
  trades.
- `src/lib/tradeStatsSummary.test.js` — `computeTradeStats` shape and
  values, exclusion of legacy open trades.
- `src/components/AddTradeModal.test.jsx` — Stock type added; exit fields
  required; futures point-value auto-fill and override; edit mode via
  `initialValues` (pre-fill, locked type toggle, "Edit Trade" label).
- `src/components/TradeRow.test.jsx` — badge labels (Stock/Call/Put/
  Futures), P&L color, "Open" badge for legacy trades, click-to-expand
  details panel, Chart/Edit/Delete actions, no Close button.
- `src/components/TradeCalendar.test.jsx` — month grid rendering, day P&L
  totals, month navigation, Today button, days without trades show no
  P&L.
- `src/pages/TradesPage.test.jsx` — tab switching (Calendar default,
  Stats), calendar + trade list both render on Calendar tab, stats render
  on Stats tab, date-range filter on Stats tab.
- `src/hooks/useTrades.test.js` — updated for the dropped status filter
  and the new `addTrade` shape (closed status, exit fields); `closeTrade`
  removed.

## Out of Scope (YAGNI)

- No calendar day-click interactions (filtering, popovers) — pure visual
  summary only, per your decision.
- No configurable/custom futures contracts list beyond manual override of
  the point-value field — the built-in table covers common contracts only.
- No re-opening a closed trade or reverting `status` — the concept of an
  "open" day trade only exists for legacy pre-revamp rows.
- No changes to the `investments` table, `InvestmentsPage`, or `StatsPage`
  — this spec is scoped entirely to Day Trading (`trades` table).
