# Analyze Tab — Phase 3: Research (Single/Compare/Sector Browser) — Design

## Context

Continuing the phased Analyze build. Fundamentals and Financials (core +
charts) are done. This spec covers **Research**: single-symbol view,
side-by-side compare, and a Sector Browser to seed compare with curated
stock lists. Explicitly deferred: the "Portfolio Context" panel
(correlation heatmap + combined efficient frontier) — it needs the
Frontier/correlation engine, which hasn't been built (still blocked on the
Yahoo-proxy decision deferred earlier). "Send to Optimizer"/"Send to Risk"
from the Sector Browser are also skipped — those tabs don't exist yet.

## Shared refactor — `src/components/analysis/SymbolPanels.jsx`

The panel block currently inlined in `FundamentalsTab.jsx` (header, Your
Position, Similar Stocks, Valuation, Growth & Profitability, Risk & Price
Range, Earnings History, Recent News — everything from the `fund-panels`
div down) moves into a standalone component:

```jsx
<SymbolPanels
  symbol={activeSymbol}
  result={result}            // { profile, quote, metrics, recs, targets, news, earnings }
  investment={investment}    // matching open investment, or null
  peers={peers}               // string[]
  onResearchPeer={(sym) => void}
/>
```

Pure presentational — no data fetching inside it. `FundamentalsTab.jsx`
keeps its own fetch/cache orchestration and just renders `<SymbolPanels
.../>` where its inline JSX used to be. CSS class names (`fund-*`) stay as
they are — `SymbolPanels` imports `FundamentalsTab.css` (already has every
class it needs) rather than introducing a parallel set of `research-*`
class names for identical visuals.

## Data layer

Research reuses `fetchFundamentals`/`fetchPeers` (already built) — no new
fetch code. No financials-loading integration this phase (deferred, per
the "smallest sensible slice" principle — can be added later without
disrupting this design).

## `src/lib/sectorStocks.js`

```js
export const SECTORS: Array<{ name: string, stocks: Array<{ sym: string, name: string }> }>
```

~14 real sectors, each with ~15–20 real, well-known tickers (not the
original app's exact list — reconstructed to the same shape/spirit):
Technology, Semiconductors, Software & Cloud, Healthcare, Biotech &
Pharma, Financial Services, Consumer Discretionary, Consumer Staples,
Energy, Industrials, Materials, Real Estate, Utilities, Communication
Services.

## `src/lib/compareMetrics.js`

```js
export const METRIC_GROUPS: Array<{
  group: string,                                   // 'Price' | 'Valuation' | 'Growth & Profitability' | 'Risk & Balance Sheet' | 'Analyst Consensus'
  rows: Array<{
    label: string,
    get: (result) => number | null,                // pulls the raw value from a symbol's fetchFundamentals result
    format: (value) => string,                      // display formatting
    better: 'high' | 'low' | null,                  // which direction wins; null = not comparable
  }>
}>

export function bestIndex(values: (number|null)[], better: 'high'|'low'|null) -> number | null
```

Five groups, mirroring the original spec:
- **Price**: Current Price (`quote.c`), Day Change % (`(c-pc)/pc*100`).
- **Valuation**: P/E (better: low), P/S (low), P/B (low), EV/EBITDA (low), Market Cap (null — not "better").
- **Growth & Profitability**: ROE (high), ROA (high), Net Margin (high), Rev Growth YoY (high).
- **Risk & Balance Sheet**: Beta (null), Debt/Equity (low), Current Ratio (high).
- **Analyst Consensus**: Buy-leaning recommendation ratio (high — `(strongBuy+buy)/(total)*100` from `recs`), Price Target Upside % (high — `(targetMean-current)/current*100`).

`bestIndex` returns the index of the winning symbol among the loaded set
for a row (or `null` if `better` is `null`, all values are `null`, or
there's a tie) — `CompareView` uses it to highlight that cell green with a
▲ marker, matching the original app's `bestIdx()` behavior.

## `src/components/analysis/CompareView.jsx`

```jsx
<CompareView symbols={string[]} data={{[symbol]: FundamentalsResult}} />
```

Renders a table: first column = metric label, one column per symbol
(header = symbol), grouped into the 5 `METRIC_GROUPS` sections (group name
as a spanning sub-header row). Each cell shows the formatted value; the
winning cell per row (via `bestIndex`) gets a green tone + `▲` marker,
matching `InvestmentRow`'s existing `price-favorable`/`price-unfavorable`
tone convention rather than inventing new colors.

## `src/components/analysis/SectorBrowser.jsx`

```jsx
<SectorBrowser onAddToCompare={(symbols: string[]) => void} />
```

Renders `SECTORS` as expandable sections (native `<details>`/`<summary>`,
matching the Stats page's collapsible-group pattern), each with a checkbox
grid of its stocks. A running "selected" count and an "Add to Compare"
button that calls `onAddToCompare` with the checked symbols and clears the
selection.

## `src/components/analysis/ResearchTab.jsx`

Orchestrates everything:
- Same Key Required / symbol-chip / free-text-add pattern as Fundamentals
  (chips from open Stock investments), plus a collapsible "Browse by
  Sector" toggle that shows/hides `SectorBrowser`.
- **Single / Compare** view toggle (same visual pattern as the
  Numbers/Charts toggles elsewhere).
- **Single view**: researching a symbol sets it active and renders
  `SymbolPanels` for it (identical behavior to Fundamentals, including the
  ETF short-circuit and active-chip highlight already built there).
- **Compare view**: researching a symbol (via chip, free-text, peer click,
  or Sector Browser's "Add to Compare") **adds** it to a `compareSymbols`
  list (deduped, no active-symbol replacement) instead of replacing the
  single active symbol; renders `CompareView` once ≥1 symbol is loaded. A
  small "Remove" control per column lets the user drop a symbol from
  compare.
- Data fetching/caching (`data`, `peers`, `bt_fundamentals_cache` mirror)
  is shared between both views — switching Single ⇄ Compare doesn't
  re-fetch anything already loaded.

## Page wiring

`AnalyzePage.jsx`: import `ResearchTab`, render it for `tab === 'research'`
in place of the placeholder (same pattern as `financials`). Update
`AnalyzePage.test.jsx`'s "Coming soon" test to target `dcf` instead (next
still-unbuilt tab), and mock any new hook dependencies `ResearchTab` needs
(none beyond what's already mocked — it uses the same `useAuth`/
`useUserSettings` pattern).

## Out of scope (this phase)

- Portfolio Context panel (correlation heatmap + combined frontier) —
  blocked on the Frontier engine phase.
- "Send to Optimizer"/"Send to Risk" from Sector Browser — those tabs
  don't exist yet.
- Loading financials from Research (the original app's "Load Financials"
  per-symbol button) — Financials tab already covers this standalone;
  cross-tab integration can come later without changing this design.
- Auto-adding researched symbols to a global watchlist — no watchlist
  feature exists in this app.

## Testing

- `sectorStocks.js`: trivial shape/membership tests (≥10 sectors, each
  with stocks, no duplicate tickers within a sector).
- `compareMetrics.js`: unit tests for each group's `get`/`format`
  functions against sample `FundamentalsResult` shapes, and `bestIndex`
  covering high/low/null/tie cases.
- `SymbolPanels.jsx`: component tests (moved from `FundamentalsTab.test.jsx`
  — panel rendering, null-metric safety, position strip, peers).
- `FundamentalsTab.jsx`: existing tests still pass unchanged after the
  refactor (it's a pure extraction, no behavior change).
- `CompareView.jsx`: renders one column per symbol, highlights the correct
  winning cell per row, handles a symbol with partial/null data without
  crashing.
- `SectorBrowser.jsx`: renders sector sections, checkbox selection, "Add
  to Compare" calls the callback with exactly the checked symbols and
  clears selection afterward.
- `ResearchTab.jsx`: Key Required state, Single/Compare toggle, researching
  in Compare view accumulates symbols (doesn't replace), Sector Browser's
  Add to Compare feeds into the same compare list, removing a symbol from
  compare.
- Manual smoke test: research several real symbols in Compare view,
  confirm the best-value highlighting looks right; use the Sector Browser
  to bulk-add a sector's stocks to compare.
