# BT Speculation — Analysis Section: Functional Reimplementation Spec

This document describes the complete behavior/logic of the "Analysis" feature (no styling) so it can be reimplemented on another stack. All file paths are from the original repo root (BTSpeculation).

---

## 1. Overall Structure — `src/components/analysis/AnalysisDashboard.jsx`

**Props in:** `investments`, `trades`, `cash`, `watchlistNav`, `onWatchlistNavConsumed`, `efParamsKey` (default `'bt_ef_params'`), `efResearchParamsKey` (default `'bt_ef_research_params'`), `accountId`, `userId`.

**Tabs (simple local `useState('fundamentals')` tab router, no URL routing):**
```
fundamentals | financials | research | dcf | frontier | optimizer | risk | wheel | screener
```
Each tab renders its own top-level component; switching tabs just swaps which child is mounted (no unmount-state-preservation — each tab keeps its own internal `useState`).

**Cross-tab shared state / plumbing:**
- `researchSymbol`, `financialsSymbol` — when a "ticker tape" (global watchlist chip) is clicked, a `watchlistNav = { dest, sym }` prop arrives; a `useEffect` inspects `dest` (`'research'` or `'financials'`) and (a) sets the preload symbol state, (b) switches `tab` to that destination, (c) calls `onWatchlistNavConsumed()` to clear the nav event upstream.
- `optimizerSymbols`, `riskSymbols` — used when Research's "Sector Browser" sends a symbol list to Optimizer/Risk tabs (calls `setTab('optimizer'|'risk')` too).
- `compareSymbols` — Fundamentals' "Compare All" button (peers) sends an array of symbols into Research, switches tab to `'research'`, and Research auto-loads them all into compare view.
- `corrVersion` — an integer bumped whenever fresh real correlation data arrives (see §7). Dashboard-level `useEffect` fetches correlations for all **open portfolio positions** (`investments.filter(i => i.status === 'open')`, needs ≥2 symbols) via `fetchCorrelations`, then calls `setRealCorrelations(corrMap)` / `setComputedParams(paramsMap)` (both mutate module-level singletons inside `efficientFrontier.js`) and increments `corrVersion`. This proactively primes the correlation module before the user even visits Optimizer/Risk/Frontier tabs.

**No React Router / URL state** — tabs are pure component state, not reflected in the URL.

---

## 2. Global/API-key & localStorage architecture

Two API keys are entered elsewhere in the app (header "key" icon, not part of Analysis itself) and read directly via `localStorage.getItem(...)` throughout Analysis:
- `bt_finnhub_key` — Finnhub.io key, used by Fundamentals & Research tabs.
- `bt_av_key` — Alpha Vantage key, used by Financials & DCF tabs. Free tier = **25 requests/day**; app displays this warning text but the actual daily-limit **tracking module (`avCallTracker.js`) is defined but not wired up/called anywhere** in the current codebase (dead code — 25/day is enforced only by Alpha Vantage itself returning a `"Note"`/`"Information"` field, which `fetchFinancials.js` turns into a thrown Error).

Every tab that needs a key shows a "Key Required" empty state (`KeyRound` icon) if missing, with instructions to get a free key.

**localStorage keys used across Analysis:**
| Key | Purpose |
|---|---|
| `bt_finnhub_key` | Finnhub API key |
| `bt_av_key` | Alpha Vantage API key |
| `bt_fundamentals_cache` | Cache of Fundamentals results (used by DCF to pull `shareOutstanding`) |
| `bt_financials_cache` | Cache of `{symbol: {annual, quarterly, extraRows}}` financial statement data, shared by Financials/Research/DCF |
| `bt_financials_ts` | Per-symbol fetch timestamps, for "fetched Xm ago" UI |
| `bt_returns_cache_v2` | 24h-TTL cache of weekly-return arrays per symbol (for correlation/backend of Efficient Frontier), keyed with a `_ts` field |
| `bt_watchlist` (namespaced via `accountKey`) | Ticker-tape / global watchlist list of symbols |
| `bt_ef_params` / `bt_ef_research_params` (configurable prop keys) | Per-usage overrides of asset return/vol assumptions for the Efficient Frontier (`{SYM: {r, s}}`) |
| `${storageKey}_cash_rate` | Cash annual return rate override (%) for the Frontier's cash slider |
| `bt_av_calls` | (Unused) daily AV call counter with `{date, count}` |

**Supabase shared cache** (`src/utils/financialsSharedCache.js`, table `financials_cache`): a cross-user cache keyed by ticker, storing the same `{annual, quarterly, extraRows}` shape produced by `fetchFinancials`. Before hitting Alpha Vantage, Financials/Research/DCF all check `getSharedCache(ticker)` first; after a live fetch they `saveSharedCache(ticker, data)` (upserts with `fetched_at`, `user_id`). `getAllSharedCache()` bulk-loads the whole table and merges it into localStorage on mount (local wins on conflicts) — the purpose is that once **any** user has fetched a ticker's financials, all users benefit without spending their own AV quota.

---

## 3. Tab: Fundamentals (`Fundamentals.jsx`)

**Purpose:** single-ticker fundamentals dashboard + peer comparison launcher.

**Data source:** Finnhub only, via `fetchFundamentals(symbol, apiKey)` (`utils/fetchFundamentals.js`), which fires 7 parallel requests using `Promise.allSettled` (each optional — missing pieces become `null`):
```
GET /stock/profile2?symbol=SYM
GET /quote?symbol=SYM
GET /stock/metric?symbol=SYM&metric=all      → returned as .metrics = json.metric
GET /stock/recommendation?symbol=SYM         → returned as .recs = json[0]
GET /stock/price-target?symbol=SYM           → .targets
GET /company-news?symbol=SYM&from=(today-30d)&to=today  → .news (sliced to first 8)
GET /stock/earnings?symbol=SYM               → .earnings (full response, {earnings:[...]})
```
Also `fetchPeers(symbol, apiKey)` → `GET /stock/peers?symbol=SYM`, returns array of similar tickers.

**UI/state:** symbol chips for each open investment + free-text "extra symbols" search; `data` is a `{symbol: fetchedResult}` in-memory map (not persisted); ETF/Index symbols (see `ETFCard.jsx`'s `KNOWN_ETFS` map of ~50 known tickers) skip the Finnhub fetch entirely and render a static "no financials for ETFs" info card with outbound links (ETF.com, Yahoo Finance, Morningstar).

**Displayed panels:**
- Header: logo, name, exchange/industry, live quote (price, day %, H/L/prev close).
- "Your position" strip if the symbol is an open investment (shares, avg cost, mkt value, unrealized P&L).
- Peers row ("Similar Stocks") with a "Compare All" button that dedupes `[selected, ...peers]` and calls `onSendToCompare(syms)` → Dashboard routes this to Research tab in compare view.
- Valuation panel: Market Cap (`marketCapitalization * 1e6`), P/E (`peBasicExclExtraTTM`), Forward P/E (`peTTM`), P/S (`psTTM`), P/B (`pbQuarterly`), EV/EBITDA (`evEbitdaTTM`), EPS TTM, Div Yield (`dividendYieldIndicatedAnnual`). Color thresholds: P/E >30 yellow, <15 green.
- Growth & Profitability: Rev/Share, ROE (`roeTTM`, green>15/red<0), ROA (`roaTTM`, green>5), Net Margin, Gross Margin, Rev Growth YoY, EPS Growth YoY.
- Risk & Price Range: Beta (`beta`, red>1.5/blue<0.8), Debt/Equity (`totalDebt_totalEquityQuarterly`, red>2), Current Ratio (green>1.5/red<1), 52W High/Low/Return, Shares Outstanding.
- Analyst Recommendations bar chart (strongBuy/buy/hold/sell/strongSell counts as proportional bars) + period label.
- Analyst Price Target range bar: shows low/mean/high markers plus current price marker on a horizontal track; upside% = `(mean-current)/current*100`.
- Earnings History table (`getEarningsHistory` in `valuationScore.js`): maps Finnhub `/stock/earnings` array (max 8, most-recent-first reversed) to `{quarter: "Q{n} {yr}", actual, estimate, surprise%, period}`.
- Recent News list (30-day window, up to 8 items, image + headline + source/date, links out).

**Formatters:** `fmtLarge` → $ with T/B/M suffix based on magnitude; generic `fmt(v, suffix, decimals)`.

---

## 4. Tab: Financials (`Financials.jsx`)

**Purpose:** multi-period (annual/quarterly) Income Statement / Balance Sheet / Cash Flow tables + 14 derived analytical charts, backed by Alpha Vantage with a shared cache and a manual-paste fallback.

**Data source & caching chain (in priority order) per symbol:**
1. In-memory `cache` state, seeded from `localStorage['bt_financials_cache']` (and pre-seeded with `MOCK_FINANCIALS` for `MSFT` demo data if not present).
2. On mount, merges in the entire Supabase shared cache (`getAllSharedCache()`), local wins on conflict.
3. If still missing and `bt_av_key` present, calls `fetchFinancials(sym, apiKey)`.
4. Result written to `cache` state + localStorage + Supabase shared cache (`saveSharedCache`).
5. If no AV key: shows key-required screen with a "Paste Data Instead" button (manual paste importer, see below).

**`fetchFinancials(symbol, apiKey)`** (`utils/fetchFinancials.js`) — calls 3 Alpha Vantage endpoints **sequentially with 1100ms delays between them** (rate-limit friendly):
```
GET ?function=INCOME_STATEMENT&symbol=SYM&apikey=KEY
(wait 1.1s)
GET ?function=BALANCE_SHEET&symbol=SYM&apikey=KEY
(wait 1.1s)
GET ?function=CASH_FLOW&symbol=SYM&apikey=KEY
```
Each AV response can return `data['Error Message']`, `data['Note']`, or `data['Information']` (rate-limit signal) — all thrown as Error. `parseReports()` merges the three statements by `fiscalDateEnding`, keeps the **last 8 dates** (sorted ascending then sliced), and computes:
- `freeCF = operatingCashflow − |capitalExpenditures|` (only if both present; `capex` stored negative in output).
- Numeric fields mapped from AV's raw field names (revenue=`totalRevenue`, cogs=`costOfRevenue`, grossProfit, rd=`researchAndDevelopment`, sga=`sellingGeneralAndAdministrative`, ebitda, operatingIncome, netIncome, cash=`cashAndCashEquivalentsAtCarryingValue`, cashAndShortTerm, currentAssets, totalAssets, currentLiabilities, longTermDebt, totalLiabilities, equity=`totalShareholderEquity`, retainedEarnings, operatingCF, capex, freeCF, depreciation, dividendsPaid, investingCF, financingCF). Note: many additional balance-sheet line items shown in the UI table (inventory, goodwill, intangibles, accountsPayable, etc.) are **not** populated by the AV parser and only get filled via the manual paste importer.

Uses **3 AV calls per symbol per fetch** — combined with the 25/day free tier this is explicitly called out in the UI ("Alpha Vantage · 3 calls/symbol").

**Manual paste importer** (`PasteModal` + `parseFinancialsPaste`): lets users paste tab-separated financial tables (e.g., copied from Macrotrends). Detects header format via regex:
- `FY\s*(\d{4})` → annual, row 0 is all period headers, no label column.
- `Q([1-4])\s*(\d{4})` → quarterly, maps quarter to `{1:'03-31',2:'06-30',3:'09-30',4:'12-31'}`.
- Fallback: label in col 0, integer years (1990–2100) in cols 1+ → annual.
- Fallback 2: no header at all → assumes `numCols` consecutive years ending at current year.

A large `LABEL_MAP` (~150 entries) normalizes human row labels ("Cost of Goods Sold", "R&D Expenses", "Shareholders Equity", etc.) to canonical field keys; unrecognized rows become `extraRows` (slugified key + original label), preserved and rendered as an "Additional fields" footer section in the table. Numbers parse via `parseNum`: strips `,`, treats `(123)` as negative, skips `%`-containing cells and `-`/`n/a`/`—`. User selects a unit multiplier (thousands=1e3, millions=1e6 default, billions=1e9, actual=1); capex values are forced negative. `mergePasteCache` deep-merges pasted periods into existing cached periods **by date**, never overwriting a non-null existing field with null, and re-derives `freeCF` when both `operatingCF` and `capex` become available.

**UI sections (tab within tab):** `SECTIONS` = Income Statement / Balance Sheet / Cash Flow, each with a `chartBars` config (for the top bar chart) and a long `rows` list (metric key + label + optional custom formatter) rendered as a wide table with **period-over-period % change badges** (▲/▼, computed via `pctChange`). Table columns = periods (most recent first); sticky first column. Frequency toggle Annual/Quarterly. A 4th pseudo-section "Charts" renders `ChartsTab`.

**ChartsTab — 14 derived charts**, computed from raw periods via a single reducer (`cd`), each gated on `has(key)` (some data present):
1. Revenue & Profit (bar: revenue/grossProfit/netIncome)
2. Margin Trends (line %: grossMargin, opMargin, netMargin, fcfMargin — margins = `metric/revenue*100`)
3. YoY Growth % (bar, colored green/red by sign: revGrowth, niGrowth — `(v-p)/|p|*100`)
4. EPS Trend (bar epsBasic + line epsDiluted)
5. Cash Flow Statement (operatingCF, freeCF, |capex|)
6. FCF vs Net Income (earnings-quality check)
7. Cash & Short-Term Investments (stacked bars: cash, cashAndShortTerm)
8. Balance Sheet Composition (totalAssets, totalLiabilities, equity)
9. Liquidity & Leverage Ratios (line: currentRatio = currentAssets/currentLiabilities, debtToEquity = longTermDebt/equity, reference line at 1)
10. Return on Equity & Assets (roe = netIncome/equity*100, roa = netIncome/totalAssets*100)
11. Long-Term Debt vs Free Cash Flow
12. R&D & SG&A Spending (dual-axis: absolute $ bars + % of revenue dashed lines)
13. FCF Growth YoY %
14. EBITDA (bar EBITDA + line Operating Income)

Each chart has a static educational tooltip (`CHART_INFO` map) explaining what to look for — pure text content, no calculation.

`ChartTab.jsx` (separate top-level component file, not imported by AnalysisDashboard directly) appears to be a legacy/alternate entry — the live wiring goes through `Financials.jsx`'s internal `ChartsTab`.

---

## 5. Tab: Research (`Research.jsx`)

**Purpose:** ad-hoc research on any ticker(s) — single view or side-by-side compare table — plus a Sector Browser and Portfolio Context (correlation + combined efficient frontier vs. current holdings).

**Data:** same `fetchFundamentals` as the Fundamentals tab (Finnhub). Each loaded symbol is auto-added to the global watchlist via `addSymbolToWatchlist(sym)` (TickerTape module-level singleton). Financials can optionally be loaded per-symbol too (button "Load Financials") using the same AV shared-cache chain as the Financials tab, writing into the same `bt_financials_cache` key — this is how DCF/Financials/Research all interoperate on one shared cache.

**Sector Browser** (`SectorBrowser` sub-component, backed by `utils/sectorStocks.js` `SECTORS` — a curated list of ~14 sectors each with a static list of `{sym, name}` top-20-by-market-cap stocks): multi-select checkbox grid; buttons to (a) "Add to Compare" (loads all selected into Research and switches to compare view), (b) "Send to Optimizer" (merges with already-loaded symbols, calls `onSendToOptimizer`), (c) "Send to Risk" (`onSendToRisk`).

**Single view (`SingleView`):** same panel layout as Fundamentals tab (Valuation / Growth / Risk / Analyst Recs / Price Target / News), duplicated logic.

**Compare view (`CompareView` + `METRIC_GROUPS`):** a table with 5 groups (Price, Valuation, Growth & Profitability, Risk & Balance Sheet, Analyst Consensus), each row has a `get(d)` extractor, a `format(v)` fn, and a `better: 'high'|'low'|null` flag. For each row, `bestIdx()` finds which loaded symbol has the best value (highest or lowest depending on `better`) and highlights it green with a ▲ marker.

**Portfolio Context panel** (only rendered if `symbols.length>0 && investments.length>0`): collapsible, with two internal sub-tabs:
- **Correlation Matrix** — `CorrelationHeatmap` renders a symmetric matrix (only lower triangle shown) of your open portfolio symbols + researched symbols combined, using `getCorrelationMatrixForSymbols` from `efficientFrontier.js`. Cell coloring bands: ≥0.7 red, ≥0.4 orange, ≥0.15 yellow, ≥-0.05 gray, else blue.
- **Efficient Frontier** — renders `FrontierPanel` in "combined mode" (portfolio symbols + new researched symbols not already held), passing a `priceMap` built from each researched symbol's live quote (so the rebalancing math can convert weight% deltas into approximate share counts).

A `useEffect` here independently fetches real correlations (`fetchCorrelations`) for `[...portSymbols, ...researchSymbols]` whenever that combined symbol list changes, feeding the same module-level `_realCorr`/`_computedParams` singletons.

---

## 6. Tab: DCF (`DCF.jsx`)

**Purpose:** interactive Discounted Cash Flow valuation with sensitivity table.

**Data source priority for a symbol** (`loadSymbol`): (1) `localStorage['bt_financials_cache']` (skip if it's stale MSFT mock heuristically detected via `annual[0].date === '2020-06-30'`), (2) Supabase shared cache, (3) if `bt_av_key` present → live `fetchFinancials`; if no key and symbol is `MSFT` → falls back to bundled `MOCK_FINANCIALS`; otherwise shows "no_key" error state. All results get written back into the same shared `bt_financials_cache` + Supabase cache.

**Derived base inputs (`derived` memo):**
- `recentAnnual` = last 3 annual periods (most recent first).
- TTM logic: sums `freeCF` over the last 4 quarters (`last4Q`) **only if all 4 have non-null freeCF**; uses TTM instead of the 3-yr annual average **only if** the most-recent quarter's date is strictly newer than the most-recent annual date. Otherwise `baseFCF` = mean of the 3 most recent annual `freeCF` values (nulls filtered).
- `netCash` = `(cashAndShortTerm ?? cash ?? 0) − (longTermDebt ?? 0)` from whichever period (TTM quarter or latest annual) was used as basis.
- `impliedGrowth` = CAGR of FCF across **all** available annual periods with `freeCF > 0`: `(newest/oldest)^(1/(n-1)) − 1`, as a %. This seeds the default `growthRate` slider (clamped to [-30, 60]).
- `sharesOutstanding` pulled from `localStorage['bt_fundamentals_cache'][symbol].profile.shareOutstanding * 1e6` (i.e., requires having visited Fundamentals/Research for that ticker first, or manual override). Hardcoded special-case: MSFT defaults to 7.43B shares if not cached.
- `currentPrice` defaults from the matching open investment's `currentPrice`/`avgCost`, else manual override.

**User-adjustable inputs:** Base FCF (override, accepts shorthand `10B`/`1.5M`/`500K`), Net Cash/Debt (override), Shares Outstanding (override), FCF Growth Rate Yr1-5 (slider -30..60%, default = implied CAGR), Terminal Growth Rate (slider 0..6%, default 3%), Discount Rate/WACC (slider 5..20%, default 10%), Current Price (override).

**Core DCF formula (`runDCF`):**
```js
r  = discountRate/100
g  = growthRate/100
gt = terminalRate/100
for t = 1..5:
  fcf_t        = baseFCF * (1+g)^t
  discounted_t = fcf_t / (1+r)^(t-0.5)      // MID-YEAR convention
  pv += discounted_t
fcfYear5      = baseFCF * (1+g)^5
terminalValue = fcfYear5 * (1+gt) / (r - gt)     // Gordon Growth, undiscounted
pvTerminal    = terminalValue / (1+r)^5           // discounted at END of yr5 (not mid-year)
totalEquityValue = pv + pvTerminal + netCash
intrinsicValue   = totalEquityValue / sharesOutstanding
```
`marginOfSafety = (intrinsicValue − currentPrice) / currentPrice * 100`.

**Sensitivity table:** 6 discount rates `[7,8,9,10,11,12]%` × 5 growth rates `[g-10, g-5, g, g+5, g+10]` (clamped to [-50,100]), each cell re-runs `runDCF` and colors by margin-of-safety bucket (>20% green, 0-20% emerald, 0..-20% yellow, <-20% red).

**Other UI:** year-by-year FCF/PV table, value-breakdown stacked bar (PV FCFs / Terminal Value / Net Cash proportions, with a warning if terminal value >75% of total), FCF historical+projected line chart, full step-by-step math breakdown panel (shows exact formulas/numbers used).

---

## 7. Efficient Frontier / Risk / Optimizer engine — `src/utils/efficientFrontier.js`

This single module powers the Efficient Frontier tab, the Optimizer tab, and most of the Risk tab. Key exported functions and internal model:

**Asset parameter model:** a static lookup table `ASSET_PARAMS` gives `{r (expected annual return), s (annual volatility), cat (category)}` for ~18 well-known tickers (AAPL, NVDA, MSFT, META, AMZN, GOOGL, AMD, TSLA, SMH, SPY, QQQ, TLT, GLD, XOM, BTC, ETH, JPM, SOFI); anything else defaults to `{r:0.12, s:0.28, cat:'other'}`. `getAssetParams(symbol)` merges in **live computed params** (`_computedParams`, set by `setComputedParams`) when available, keeping the static category for correlation fallback purposes.

**Real historical data injection:** `fetchCorrelations(symbols)` (`utils/fetchCorrelations.js`) is the bridge to real market data:
- Fetches 2 years of **weekly** closes per symbol from a Yahoo Finance proxy: `GET /yahoo-proxy/v8/finance/chart/{symbol}?interval=1wk&range=2y`.
- Skips known crypto tickers (`BTC,ETH,SOL,BNB,XRP,ADA,DOGE,AVAX,DOT,MATIC,SHIB,LTC`) — Yahoo weekly data deemed unreliable for these.
- Computes weekly simple returns, caches raw return arrays in `localStorage['bt_returns_cache_v2']` with a 24h TTL.
- `computeAssetParams(returns)`: `annualVol = stddev(weeklyReturns) * sqrt(52)`; `annualReturn = mean(weeklyReturns) * 52`.
- `pearson(a,b)` computes Pearson correlation on the overlapping tail of both return series (min 8 points required).
- Returns `{ corrMap: {SYM1:{SYM2: r}}, paramsMap: {SYM: {r, s}} }`.
- Callers (`AnalysisDashboard`, `PortfolioContext` in Research, `PortfolioOptimizer`) feed these into module-level singletons via `setRealCorrelations(map)` (merges into `_realCorr`) and `setComputedParams(map)` (merges into `_computedParams`), then bump a local `corrVersion` counter to force memoized recalculation.

**Correlation resolution order (`getCorrelation(sym1, sym2)`):** 1 if same symbol; 0 if either is `'CASH'`; else real computed Pearson correlation if present (`_realCorr`); else a static category×category lookup table `CAT_CORR` (tech/etf_eq/bond/gold/crypto/energy/financial/other), defaulting to 0.50 for unknown pairs.

**Portfolio stats (`portfolioStats`):**
```
Return   = Σ (wᵢ × rᵢ)
Variance = Σᵢ Σⱼ (wᵢ × wⱼ × σᵢ × σⱼ × ρᵢⱼ)
Vol      = √Variance
Sharpe   = (Return − RISK_FREE) / Vol         // RISK_FREE = 0.045 (4.5%)
```

**Monte Carlo simulation (`generateEfficientFrontierData` / `generateCombinedFrontierData`):** runs **10,000 iterations**, each drawing random weights via `randomWeights(n)` — samples `n` values from `-ln(U)` (i.e. Exponential(1) via inverse-CDF trick) then normalizes to sum 1 (this approximates a symmetric Dirichlet distribution). For each random weight vector computes `{ret, vol, sharpe}` plus a **Diversification Ratio** = `(weighted avg of individual vols) / portfolio vol`. Tracks the point with max Sharpe and max diversification ratio across all 10,000 draws.

**Frontier extraction (`extractFrontier`, 150 volatility buckets):** buckets all simulated points by volatility into 150 equal-width bins, keeps only the max-return point per bucket, then walks buckets in ascending vol order keeping only points whose return is a new running maximum (this discards the dominated lower half of the classic Markowitz "bullet" shape, producing a monotonically increasing frontier curve).

**Cash as an asset:** if `cashOptions.amount > 0`, `'CASH'` is appended to the symbol list with `{r: cashRate (default 3%), s: 0.001, cat:'cash'}` and 0 correlation to everything, so it acts as a near-risk-free asset in the simulation.

**"Combined" mode (`generateCombinedFrontierData`):** unions existing portfolio symbols with extra ("researched") symbols not currently held; "current" point uses real portfolio weights for held symbols and 0% weight for the new ones — this is how the Research tab's "how would adding this stock change my frontier" visualization works.

**Subset Optimizer — backward elimination (`findOptimalSubset` / `findOptimalSubsetForSymbols` → `runBackwardElimination`):**
1. Compute the max-Sharpe portfolio for the **full** symbol set (`getMaxSharpeForSubset`, N simulations, default param `nSim` selectable in UI as Fast=3000/Standard=6000/High=15000/Max=40000).
2. Iteratively: for each symbol currently in the set, compute the max-Sharpe portfolio of the set **minus that symbol** (using 60% of nSim for sub-simulations), keep whichever removal yields the highest Sharpe.
3. If that best-Sharpe-after-removal is **not** better than the previous step's Sharpe, stop (no further improvement possible).
4. Otherwise drop that symbol permanently and repeat, down to a floor of 2 symbols remaining.
5. Returns `{steps: [...], fullSharpe, fullSymbols, optimalSymbols, optimalSharpe, optimalRet, optimalVol, optimalWeights, improved: bool, dropped: [symbols in elimination order]}`.

UI (`PortfolioOptimizer.jsx`) lets the user override each symbol's expected return/vol (`paramsOverride`) and manually fetch/enter live prices (Finnhub `/quote` one-by-one with 150ms pacing) to translate the recommended weight % into buy/sell **share counts**, given either the actual portfolio value or a manually entered "Total to invest" (custom mode from Sector Browser).

**Portfolio-level risk metrics (`getPortfolioRiskMetrics`):**
- HHI concentration = `Σ weight²`; `diversificationScore = round((1-HHI)*100)`.
- Stop-loss coverage = `% of open positions with stopLoss set`; `dollarAtRisk = Σ max(0, (currentPrice-stopLoss)) × shares` for positions where stop < price.
- Portfolio beta: per-symbol `beta = (σ_symbol × correlation(symbol,'SPY')) / σ_SPY` (`SPY_VOL = 0.17` constant), weighted by position market-value weight.
- **VaR 95% (1-day):** `dailyVol = annualVol/√252`; `VaR95 = totalMV × dailyVol × 1.645` (z-score for 95% one-tailed normal).

**Risk contribution (`getRiskContribution`):** Marginal Contribution to Risk per position: `MCR_i = w_i × Σⱼ(w_j·σ_i·σ_j·ρ_ij) / portfolioVol`; `riskPct = MCR_i/portfolioVol × 100`. Flags positions where `riskPct > weight+5` ("outsized") vs `riskPct < weight-5` ("efficient").

**Stress tests (`getStressTests`):** 6 fixed market-move scenarios (Bull Run +20%, Mild Pullback -5%, Correction -10%, Bear Market -20%, Crash -30%, 2008-Level -50%). Per position: `move = beta × marketMove`; `impact$ = move × marketValue`. Portfolio-level: `portfolioMove = weightedBeta × marketMove`.

---

## 8. Tab: Efficient Frontier (`EfficientFrontier.jsx` → `FrontierPanel.jsx`)

Thin wrapper requiring ≥2 open positions, delegates to shared `FrontierPanel` (also used inside Research's Portfolio Context in "combined" mode).

**`FrontierPanel` behavior:**
- Persists per-symbol return/vol overrides to `localStorage[storageKey]` (JSON `{SYM:{r,s}}`), and a cash-rate override to `localStorage['{storageKey}_cash_rate']`.
- Renders a scatter/line chart (X=volatility%, Y=return%, line = frontier curve, plus 3 reference dots: **Your Portfolio** (current weights), **Max Diversification**, **Max Sharpe**).
- Custom tooltip on hover shows the composite allocation for that frontier point, and for each symbol computes a suggested **buy/sell delta** in dollars/shares relative to current holdings (`targetWeight% × totalMV / price − currentShares`).
- "Adjust Expected Returns & Volatility" expandable editor: per-symbol sliders (0-100% return via 0-200% range, 1-300% volatility) plus computed "Implied Sharpe" for that asset alone; shows whether values are default (from 2yr weekly history) or manually overridden; researched-but-not-owned symbols marked "new".
- "Rebalancing Plan" table: for each symbol, shows Current % / Current Shares / Max-Div % + Action / Max-Sharpe % + Action, where Action = buy/sell N shares (or $ delta for CASH) computed from `(targetWeight - currentWeight)/100 × totalMV / price`.
- Cash position card (if `cash>0` passed in): editable annual return rate input feeding into the simulation as a risk-free-ish asset.

---

## 9. Tab: Optimizer (`PortfolioOptimizer.jsx`)

Already covered mechanically in §7. UI-level notes:
- Two modes: `'portfolio'` (uses actual open investments) or `'custom'` (symbol list injected from Sector Browser via `incomingSymbols` prop).
- Simulation-count selector: Fast (3000) / Standard (6000) / High (15000) / Max (40000) simulations per subset-evaluation step.
- "Assumptions" table lets you override each symbol's expected return %, volatility %, and current price (with a "Fetch" button hitting live Finnhub quotes one-by-one, 150ms apart, tracking per-symbol errors).
- "Elimination Trail": renders each backward-elimination step as a row (all original symbols shown, dropped ones struck-through, kept ones highlighted), with the resulting Sharpe/return/vol and % change vs previous step; expandable to show that step's full allocation with dollar/share targets (given "Total to invest" input in custom mode, or portfolio value in portfolio mode).
- Displays a badge if correlation data has been refreshed since the last run (`ranWith !== corrVersion`) prompting a re-run.

---

## 10. Tab: Risk (`RiskAnalysis.jsx`)

All computed via `efficientFrontier.js` functions (§7): `getPortfolioRiskMetrics`, `getRiskContribution`, `getCorrelationMatrix`/`getCorrelationMatrixForSymbols`, `getStressTests`.

**Hero row (4 tiles):** Portfolio Beta (bands: >1.5 / >1.1 / <0.8 / else), 1-Day 95% VaR (dollar), Diversification Score /100 (>70 / >50 / else), Stop Coverage % (>=80 / >=50 / else).

**Concentration Risk panel:** largest position weight (meter, thresholds 30%/20%), HHI index (meter, thresholds 0.25/0.15), plus a stat list (Total Portfolio, Cash, Expected Return, Volatility, Sharpe).

**Stop Loss Protection panel:** positions-with-stop count/meter, `$ at risk if all stops hit`, risk as % of portfolio, VaR, beta; a warning banner if coverage <80%.

**Stress Tests:** expandable scenario rows (6 fixed scenarios, see §7) each showing portfolio %/$ move; expanding shows a per-position table (beta, est. move %, $ impact), sorted by most-negative impact first.

**Risk Contribution:** dual-bar rows per symbol (portfolio weight vs risk contribution %; flagged if risk% > weight%+5), plus a table with Weight / Risk Contribution / Beta / Est. Vol / **Risk-to-Weight Ratio** (thresholds >1.3 / <0.7).

**Correlation Matrix:** full symmetric heatmap (both triangles rendered, unlike Research's half-matrix), color bands keyed to correlation value (≥0.99 diagonal, ≥0.75, ≥0.50, ≥0.25, ≥0, ≥-0.25, else).

**Sector Browser hand-off mode:** if `incomingSymbols` provided (from Research's Sector Browser "Send to Risk") but there are no open positions, shows only a correlation matrix for that ad-hoc symbol list with a dismissible banner.

---

## 11. Tab: Wheel (`WheelTracker.jsx`)

**Purpose:** track the options "Wheel" strategy (sell cash-secured puts → get assigned shares → sell covered calls → repeat), analyze premium income, and score/calculate strike selection. Three sub-tabs: Wheel Positions, Premium Income, Strike Calculator.

**Data sources:** purely derived from the app's own trade/investment records — **no external API calls**. Inputs: `trades` (day-trading trade log, filtered to `type==='option' && direction==='short'`) and `investments` (filtered to `assetType==='Option'`, converted into the same trade shape using `avgCost` as entry premium, `sellPrice`/`currentPrice` as exit price, `shares` as contract quantity, `buyDate`/`sellDate` as entry/exit dates — tagged `_fromInvestments: true`).

**`buildWheelPositions(trades, investments)` — core aggregation, grouped by symbol:**
```
premiumCollected(t)   = entryPrice × qty × 100
premiumPaidToClose(t) = exitPrice × qty × 100          (0 if still open)
netPremium(t)         = premiumCollected − premiumPaidToClose − fees
daysHeld(t)           = round((exitDate ?? now) - entryDate) in days, min 1
capitalRequired(t)    = strike × qty × 100
annualizedReturn(premium, capital, days) = (premium/capital) × (365/days) × 100
```
**Stage detection** (per symbol): `selling_puts` if any open CSP exists → else `selling_calls` if any open CC → else `holding_shares` if open share position exists → else `idle`.

**Per-symbol rollups:** `totalPremiumCollected`, `totalNet` (= collected − paid-to-close − fees, summed across all trades on that symbol), `currentCapital` = `openPutCapital || sharesCapital || maxCapitalEverUsed` (fallback chain), `annReturn` = `annualizedReturn(totalNet, currentCapital, sum of daysHeld)`, `winRate` = % of closed trades with `netPremium>0`.

**Share position math:** `avgCost` = share-weighted average cost across open share lots; `effectiveCost = avgCost − (totalNet / totalShares)` — i.e., the true break-even price after netting out all premium collected on that symbol historically.

**Premium Income sub-tab:** aggregates net premium by symbol (bar), cumulative net premium over time (running sum, line chart), monthly premium (grouped by `date.slice(0,7)`, bar), plus summary stats (Total Net, Gross Collected, Avg Monthly = totalNet/monthsWithActivity, Open/unrealized Premium = Σ premiumCollected of still-open trades).

**Strike Calculator sub-tab — two independent tools:**
1. **Options-chain paste parser** (`parseChain`): expects tab-separated broker chain export with 13 columns per row: `CallLast, CallDelta, CallBid, CallAsk, CallVol, CallIV, STRIKE, PutIV, PutVol, PutBid, PutAsk, PutDelta, PutLast`. A line matching `/Last\s*Price[:\s]+([0-9.]+)/i` anywhere sets `lastPrice`.
2. **Strike scoring (`scoreStrikes`)** — for CSP or CC, filters to OTM candidates with valid delta & positive mid-price, then computes for each:
```
mid       = (bid+ask)/2  (fallback: last)
spread    = (ask-bid)/mid  (fallback 0.5 if no bid/ask)
capital   = isCSP ? strike×100 : lastPrice×100
annRet    = (mid×100/capital) × (365/dte) × 100
otmPct    = |strike-lastPrice|/lastPrice × 100
breakEven = isCSP ? strike-mid : strike+mid
bePct     = |breakEven-lastPrice|/lastPrice × 100

deltaScore  = max(0, 100 - |delta - 0.27|×300)      // peak at delta=0.27
retScore    = min(100, annRet × 2.5)
spreadScore = max(0, 100 - spread×200)
volScore    = vol ? min(100, vol×2) : 20

composite = retScore×0.40 + deltaScore×0.35 + spreadScore×0.15 + volScore×0.10
```
Risk profile bucket by |delta|: `≥0.40` Aggressive, `≥0.28` Balanced, `≥0.15` Conservative, else Far OTM. Results sorted descending by composite score; top-3 rendered as "Best Overall / Runner-up / Alternative" cards, full ranked table below. Clicking any strike auto-fills the manual Calculator's strike/premium/stock-price fields.
3. **Manual Calculator:** inputs Stock Price, Strike, Premium/share, Contracts, DTE → outputs %OTM, Break-Even, Max Profit (`premium×contracts×100`), Capital Required (`isCSP ? strike×contracts×100 : price×contracts×100`), Premium Yield (`totalPremium/capitalNeeded×100`), Annualized Return (same formula as scoring, using user-entered DTE).

---

## 12. Tab: Screener (`Screener.jsx`, present but not part of the original 8-tab set)

Not a live-data screener — it's a **Finviz filter-builder UI** that composes a `finviz.com/screener.ashx?f=...` URL from ~20 filter dropdowns (Price, Market Cap, Optionable/Shortable, Avg Volume, Dividend Yield, Payout Ratio, P/E, Forward P/E, Beta, 52-week performance, Short Interest, Geography, Exchange, Index, etc. — each option maps to a Finviz filter code string like `sh_price_u10`, `fa_pe_u15`). Includes bookmarking of filter presets (persisted via Supabase, keyed by `accountId`/`userId`), a copy-URL button, and opens the constructed URL in Finviz (external site) rather than rendering results in-app.

---

## 13. Cross-cutting utility modules (`src/utils/`)

| File | Exports | Purpose |
|---|---|---|
| `efficientFrontier.js` | `setRealCorrelations`, `setComputedParams`, `getAssetParams`, `generateEfficientFrontierData`, `generateCombinedFrontierData`, `findOptimalSubset`, `findOptimalSubsetForSymbols`, `getCorrelationMatrixForSymbols`, `getDefaultParams`, `getPortfolioRiskMetrics`, `getRiskContribution`, `getCorrelationMatrix`, `getStressTests` | Core MPT/Monte-Carlo engine (§7) |
| `fetchCorrelations.js` | `fetchCorrelations(symbols)`, `clearCorrelationCache()` | Pulls 2yr weekly Yahoo data via proxy, computes Pearson correlations + annualized return/vol, 24h cache |
| `fetchFundamentals.js` | `fetchFundamentals(symbol, apiKey)`, `fetchPeers(symbol, apiKey)` | Finnhub aggregate fetch (profile/quote/metrics/recs/targets/news/earnings) |
| `fetchFinancials.js` | `fetchFinancials(symbol, apiKey)` | Alpha Vantage 3-statement fetch + normalization (annual/quarterly, FCF derivation) |
| `financialsSharedCache.js` | `getSharedCache`, `saveSharedCache`, `getAllSharedCache` | Supabase `financials_cache` table read/write |
| `avCallTracker.js` | `trackAVCalls`, `getAVCallStats` | Daily AV call counter (25/day) — **defined but currently unused/dead code** |
| `investmentCalcs.js` | `calcInvestmentPnL`, `getInvestmentStats`, `getAllocationByType`, `getAllocationBySector`, `getPositionPerformance`, `fmtInv`, `fmtPct`, plus `SECTORS`, `ASSET_TYPES` constants | Portfolio-wide P&L math shared with the Investments tab (not Analysis-specific but consumed by Fundamentals for position summary and `fmtInv` used broadly in Risk/Wheel) |
| `valuationScore.js` | `calculateValuationScore`, `getEarningsHistory` | 1-5 valuation score from P/E, div yield, PEG, payout ratio (score not currently rendered in the UI — `getEarningsHistory` **is** used by Fundamentals) |
| `sectorStocks.js` | `SECTORS` (14 sectors × ~20 static tickers) | Backing data for Research's Sector Browser |
| `mockFinancials.js` | `MOCK_FINANCIALS` | Static MSFT demo dataset used when no AV key is present |
| `supabase.js` | `supabase` client | Supabase client instance used by shared caches and Screener bookmarks |

`fetchPrices.js` exists in the utils folder but is not referenced by any Analysis component — used elsewhere in the app (Investments tab), not part of Analysis's data flow.

---

## 14. Reimplementation checklist / gotchas worth preserving

1. **Mid-year discounting convention** in DCF (`t - 0.5` exponent for years 1-5, but terminal value discounted at a full `t=5`, not `4.5`) — an easy detail to get wrong.
2. **TTM vs 3yr-average FCF selection logic** in DCF depends on comparing ISO date strings (`latestQuarterDate > latestAnnualDate`), and requires **all 4** trailing quarters to have non-null `freeCF` or it silently falls back to annual average.
3. **Random weight generation** for Monte Carlo uses `-ln(U)` normalized (Exponential→Dirichlet trick), not `Math.random()` directly — affects the simulated frontier shape.
4. **Frontier extraction** buckets into 150 vol-bins and keeps only strictly-increasing-return points — a naive "just plot all 10,000 points" will look very different (a full bullet, not a frontier line).
5. Backward-elimination optimizer **stops as soon as removing the worst symbol fails to improve Sharpe** — it does not exhaustively search all subsets.
6. Alpha Vantage endpoints must be called with **1.1s pauses between each of the 3 calls** per financials fetch, and the shared Supabase cache should always be checked first to conserve the 25/day quota.
7. Correlation/vol/return parameters are **stateful module-level singletons** (`_realCorr`, `_computedParams`) mutated by `setRealCorrelations`/`setComputedParams` from multiple call sites (Dashboard-level effect, Research's Portfolio Context effect, Optimizer's own effect) — any reimplementation should replicate this "prime once, reuse everywhere" cache-merge behavior rather than treating it as pure per-call state, or the whole app will refetch weekly Yahoo data redundantly.
8. Cash is treated as a zero-vol (0.1% stub, not truly 0 to avoid div/0), zero-correlation, user-rate-configurable asset injected into every simulation family.
9. `KNOWN_ETFS` short-circuits fundamentals/financials fetches entirely for ~50 known ETF/index tickers — these render a static informational card instead of attempting (and failing) a financial-statement fetch.
</content>
</invoke>
