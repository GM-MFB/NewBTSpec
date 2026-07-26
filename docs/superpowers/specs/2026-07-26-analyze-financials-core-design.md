# Analyze Tab — Phase 2a: Financials (Core) — Design

## Context

Continuing the phased build of `analysis-tab-spec.md`'s Analysis feature.
Phase 1 (shell + Fundamentals) is done. This spec covers the **core** slice
of Financials: live Alpha Vantage data + shared cache + the three statement
tables. Explicitly deferred to later phases: the manual paste importer (for
when the 25/day AV quota is hit) and the 14-chart `ChartsTab`.

## Data layer — `src/lib/fetchFinancials.js`

```js
fetchFinancials(symbol, apiKey) -> Promise<{ annual: Period[], quarterly: Period[] }>
```

Calls three Alpha Vantage endpoints **sequentially with a 1.1s delay
between each** (rate-limit friendly — AV free tier is 25 calls/day, and
each fetch spends 3 of them):

```
GET ?function=INCOME_STATEMENT&symbol=SYM&apikey=KEY
(wait 1.1s)
GET ?function=BALANCE_SHEET&symbol=SYM&apikey=KEY
(wait 1.1s)
GET ?function=CASH_FLOW&symbol=SYM&apikey=KEY
```

Each response can carry `data['Error Message']`, `data['Note']`, or
`data['Information']` (AV's rate-limit signal) instead of real data — any
of these throws an `Error` with that message.

**Field mapping** (AV's real response field names, confirmed against their
documented schema — the original spec's field list didn't spell out every
raw AV key, so these are the actual AV names for each normalized field):

| Normalized field | AV statement | AV field name |
|---|---|---|
| `revenue` | Income | `totalRevenue` |
| `cogs` | Income | `costOfRevenue` |
| `grossProfit` | Income | `grossProfit` |
| `rd` | Income | `researchAndDevelopment` |
| `sga` | Income | `sellingGeneralAndAdministrative` |
| `ebitda` | Income | `ebitda` |
| `operatingIncome` | Income | `operatingIncome` |
| `netIncome` | Income | `netIncome` |
| `cash` | Balance | `cashAndCashEquivalentsAtCarryingValue` |
| `cashAndShortTerm` | Balance | `cashAndShortTermInvestments` |
| `currentAssets` | Balance | `totalCurrentAssets` |
| `totalAssets` | Balance | `totalAssets` |
| `currentLiabilities` | Balance | `totalCurrentLiabilities` |
| `longTermDebt` | Balance | `longTermDebt` |
| `totalLiabilities` | Balance | `totalLiabilities` |
| `equity` | Balance | `totalShareholderEquity` |
| `retainedEarnings` | Balance | `retainedEarnings` |
| `operatingCF` | Cash Flow | `operatingCashflow` |
| `capex` | Cash Flow | `capitalExpenditures` (negated — stored as a negative number) |
| `depreciation` | Cash Flow | `depreciationDepletionAndAmortization` |
| `dividendsPaid` | Cash Flow | `dividendPayout` |
| `investingCF` | Cash Flow | `cashflowFromInvestment` |
| `financingCF` | Cash Flow | `cashflowFromFinancing` |

Any AV field that is missing, `"None"`, or non-numeric maps to `null` for
that period (never `0` or `NaN`) — the UI treats `null` as "no data for
this period" (blank cell, not a badge).

**Merge logic:** the three statements are merged **by `fiscalDateEnding`**
into one `Period` object per date:
```
Period = { date: string, revenue, cogs, grossProfit, rd, sga, ebitda,
  operatingIncome, netIncome, cash, cashAndShortTerm, currentAssets,
  totalAssets, currentLiabilities, longTermDebt, totalLiabilities, equity,
  retainedEarnings, operatingCF, capex, freeCF, depreciation,
  dividendsPaid, investingCF, financingCF }
```
`freeCF = operatingCF - Math.abs(capex)`, computed **only if both
`operatingCF` and `capex` are non-null**; otherwise `null`. Separately for
`annualReports` and `quarterlyReports`, sorted ascending by date then
**sliced to the most recent 8**.

## Caching chain — checked in this order, cheapest first

1. In-memory component state (`{ [symbol]: { annual, quarterly } }`).
2. `localStorage['bt_financials_cache']` (same shape, keyed by symbol) —
   checked on first research of a symbol this session.
3. Supabase shared cache (`src/lib/financialsSharedCache.js`, table
   `financials_cache`: columns `ticker`, `data` jsonb, `fetched_at`,
   `user_id`) — a cross-user cache, since once anyone fetches a ticker's
   financials, everyone should benefit without spending their own AV quota.
   ```js
   getSharedCache(ticker) -> Promise<{annual, quarterly} | null>
   saveSharedCache(ticker, data, userId) -> Promise<void>   // upsert on ticker
   ```
4. If still missing and `avKey` is present: live `fetchFinancials`.
5. Whatever came back from step 4 gets written to in-memory state,
   `localStorage`, and `saveSharedCache` (so the next user/session skips
   straight to step 2 or 3).
6. If no `avKey`: a "Key Required" empty state (same pattern as
   Fundamentals, pointing to Settings) — no manual-paste fallback this
   phase.

## Component — `src/components/analysis/FinancialsTab.jsx`

- Same symbol-chip picker as `FundamentalsTab` (open Stock investments +
  free-text add), reusing the same in-memory research pattern.
- Frequency toggle: **Annual / Quarterly** (defaults to Annual), switches
  which period array the tables read from.
- Three statement sections — **Income Statement**, **Balance Sheet**,
  **Cash Flow** — each a wide table: first column = metric label (sticky
  via CSS, matching the rest of the app's table conventions), remaining
  columns = periods **most recent first**. Row list per section:
  - Income Statement: Revenue, COGS, Gross Profit, R&D, SG&A, Operating
    Income, EBITDA, Net Income.
  - Balance Sheet: Cash, Cash & Short-Term Investments, Current Assets,
    Total Assets, Current Liabilities, Long-Term Debt, Total Liabilities,
    Equity, Retained Earnings.
  - Cash Flow: Operating CF, CapEx, Free Cash Flow, Depreciation,
    Dividends Paid, Investing CF, Financing CF.
  - All dollar figures via `formatLarge` (already built for Fundamentals —
    T/B/M suffixed).
- **Period-over-period % change badge** next to each value (except the
  oldest/rightmost period, which has nothing to compare against): ▲ green
  if the metric increased vs. the prior period, ▼ red if it decreased, no
  badge if either value is `null` or the prior value is `0` (divide-by-zero
  guard). `pctChange(current, previous) = (current - previous) / Math.abs(previous) * 100`.

## Out of scope (this phase)

- Manual paste importer (`PasteModal`, `parseFinancialsPaste`, `LABEL_MAP`) —
  next Financials sub-phase.
- `ChartsTab` (14 derived charts) — next Financials sub-phase after that.
- `extraRows` (unrecognized paste rows) — depends on the paste importer.
- Research/DCF tabs reusing this same cache — later phases, though this
  phase's cache shape is deliberately identical to what those phases will
  expect, per the original spec.

## Testing

- `fetchFinancials.js`: unit tests mocking `fetch` and timers — asserts
  all 3 endpoints are called in order with a 1.1s gap (via
  `vi.useFakeTimers`), merge-by-date + 8-period slicing, `freeCF`
  computed only when both inputs present, an AV `Note`/`Error Message`
  field throws.
- `financialsSharedCache.js`: unit tests mocking the Supabase client —
  `getSharedCache` reads by ticker, `saveSharedCache` upserts on `ticker`.
- `FinancialsTab.jsx`: component tests with mocked `fetchFinancials`/
  shared-cache/localStorage — symbol chips render, clicking one renders
  the three statement tables, Annual/Quarterly toggle switches the
  displayed periods, a `null` metric renders a blank cell without
  crashing, % change badges render with correct direction/color, missing
  `avKey` shows the Key Required state.
- Manual smoke test: research a real symbol with a real AV key, confirm
  all three tables populate and the toggle works.
