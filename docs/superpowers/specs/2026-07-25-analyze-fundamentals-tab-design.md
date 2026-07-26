# Analyze Tab — Phase 1: Shell + Fundamentals — Design

## Context

`analysis-tab-spec.md` (repo root) documents the full 9-tab "Analysis" feature
from the original BT Speculation app: Fundamentals, Financials, Research,
DCF, Efficient Frontier, Optimizer, Risk, Wheel, Screener — sharing a
Monte-Carlo portfolio engine and several external data sources (Finnhub,
Alpha Vantage, a Yahoo Finance proxy that doesn't exist in this codebase).
This is too large for one implementation pass, so it's being built in
phases. This spec covers **Phase 1**: the tab-router shell for `/analyze`,
and a working **Fundamentals** tab. The other 8 tabs render as "Coming soon"
placeholders until their own phases.

Confirmed with the user: start with Fundamentals (no external blockers);
defer the real-correlation-data proxy question to whichever phase needs it
(Frontier/Optimizer/Risk).

## Route & shell

`src/App.jsx`'s `/analyze` route swaps `PlaceholderPage` for a new
`AnalyzePage.jsx`. Local tab state (`useState('fundamentals')`, no URL
routing, matching the original). Tab list, in spec order:

```
fundamentals | financials | research | dcf | frontier | optimizer | risk | wheel | screener
```

Only `fundamentals` renders real content this phase; the rest render a
shared `AnalyzeTabPlaceholder` ("Coming soon").

## Data layer — `src/lib/fetchFundamentals.js`

```js
fetchFundamentals(symbol, apiKey) -> Promise<{
  profile: object | null,   // GET /stock/profile2
  quote: object | null,     // GET /quote
  metrics: object | null,   // GET /stock/metric?metric=all -> json.metric
  recs: object | null,      // GET /stock/recommendation -> json[0] (most recent)
  targets: object | null,   // GET /stock/price-target
  news: array,              // GET /company-news?from=(today-30d)&to=today, sliced to 8
  earnings: object | null,  // GET /stock/earnings -> {earnings: [...]}
}>

fetchPeers(symbol, apiKey) -> Promise<string[]>   // GET /stock/peers
```

All 7 fundamentals sub-requests fire via `Promise.allSettled` — any single
failure yields `null`/`[]` for that piece rather than failing the whole
fetch, matching the original. Same `fetch` + query-string-token style as
the existing `src/lib/finnhub.js` (`fetchQuote`), just aggregating more
endpoints.

## ETF short-circuit — `src/lib/knownEtfs.js`

```js
export const KNOWN_ETFS: Set<string>
```

~40 common ETF/index tickers (SPY, QQQ, VOO, VTI, DIA, IWM, sector SPDRs
XLK/XLF/XLE/XLV/XLY/XLP/XLI/XLB/XLU/XLRE/XLC, GLD, SLV, TLT, IEF, SHY, HYG,
LQD, EEM, EFA, VEA, VWO, ARKK, SMH, SOXX, XBI, IBB, VNQ, BND, AGG, SCHD,
VIG, VYM, JEPI, JEPQ, MDY). When the researched symbol is in this set, skip
the Finnhub fetch entirely and render a static info card ("No financials
available for ETFs") with outbound links to etf.com, Yahoo Finance, and
Morningstar for that symbol — no API call made.

## Formatting helpers — additions to `src/lib/format.js`

```js
formatLarge(value) -> string   // $ with T/B/M suffix by magnitude (e.g. "$2.4T", "$850M")
```

(`formatCurrency`/`formatCurrencyAuto` already exist and cover the rest.)

## Component — `src/pages/AnalyzePage.jsx` + `src/components/analysis/FundamentalsTab.jsx`

`AnalyzePage`:
- `Header` (existing component, `showAddButton={false}`, matching Stats page).
- Tab bar (buttons, `aria-pressed`, same visual pattern as the Stats page's
  Numbers/Charts toggle).
- Renders `<FundamentalsTab investments={...} />` when `tab === 'fundamentals'`,
  else `<AnalyzeTabPlaceholder label={...} />`.
- Pulls open Stock investments via the existing `useInvestments` hook (same
  account-scoping pattern as `InvestmentsPage`) to seed the symbol chips.

`FundamentalsTab`:
- Reads `finnhubKey` via `useUserSettings`. No key → a "Key Required" empty
  state with a link to `/settings` (matching the existing
  Finnhub-key-missing banner pattern already used on `InvestmentsPage`).
- Symbol chips: one per unique open Stock investment symbol, plus a
  free-text input ("Add symbol") for ad-hoc research. Clicking a chip or
  submitting the input sets the active symbol and triggers a fetch (skipped
  if already in the in-memory `data` map for that symbol).
- `data` state: `{ [symbol]: FundamentalsResult }`, in-memory only (not
  persisted), per the original spec. On a successful fetch, also writes
  `profile`/`metrics`/`quote` into `localStorage['bt_fundamentals_cache']`
  under the symbol key (merging with whatever's already there) — this is
  the exact key the future DCF phase reads `shareOutstanding` from, so
  wiring it now avoids rework.
- If the active symbol is in `KNOWN_ETFS`: render the static ETF info card,
  skip fetching.
- Panels (all conditionally rendered based on data presence, `null` pieces
  simply omit that section rather than showing empty/broken UI):
  - **Header**: logo (`profile.logo`), name, exchange/industry, live quote
    (price, day % via `(quote.c - quote.pc) / quote.pc * 100`, high/low,
    previous close).
  - **Your Position** strip: only if the symbol matches an open Stock
    investment — shares, avg cost, market value (`currentPrice * shares`),
    unrealized P&L (reusing `unrealizedPnlFor` from `investmentStats.js`).
  - **Peers** row: chips for each peer symbol (from `fetchPeers`), clicking
    one researches that symbol. No "Compare All" button this phase (no
    Research tab to send it to yet).
  - **Valuation**: Market Cap (`profile.marketCapitalization * 1e6`, via
    `formatLarge`), P/E (`metrics.peBasicExclExtraTTM`), Forward P/E
    (`metrics.peTTM`), P/S (`metrics.psTTM`), P/B (`metrics.pbQuarterly`),
    EV/EBITDA (`metrics.evEbitdaTTM`), EPS TTM, Div Yield
    (`metrics.dividendYieldIndicatedAnnual`). Color thresholds: P/E > 30 →
    warning tone, P/E < 15 → positive tone (reusing the app's existing
    `--green`/`--red`/`--text-dim` tokens — no new palette).
  - **Growth & Profitability**: Rev/Share, ROE (`roeTTM`, green > 15 /
    red < 0), ROA (`roaTTM`, green > 5), Net Margin, Gross Margin, Rev
    Growth YoY, EPS Growth YoY.
  - **Risk & Price Range**: Beta (`beta`, red > 1.5 / blue < 0.8), Debt/Equity
    (`totalDebt_totalEquityQuarterly`, red > 2), Current Ratio (green > 1.5 /
    red < 1), 52W High/Low/Return, Shares Outstanding.
  - **Analyst Recommendations**: horizontal proportional bars for
    strongBuy/buy/hold/sell/strongSell counts (plain CSS width-percentage
    bars, no charting library — consistent with the "meter" style used
    elsewhere, e.g. Risk tab's concentration meters in the original spec).
  - **Price Target range**: a horizontal track with low/mean/high markers
    plus a current-price marker; upside % = `(mean - current) / current * 100`.
  - **Earnings History** table: maps `earnings.earnings` (max 8, most-recent
    first) to `{ quarter: "Q{n} {yr}", actual, estimate, surprisePct, period }`.
  - **Recent News**: up to 8 items (image, headline, source/date), links
    open externally.

## Testing

- `fetchFundamentals.js`: unit tests mocking `fetch`, asserting all 7
  sub-requests are attempted, a single failed sub-request doesn't reject
  the whole call (resolves with `null`/`[]` for that piece), and the news
  list is sliced to 8 items. `fetchPeers` unit test.
- `knownEtfs.js`: trivial membership tests (`SPY` in set, `AAPL` not).
- `FundamentalsTab.jsx`: component tests with a mocked `fetchFundamentals`/
  `fetchPeers` — symbol chips render for open investments, clicking a chip
  triggers a fetch and renders the Valuation panel, ETF symbols skip the
  fetch and show the static card, missing `finnhubKey` shows the Key
  Required state, a `null` metrics piece doesn't crash the Valuation panel
  (renders without that stat instead).
- `AnalyzePage.jsx`: renders the tab bar, defaults to Fundamentals, other
  tabs show the "Coming soon" placeholder, switching tabs swaps content.
- Manual smoke test: research a real symbol (e.g. AAPL) and an ETF (e.g.
  SPY) against the live Finnhub API with a real key.

## Out of scope (this phase)

- Financials, Research, DCF, Efficient Frontier, Optimizer, Risk, Wheel,
  Screener tabs — later phases.
- "Compare All" → Research hand-off (no Research tab yet).
- Real Yahoo-proxy correlation data — deferred to whichever phase needs it.
- `valuationScore.js`'s 1-5 score (per the original spec, this isn't
  rendered in the UI even in the original app — only `getEarningsHistory`
  is used, which this phase already covers inline).
