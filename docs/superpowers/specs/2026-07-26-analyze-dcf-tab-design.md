# Analyze Tab — Phase 4: DCF — Design

## Context

Continuing the phased Analyze build. Fundamentals (now folded into Research's
Single view), Financials (core + charts), and Research (Single/Compare/Sector
Browser) are done. This spec covers **DCF**: an interactive Discounted Cash
Flow valuation tool with a sensitivity table, per `analysis-tab-spec.md`
section 6.

## Prerequisite fix — `bt_fundamentals_cache` gap

`analysis-tab-spec.md` documents that DCF reads `sharesOutstanding` from
`localStorage['bt_fundamentals_cache'][symbol].profile.shareOutstanding *
1e6`. The original `FundamentalsTab` wrote to that cache on every fetch;
when it was replaced by `ResearchTab` (Phase 3), that write was dropped —
`ResearchTab.fetchSymbol` only sets in-memory `data`/`peers` state. This
phase restores it: `fetchSymbol` in `ResearchTab.jsx` writes `{ profile,
metrics, quote }` to `localStorage['bt_fundamentals_cache'][symbol]` after
every successful fetch, exactly matching the old Fundamentals behavior.

## Data layer — `src/lib/dcf.js`

Pure, fully unit-testable — no fetching inside this module.

```js
deriveDcfInputs({ financialsData, fundamentalsCacheEntry, investment }) -> {
  baseFCF: number | null,
  netCash: number | null,
  impliedGrowthPct: number | null,   // clamped to [-30, 60] by the caller when seeding the slider
  sharesOutstanding: number | null,
  currentPrice: number | null,
}
```

- `financialsData` is the `{ annual, quarterly }` shape already produced by
  `fetchFinancials` (Financials tab) — DCF reuses the exact same cache
  chain (localStorage → Supabase shared cache → live AV fetch) rather than
  building a second one.
- **TTM vs. 3yr-average selection**: sum `freeCF` over the last 4 quarterly
  periods **only if all 4 are non-null**; use that TTM sum **only if** the
  most recent quarterly period's date is strictly newer than the most
  recent annual period's date (string comparison on ISO dates). Otherwise
  `baseFCF` = mean of the 3 most recent annual `freeCF` values (nulls
  filtered; `null` overall if none available).
- `netCash` = `(cashAndShortTerm ?? cash ?? 0) − (longTermDebt ?? 0)` from
  whichever period (TTM-quarter or latest-annual) was used as the FCF basis.
- `impliedGrowthPct` = CAGR of `freeCF` across **all** available annual
  periods with `freeCF > 0`: `((newest/oldest)^(1/(n-1)) − 1) × 100`; `null`
  if fewer than 2 qualifying periods.
- `sharesOutstanding` = `fundamentalsCacheEntry?.profile?.shareOutstanding *
  1e6` if present, else `null` (manual override required in the UI).
- `currentPrice` = `investment?.currentPrice ?? investment?.avgCost ?? null`
  (matching the original spec's fallback chain), else `null`.

```js
runDcf({ baseFCF, growthRatePct, terminalRatePct, discountRatePct, netCash, sharesOutstanding }) -> {
  years: Array<{ year: 1..5, fcf: number, discounted: number }>,
  terminalValue: number,
  pvTerminal: number,
  totalEquityValue: number,
  intrinsicValue: number | null,      // null if sharesOutstanding is null/0
  marginOfSafetyPct: number | null,   // null if currentPrice/intrinsicValue unavailable — computed by the caller (DCFTab), not this function
}
```

Formula (the documented gotcha — **mid-year discounting for years 1–5, but
the terminal value discounted at a full year 5, not 4.5**):
```
r = discountRatePct/100, g = growthRatePct/100, gt = terminalRatePct/100
for t in 1..5:
  fcf_t = baseFCF * (1+g)^t
  discounted_t = fcf_t / (1+r)^(t-0.5)
fcfYear5 = baseFCF * (1+g)^5
terminalValue = fcfYear5 * (1+gt) / (r - gt)
pvTerminal = terminalValue / (1+r)^5
totalEquityValue = sum(discounted_t) + pvTerminal + netCash
intrinsicValue = sharesOutstanding ? totalEquityValue / sharesOutstanding : null
```

```js
marginOfSafety(intrinsicValue, currentPrice) -> number | null
// (intrinsicValue - currentPrice) / currentPrice * 100, null if either input is null/0
```

```js
buildSensitivityGrid({ baseFCF, netCash, sharesOutstanding, terminalRatePct }) -> Array<{
  discountRatePct: number, growthRatePct: number, marginOfSafetyPct: number | null, bucket: 'strong'|'good'|'caution'|'weak'|null
}>
```
6 discount rates `[7,8,9,10,11,12]` × 5 growth rates `[g-10, g-5, g, g+5,
g+10]` (clamped to `[-50,100]`, where `g` is the currently-selected growth
rate, not the implied one) — 30 cells, each re-running `runDcf` +
`marginOfSafety`. Bucket thresholds: `strong` > 20%, `good` 0–20%, `caution`
0..-20%, `weak` < -20%, `null` if margin unavailable for that cell.

## Component — `src/components/analysis/DCFTab.jsx`

- Same Key Required (Alpha Vantage key) / symbol-chip / free-text-add /
  active-chip-highlight pattern as Financials, including the auto-select-
  first-stock-on-mount behavior.
- Fetches financials via the same 3-tier cache chain already built for
  Financials (`fetchFinancials`, `getSharedCache`/`saveSharedCache`,
  `localStorage['bt_financials_cache']`) — no new fetch code, this tab
  just calls the existing functions.
- On loading a symbol's financials, calls `deriveDcfInputs` to seed the
  seven adjustable inputs (Base FCF, Net Cash/Debt, Shares Outstanding,
  FCF Growth Rate, Terminal Growth Rate, Discount Rate, Current Price) —
  each has a manual override input the user can type into directly (Base
  FCF/Net Cash accept shorthand like `10B`/`1.5M`/`500K`, parsed by a
  small `parseShorthandNumber` helper in `dcf.js`), reverting to the
  derived value is not required (once overridden, stays overridden until
  a new symbol is researched).
- Sliders: FCF Growth Rate (−30..60%, default = implied CAGR clamped to
  that range), Terminal Growth Rate (0..6%, default 3%), Discount Rate
  (5..20%, default 10%).
- **Results**: intrinsic value, margin of safety (colored green/red by
  sign), year-by-year FCF/PV table, a value-breakdown horizontal stacked
  bar (PV of FCFs / Terminal Value / Net Cash, with a warning note if
  terminal value exceeds 75% of total equity value), an FCF
  historical+projected line chart (past annual `freeCF` periods plus the
  5 projected years, single series — dataviz skill invoked before writing
  this), the sensitivity grid (6×5, colored by bucket, current
  discount/growth combo highlighted), and a plain-text math breakdown
  section showing the exact numbers plugged into each formula step.

## Page wiring

`AnalyzePage.jsx`: import `DCFTab`, render it for `tab === 'dcf'` (replaces
the placeholder). Update `AnalyzePage.test.jsx`'s "Coming soon" test to
target `frontier` instead (next still-unbuilt tab).

## Out of scope (this phase)

- MSFT mock-data fallback when no AV key is present — the original app had
  a bundled demo dataset; this rebuild has no such stub, so DCF simply
  shows the Key Required state without a key, consistent with Financials.
- Any cross-tab "send valuation to X" hooks — none of the later tabs
  (Frontier/Optimizer/Risk/Wheel/Screener) exist yet to receive one.

## Testing

- `dcf.js`: unit tests for `deriveDcfInputs` (TTM vs. 3yr-average
  selection under both branch conditions, `netCash` computation, CAGR
  calculation including the <2-period null case, shares-outstanding
  read from a mock cache entry), `runDcf` (verify the mid-year vs.
  full-year discounting distinction numerically against a hand-computed
  example), `marginOfSafety`, `buildSensitivityGrid` (30 cells, correct
  bucket assignment at each threshold boundary), `parseShorthandNumber`
  (`"10B"` → `10e9`, `"1.5M"` → `1.5e6`, `"500K"` → `500e3`, plain
  numbers pass through, invalid input → `null`).
- `DCFTab.jsx`: component tests with mocked `fetchFinancials`/shared-cache
  — Key Required state, symbol picker + auto-select-first-stock, inputs
  seed from derived values, overriding an input updates the results,
  sensitivity grid renders 30 cells, chart renders without crashing on a
  symbol with only 1 annual period (no CAGR available).
- `ResearchTab.jsx`: new test asserting `fetchSymbol` writes to
  `localStorage['bt_fundamentals_cache']` (closing the prerequisite gap).
- Manual smoke test: research a real symbol's financials in DCF with a
  real AV key, sanity-check the intrinsic value and sensitivity grid
  against a manual calculation.
