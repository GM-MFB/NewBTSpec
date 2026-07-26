# Analyze Tab — Phase 5: Frontier, Optimizer, Risk — Design

## Context

Continuing the phased Analyze build. Research, Financials (core + charts), and
DCF are done. This phase builds the shared Modern-Portfolio-Theory engine
(`analysis-tab-spec.md` §7) and the three tabs it powers — **Frontier**,
**Optimizer**, **Risk** — plus closes out the Research "Portfolio Context"
deferral from Phase 3 (§5) now that the engine exists.

This is the largest phase so far. It bundles new infrastructure (a serverless
proxy — nothing in this repo has needed one before), a substantial pure-math
engine, and three UI tabs. Each piece below is independently testable and
will map to its own set of implementation-plan tasks and commits, executed in
the order presented (infra → engine → Frontier → Optimizer → Risk → Portfolio
Context).

## Decisions

- **Real correlation data**: build the Yahoo Finance proxy now (not deferred
  further) — real weekly-return correlations, not just the static
  category-correlation fallback.
- **Proxy platform**: Netlify Functions. Local dev switches from `npm run dev`
  (plain Vite) to `netlify dev` (Netlify CLI, which runs Vite underneath via
  `netlify.toml`'s `[dev]` block and also serves `netlify/functions/*`
  locally) — this becomes the new standing dev-server command for the rest of
  the project, not just this phase.
- **Phase scope**: the full engine plus all three tabs (Frontier, Optimizer,
  Risk) in one phase, rather than splitting the engine out and doing the tabs
  as separate later phases.
- **Portfolio Context**: included in this phase (correlation heatmap +
  combined-mode Frontier panel inside Research's Single view).
- **Numeric placeholders**: `analysis-tab-spec.md` describes the *shape* of
  `ASSET_PARAMS` (~18 tickers, `{r, s, cat}`) and `CAT_CORR` (category×category
  correlation table) but never captured the original app's literal numeric
  values. This spec fills in reasonable, clearly-labeled placeholder numbers
  (below). They only matter as a cold-start fallback — the moment a symbol's
  real weekly-return data loads via the proxy, `setComputedParams`/
  `setRealCorrelations` override them.

## A) Infrastructure — Yahoo proxy + `netlify dev`

**Files:**
- Create: `netlify/functions/yahoo-proxy.js`
- Create: `netlify.toml`
- Modify: `package.json` (add `netlify-cli` devDependency, change `dev` script)

**`netlify/functions/yahoo-proxy.js`** — a thin passthrough, no business logic:
```js
export default async (request) => {
  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol')
  const interval = url.searchParams.get('interval') ?? '1wk'
  const range = url.searchParams.get('range') ?? '2y'
  if (!symbol) return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 })

  const upstream = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`
  const res = await fetch(upstream, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const body = await res.text()
  return new Response(body, { status: res.status, headers: { 'Content-Type': 'application/json' } })
}

export const config = { path: '/yahoo-proxy' }
```
(Netlify's newer function format — a default-exported handler plus a `config`
export for the route path — avoids needing a separate `_redirects` entry.)

**`netlify.toml`**:
```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[dev]
  command = "npm run dev:vite"
  targetPort = 5173
  port = 8888

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**`package.json` scripts**: rename the existing `"dev": "vite"` to
`"dev:vite": "vite"`, and add `"dev": "netlify dev"`. `netlify-cli` is added
as a devDependency. The end result: `npm run dev` now starts `netlify dev`,
which proxies to Vite on 5173 and serves functions on the same `8888` origin,
so `fetch('/yahoo-proxy?...')` from the browser works identically in local
dev and in production.

**Manual verification for this task**: after `npm install` and `npm run dev`,
`curl "http://localhost:8888/yahoo-proxy?symbol=AAPL&interval=1wk&range=2y"`
should return Yahoo's chart JSON (or a clear upstream error), not a 404.

## B) `src/lib/fetchCorrelations.js` — real market data bridge

**Interfaces:**
```js
fetchCorrelations(symbols: string[]) -> Promise<{
  corrMap: { [sym1]: { [sym2]: number } },
  paramsMap: { [sym]: { r: number, s: number } },
}>
```

- `CRYPTO_SKIP = new Set(['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC','SHIB','LTC'])`
  — these symbols are skipped entirely (no fetch), so they never appear in
  the returned `corrMap`/`paramsMap` and callers fall back to
  `ASSET_PARAMS`/`CAT_CORR` for them.
- For each remaining symbol: check `localStorage['bt_returns_cache_v2']`
  (shape `{ [sym]: { returns: number[], _ts: number } }`) for an entry younger
  than 24h; if stale or missing, `fetch(`/yahoo-proxy?symbol=${sym}&interval=1wk&range=2y`)`,
  extract `chart.result[0].indicators.quote[0].close` (filtering `null`s),
  compute weekly simple returns (`(close[i]/close[i-1]) - 1`), and write the
  refreshed entry back to the cache.
- `computeAssetParams(returns)`: `annualVol = stddev(returns) * Math.sqrt(52)`,
  `annualReturn = mean(returns) * 52`. Exported for unit testing in isolation.
- `pearson(a, b)`: standard Pearson correlation coefficient on the overlapping
  **tail** of both arrays (`Math.min(a.length, b.length)` most recent points);
  returns `null` if the overlap is under 8 points.
- Symbols whose fetch fails (network error, malformed response) are silently
  omitted from both maps — the caller's fallback chain (`getAssetParams`/
  `getCorrelation`) absorbs the gap, no thrown error surfaces to the UI.
- Builds `corrMap` as all pairwise combinations among the successfully-fetched
  symbols (symmetric: `corrMap[a][b] === corrMap[b][a]`).

## C) `src/lib/efficientFrontier.js` — the MPT engine

Pure functions plus a small amount of deliberate module-level state (matching
the original app's singleton pattern for `_realCorr`/`_computedParams`, which
callers mutate via setters and consumers read via getters — this lets
`fetchCorrelations` results propagate to every simulation without threading
them through every function call).

**Static tables:**
```js
const RISK_FREE = 0.045
const SPY_VOL = 0.17

// Placeholder values — see "Numeric placeholders" above. Overridden by
// real computed params for any symbol with fetched correlation data.
const ASSET_PARAMS = {
  AAPL: { r: 0.15, s: 0.27, cat: 'tech' },
  NVDA: { r: 0.28, s: 0.45, cat: 'tech' },
  MSFT: { r: 0.14, s: 0.24, cat: 'tech' },
  META: { r: 0.18, s: 0.38, cat: 'tech' },
  AMZN: { r: 0.16, s: 0.32, cat: 'tech' },
  GOOGL: { r: 0.14, s: 0.28, cat: 'tech' },
  AMD: { r: 0.22, s: 0.42, cat: 'tech' },
  TSLA: { r: 0.20, s: 0.55, cat: 'tech' },
  SMH: { r: 0.20, s: 0.35, cat: 'etf_eq' },
  SPY: { r: 0.10, s: 0.16, cat: 'etf_eq' },
  QQQ: { r: 0.13, s: 0.20, cat: 'etf_eq' },
  TLT: { r: 0.03, s: 0.12, cat: 'bond' },
  GLD: { r: 0.06, s: 0.14, cat: 'gold' },
  XOM: { r: 0.09, s: 0.25, cat: 'energy' },
  BTC: { r: 0.35, s: 0.60, cat: 'crypto' },
  ETH: { r: 0.35, s: 0.70, cat: 'crypto' },
  JPM: { r: 0.11, s: 0.22, cat: 'financial' },
  SOFI: { r: 0.18, s: 0.50, cat: 'financial' },
}
const DEFAULT_PARAMS = { r: 0.12, s: 0.28, cat: 'other' }

const CAT_CORR = {
  // symmetric; only one direction listed per pair, lookup checks both orders
  tech:      { tech: 0.65, etf_eq: 0.70, bond: -0.10, gold: 0.00, crypto: 0.25, energy: 0.20, financial: 0.35, other: 0.40, cash: 0 },
  etf_eq:    { etf_eq: 0.85, bond: -0.15, gold: 0.05, crypto: 0.20, energy: 0.30, financial: 0.45, other: 0.45, cash: 0 },
  bond:      { bond: 0.70, gold: 0.10, crypto: -0.05, energy: -0.10, financial: -0.05, other: -0.05, cash: 0 },
  gold:      { gold: 1.0, crypto: 0.10, energy: 0.15, financial: 0.00, other: 0.05, cash: 0 },
  crypto:    { crypto: 0.60, energy: 0.05, financial: 0.10, other: 0.15, cash: 0 },
  energy:    { energy: 0.55, financial: 0.20, other: 0.25, cash: 0 },
  financial: { financial: 0.60, other: 0.35, cash: 0 },
  other:     { other: 0.50, cash: 0 },
  cash:      { cash: 0 },
}
const UNKNOWN_PAIR_CORR = 0.50
```

**Module state + setters:**
```js
let _realCorr = {}       // { sym1: { sym2: number } }
let _computedParams = {} // { sym: { r, s } }
let corrVersion = 0

export function setRealCorrelations(map) { _realCorr = { ..._realCorr, ...map }; corrVersion += 1 }
export function setComputedParams(map) { _computedParams = { ..._computedParams, ...map }; corrVersion += 1 }
export function getCorrVersion() { return corrVersion }
```

**Asset params:**
```js
export function getAssetParams(symbol) {
  const base = ASSET_PARAMS[symbol] ?? { ...DEFAULT_PARAMS }
  const computed = _computedParams[symbol]
  return computed ? { r: computed.r, s: computed.s, cat: base.cat } : base
}
```

**Correlation resolution:**
```js
export function getCorrelation(sym1, sym2) {
  if (sym1 === sym2) return 1
  if (sym1 === 'CASH' || sym2 === 'CASH') return 0
  const real = _realCorr[sym1]?.[sym2] ?? _realCorr[sym2]?.[sym1]
  if (real !== undefined && real !== null) return real
  const cat1 = getAssetParams(sym1).cat
  const cat2 = getAssetParams(sym2).cat
  return CAT_CORR[cat1]?.[cat2] ?? CAT_CORR[cat2]?.[cat1] ?? UNKNOWN_PAIR_CORR
}
```

**Portfolio stats:**
```js
export function portfolioStats(symbols, weights, paramsOverride = {}) {
  const params = symbols.map((s) => paramsOverride[s] ?? getAssetParams(s))
  const ret = weights.reduce((sum, w, i) => sum + w * params[i].r, 0)
  let variance = 0
  for (let i = 0; i < symbols.length; i += 1) {
    for (let j = 0; j < symbols.length; j += 1) {
      variance += weights[i] * weights[j] * params[i].s * params[j].s * getCorrelation(symbols[i], symbols[j])
    }
  }
  const vol = Math.sqrt(Math.max(0, variance))
  const sharpe = vol > 0 ? (ret - RISK_FREE) / vol : 0
  return { ret, vol, sharpe }
}
```

**Random weight generation** (Dirichlet-via-exponential trick, as documented
in the original spec — matters for the simulated frontier's shape):
```js
export function randomWeights(n) {
  const draws = Array.from({ length: n }, () => -Math.log(Math.random()))
  const total = draws.reduce((a, b) => a + b, 0)
  return draws.map((d) => d / total)
}
```

**Monte Carlo simulation:**
```js
export function generateEfficientFrontierData(symbols, { nSim = 10000, cashOptions = null, paramsOverride = {} } = {}) {
  const simSymbols = [...symbols]
  const simParams = { ...paramsOverride }
  if (cashOptions?.amount > 0) {
    simSymbols.push('CASH')
    simParams.CASH = { r: cashOptions.rate ?? 0.03, s: 0.001 }
  }

  const points = []
  let maxSharpe = null
  let maxDiversification = null

  for (let i = 0; i < nSim; i += 1) {
    const weights = randomWeights(simSymbols.length)
    const { ret, vol, sharpe } = portfolioStats(simSymbols, weights, simParams)
    const weightedAvgVol = simSymbols.reduce((sum, s, idx) => sum + weights[idx] * (simParams[s] ?? getAssetParams(s)).s, 0)
    const diversificationRatio = vol > 0 ? weightedAvgVol / vol : 1
    const point = { ret, vol, sharpe, diversificationRatio, weights: [...weights] }
    points.push(point)
    if (!maxSharpe || sharpe > maxSharpe.sharpe) maxSharpe = point
    if (!maxDiversification || diversificationRatio > maxDiversification.diversificationRatio) maxDiversification = point
  }

  return { symbols: simSymbols, points, maxSharpe, maxDiversification, frontier: extractFrontier(points) }
}
```

**Frontier extraction (150 volatility buckets):**
```js
export function extractFrontier(points) {
  if (points.length === 0) return []
  const minVol = Math.min(...points.map((p) => p.vol))
  const maxVol = Math.max(...points.map((p) => p.vol))
  const bucketWidth = (maxVol - minVol) / 150 || 1

  const buckets = new Array(150).fill(null)
  for (const p of points) {
    const idx = Math.min(149, Math.floor((p.vol - minVol) / bucketWidth))
    if (!buckets[idx] || p.ret > buckets[idx].ret) buckets[idx] = p
  }

  const frontier = []
  let runningMax = -Infinity
  for (const bucket of buckets) {
    if (bucket && bucket.ret > runningMax) {
      frontier.push(bucket)
      runningMax = bucket.ret
    }
  }
  return frontier
}
```

**Combined mode** (portfolio + researched-but-unowned symbols):
```js
export function generateCombinedFrontierData(portfolioSymbols, portfolioWeights, extraSymbols, options = {}) {
  const newSymbols = extraSymbols.filter((s) => !portfolioSymbols.includes(s))
  const allSymbols = [...portfolioSymbols, ...newSymbols]
  const currentWeights = [...portfolioWeights, ...newSymbols.map(() => 0)]
  const simData = generateEfficientFrontierData(allSymbols, options)
  const current = portfolioStats(allSymbols, currentWeights)
  return { ...simData, current: { ...current, weights: currentWeights } }
}
```

**Subset optimizer (backward elimination):**
```js
export function getMaxSharpeForSubset(symbols, nSim, options = {}) {
  const { maxSharpe } = generateEfficientFrontierData(symbols, { ...options, nSim })
  return maxSharpe
}

export function runBackwardElimination(symbols, nSim, options = {}) {
  let current = [...symbols]
  let currentBest = getMaxSharpeForSubset(current, nSim, options)
  const steps = [{ symbols: [...current], sharpe: currentBest.sharpe, ret: currentBest.ret, vol: currentBest.vol, weights: currentBest.weights }]
  const dropped = []

  while (current.length > 2) {
    let bestAfterRemoval = null
    let bestRemovedSymbol = null
    for (const symbol of current) {
      const subset = current.filter((s) => s !== symbol)
      const candidate = getMaxSharpeForSubset(subset, Math.round(nSim * 0.6), options)
      if (!bestAfterRemoval || candidate.sharpe > bestAfterRemoval.sharpe) {
        bestAfterRemoval = candidate
        bestRemovedSymbol = symbol
      }
    }
    if (!bestAfterRemoval || bestAfterRemoval.sharpe <= currentBest.sharpe) break
    current = current.filter((s) => s !== bestRemovedSymbol)
    dropped.push(bestRemovedSymbol)
    currentBest = getMaxSharpeForSubset(current, nSim, options)
    steps.push({ symbols: [...current], sharpe: currentBest.sharpe, ret: currentBest.ret, vol: currentBest.vol, weights: currentBest.weights })
  }

  const full = steps[0]
  const optimal = steps[steps.length - 1]
  return {
    steps, fullSharpe: full.sharpe, fullSymbols: full.symbols,
    optimalSymbols: optimal.symbols, optimalSharpe: optimal.sharpe, optimalRet: optimal.ret,
    optimalVol: optimal.vol, optimalWeights: optimal.weights,
    improved: optimal.sharpe > full.sharpe, dropped,
  }
}

export function findOptimalSubset(portfolioSymbols, nSim, options = {}) {
  return runBackwardElimination(portfolioSymbols, nSim, options)
}
export function findOptimalSubsetForSymbols(symbols, nSim, options = {}) {
  return runBackwardElimination(symbols, nSim, options)
}
```

**Correlation matrix helpers:**
```js
export function getCorrelationMatrix(symbols) {
  return symbols.map((a) => symbols.map((b) => getCorrelation(a, b)))
}
export function getCorrelationMatrixForSymbols(symbols) {
  return getCorrelationMatrix(symbols)
}
```

**Portfolio risk metrics:**
```js
export function getPortfolioRiskMetrics(positions) {
  // positions: [{ symbol, weight, marketValue, currentPrice, stopLoss, shares }]
  const hhi = positions.reduce((sum, p) => sum + p.weight ** 2, 0)
  const diversificationScore = Math.round((1 - hhi) * 100)

  const withStop = positions.filter((p) => p.stopLoss)
  const stopCoveragePct = positions.length > 0 ? (withStop.length / positions.length) * 100 : 0
  const dollarAtRisk = positions.reduce((sum, p) => {
    if (!p.stopLoss || p.stopLoss >= p.currentPrice) return sum
    return sum + Math.max(0, p.currentPrice - p.stopLoss) * p.shares
  }, 0)

  const totalMV = positions.reduce((sum, p) => sum + p.marketValue, 0)
  const symbols = positions.map((p) => p.symbol)
  const weights = positions.map((p) => p.weight)
  const { ret, vol } = portfolioStats(symbols, weights)

  const beta = positions.reduce((sum, p) => {
    const params = getAssetParams(p.symbol)
    const symBeta = (params.s * getCorrelation(p.symbol, 'SPY')) / SPY_VOL
    return sum + p.weight * symBeta
  }, 0)

  const dailyVol = vol / Math.sqrt(252)
  const var95 = totalMV * dailyVol * 1.645

  return { hhi, diversificationScore, stopCoveragePct, dollarAtRisk, totalMV, expectedReturn: ret, volatility: vol, beta, var95 }
}
```

**Risk contribution:**
```js
export function getRiskContribution(positions) {
  const symbols = positions.map((p) => p.symbol)
  const weights = positions.map((p) => p.weight)
  const { vol: portfolioVol } = portfolioStats(symbols, weights)

  return positions.map((p, i) => {
    const params = getAssetParams(p.symbol)
    const covarSum = symbols.reduce((sum, s2, j) => {
      const params2 = getAssetParams(s2)
      return sum + weights[j] * params.s * params2.s * getCorrelation(p.symbol, s2)
    }, 0)
    const mcr = portfolioVol > 0 ? (weights[i] * covarSum) / portfolioVol : 0
    const riskPct = portfolioVol > 0 ? (mcr / portfolioVol) * 100 : 0
    const weightPct = weights[i] * 100
    let flag = null
    if (riskPct > weightPct + 5) flag = 'outsized'
    else if (riskPct < weightPct - 5) flag = 'efficient'
    return { symbol: p.symbol, weightPct, riskPct, flag }
  })
}
```

**Stress tests:**
```js
const STRESS_SCENARIOS = [
  { name: 'Bull Run', move: 0.20 },
  { name: 'Mild Pullback', move: -0.05 },
  { name: 'Correction', move: -0.10 },
  { name: 'Bear Market', move: -0.20 },
  { name: 'Crash', move: -0.30 },
  { name: '2008-Level', move: -0.50 },
]

export function getStressTests(positions) {
  return STRESS_SCENARIOS.map((scenario) => {
    const perPosition = positions.map((p) => {
      const params = getAssetParams(p.symbol)
      const beta = (params.s * getCorrelation(p.symbol, 'SPY')) / SPY_VOL
      const move = beta * scenario.move
      const impact = move * p.marketValue
      return { symbol: p.symbol, beta, move, impact }
    })
    const totalMV = positions.reduce((sum, p) => sum + p.marketValue, 0)
    const weightedBeta = positions.reduce((sum, p, i) => sum + (p.marketValue / totalMV) * perPosition[i].beta, 0)
    const portfolioMove = weightedBeta * scenario.move
    return { name: scenario.name, marketMove: scenario.move, portfolioMove, perPosition: perPosition.sort((a, b) => a.impact - b.impact) }
  })
}
```

## D) Frontier tab

**Files:**
- Create: `src/components/analysis/FrontierPanel.jsx` (shared — also used by
  Portfolio Context in combined mode)
- Create: `src/components/analysis/FrontierTab.jsx` (thin wrapper)
- Create matching `.css` files and `.test.jsx` files for both

**`FrontierTab.jsx`**: requires ≥2 open stock/ETF/crypto positions (reuses
`investments` the same way other tabs do); shows a "need at least 2 positions"
empty state otherwise. On mount, calls `fetchCorrelations` for the portfolio
symbols and feeds the result into `setRealCorrelations`/`setComputedParams`.
Renders `<FrontierPanel symbols={...} weights={...} storageKey="bt_ef_params" cash={...} />`
using real portfolio weights (`marketValue / totalMV` per position).

**`FrontierPanel.jsx`** (the reusable piece):
- Props: `symbols`, `weights`, `storageKey`, `cash`, `mode` (`'portfolio'` |
  `'combined'`, default `'portfolio'`), `extraSymbols` (combined-mode only —
  researched symbols not currently held), `priceMap` (`{ [symbol]: number }`,
  optional — falls back to each symbol's `investments.currentPrice` when
  omitted; required for any symbol in `extraSymbols` since those have no
  matching `investments` row to source a price from).
- Persists per-symbol return/vol overrides to `localStorage[storageKey]`
  (`{SYM:{r,s}}`) and a cash-rate override to
  `localStorage['${storageKey}_cash_rate']`.
- Calls `generateEfficientFrontierData` (or `generateCombinedFrontierData` in
  combined mode, selected via a `mode` prop) with the current override map
  merged into `paramsOverride`.
- Renders a `recharts` `ScatterChart`/`LineChart` combo: X = volatility %, Y =
  return %, a line for the extracted frontier curve, plus 3 labeled reference
  points — **Your Portfolio**, **Max Diversification**, **Max Sharpe** (dataviz
  skill invoked before writing this: single shared axis pair, a legend since
  there are 4 series/points, explicit `itemStyle`/`labelStyle` on the tooltip
  per the bug already fixed once in Financials charts).
- Hover tooltip on any frontier point shows that point's full weight
  allocation and, per symbol, a suggested buy/sell delta:
  `targetWeight% × totalMV / price − currentShares`.
- "Adjust Expected Returns & Volatility" expandable section: per-symbol
  sliders (return 0–200% mapped to display 0–100%, volatility 1–300%), each
  showing that asset's standalone "Implied Sharpe" (`(r - RISK_FREE) / s`) and
  whether the value is default (from `getAssetParams`) or manually overridden;
  symbols passed in via `extraSymbols` (Portfolio Context's researched-but-
  unowned case) are labeled "new".
- "Rebalancing Plan" table: one row per symbol — Current % / Current Shares /
  Max-Diversification % + Action / Max-Sharpe % + Action, where Action is
  `buy N` / `sell N` shares (or a `$` delta for `CASH`), computed the same way
  as the tooltip.
- Cash position card (rendered only if a `cash` prop > 0 is passed): editable
  annual return-rate input feeding into the simulation as the near-risk-free
  asset.

## E) Optimizer tab

**Files:**
- Create: `src/components/analysis/OptimizerTab.jsx`, `.css`, `.test.jsx`

- Two modes: `'portfolio'` (real open investments) or `'custom'` (a symbol
  list, supported for a future "Send to Optimizer" entry point from Research's
  Sector Browser — out of scope to wire that button this phase, but the prop
  shape supports it: `incomingSymbols` prop, defaults to `null`).
- Simulation-count selector: Fast (3,000) / Standard (6,000) / High (15,000) /
  Max (40,000) — passed as `nSim` into `findOptimalSubset`/
  `findOptimalSubsetForSymbols`.
- "Assumptions" table: per-symbol expected-return %, volatility %, and current
  price, each independently overridable; a "Fetch" button hits Finnhub
  `/quote` one-by-one with a 150ms pace between calls (reusing the existing
  `finnhubKey` from `useUserSettings`), tracking a per-symbol error state if
  a fetch fails.
- "Elimination Trail": one row per step from `runBackwardElimination`'s
  `steps` array — all original symbols shown, dropped ones struck through,
  kept ones highlighted, with that step's Sharpe/return/vol and the % change
  from the previous step; each row expandable to show the full allocation
  with dollar/share targets computed from `(targetWeight - currentWeight)/100 × totalMV / price`
  against either the actual portfolio value (`portfolio` mode) or a manually
  entered "Total to invest" (`custom` mode).
- A badge appears if `getCorrVersion()` has advanced since the last run
  (tracked in local state as `ranWithVersion`), prompting a re-run.

## F) Risk tab

**Files:**
- Create: `src/components/analysis/RiskTab.jsx`, `.css`, `.test.jsx`

All computed from `getPortfolioRiskMetrics`, `getRiskContribution`,
`getCorrelationMatrix`, `getStressTests` against the real open positions.

- **Hero row** (4 tiles): Portfolio Beta (band coloring: >1.5 red, >1.1
  yellow, <0.8 green, else neutral), 1-Day 95% VaR ($), Diversification Score
  /100 (>70 green, >50 yellow, else red), Stop Coverage % (≥80 green, ≥50
  yellow, else red).
- **Concentration Risk panel**: largest single position weight (meter,
  thresholds 30%/20%), HHI (meter, thresholds 0.25/0.15), plus a stat list
  (Total Portfolio $, Cash $, Expected Return %, Volatility %, Sharpe).
- **Stop Loss Protection panel**: positions-with-stop count + meter, `$ at
  risk if all stops hit`, that risk as % of portfolio, VaR, beta; a warning
  banner if coverage < 80%.
- **Stress Tests**: 6 expandable scenario rows (from `getStressTests`) each
  showing portfolio %/$ move; expanding reveals the per-position table (beta,
  estimated move %, $ impact), sorted most-negative-impact first.
- **Risk Contribution**: one dual-bar row per symbol (weight % vs. risk
  contribution %, flagged when risk% exceeds weight%+5), plus a table with
  Weight / Risk Contribution / Beta / Est. Vol / Risk-to-Weight Ratio
  (thresholds >1.3 red, <0.7 green).

## G) Research Portfolio Context

**Files:**
- Create: `src/components/analysis/CorrelationHeatmap.jsx`, `.css`, `.test.jsx`
- Create: `src/components/analysis/PortfolioContext.jsx`, `.css`, `.test.jsx`
- Modify: `src/components/analysis/ResearchTab.jsx`

Rendered inside `ResearchTab`'s Single view, only when there's at least one
open investment **and** at least one researched symbol not already held (or
any researched symbol at all — matches the original's `symbols.length>0 &&
investments.length>0` gate). Collapsible, two internal sub-tabs:

- **Correlation Matrix**: `CorrelationHeatmap` renders a symmetric matrix
  (only the lower triangle drawn) over `[...portfolioSymbols, ...researchedSymbols]`
  via `getCorrelationMatrixForSymbols`. Cell coloring bands: ≥0.7 red, ≥0.4
  orange, ≥0.15 yellow, ≥-0.05 gray, else blue (dataviz skill invoked before
  writing this — it's a diverging-style encoding but on fixed bands rather
  than a continuous scale, so bands are treated as a small fixed status
  palette rather than a computed diverging ramp, each band gets a legend key).
- **Efficient Frontier**: renders `FrontierPanel` in combined mode (portfolio
  symbols + researched symbols not already held), with a `priceMap` built
  from each researched symbol's live Finnhub quote (already fetched by
  `ResearchTab.fetchSymbol`) so rebalancing math can convert weight deltas
  into approximate share counts for symbols not yet owned.

A `useEffect` in `ResearchTab` fetches real correlations for
`[...portfolioSymbols, ...researchedSymbols]` whenever that combined list
changes, feeding `setRealCorrelations`/`setComputedParams` — same singleton
pattern as Frontier/Optimizer/Risk.

## Page wiring

`AnalyzePage.jsx`: import `FrontierTab`, `OptimizerTab`, `RiskTab`; render
each for its respective `tab === '...'` (replacing the three remaining
placeholders). Update `AnalyzePage.test.jsx`'s "Coming soon" test to target
`wheel` instead (next still-unbuilt tab).

## Out of scope (this phase)

- Wiring Sector Browser's "Send to Optimizer" / "Send to Risk" buttons — the
  prop shapes (`incomingSymbols`) support it, but the actual buttons/handlers
  in `SectorBrowser.jsx` are a follow-up.
- The global watchlist / TickerTape module mentioned in §5 — unrelated to
  this phase's scope, not part of any tab being built here.
- Real per-symbol live price refresh inside Frontier/Risk (beyond what
  Optimizer's explicit "Fetch" button does) — prices come from the existing
  `investments.currentPrice` field, not a fresh live quote, except where the
  original spec explicitly calls for on-demand fetching (Optimizer's
  Assumptions table).

## Testing

- `netlify/functions/yahoo-proxy.js`: no unit test (thin passthrough); verified
  manually via `curl` against `netlify dev` per section A.
- `fetchCorrelations.js`: unit tests for `computeAssetParams` (known
  mean/stddev example), `pearson` (a known-correlation pair, the <8-point
  overlap → `null` case), cache-hit vs. cache-miss vs. stale-cache branches
  (mocking `fetch` and `localStorage`), crypto-symbol skip.
- `efficientFrontier.js`: unit tests for `getCorrelation` (all 4 resolution
  branches: identity, CASH, real override, category fallback, unknown-pair
  default), `portfolioStats` (a hand-computed 2-asset example), `randomWeights`
  (sums to 1, all values > 0), `extractFrontier` (a small synthetic point set
  where the monotonic-max property is easy to verify by hand),
  `generateEfficientFrontierData`/`generateCombinedFrontierData` (smoke test:
  correct point count, frontier non-empty, current point present in combined
  mode), `runBackwardElimination` (a synthetic 3-symbol case where removing
  one symbol is known to help and the other known to hurt, verifying it stops
  at the floor of 2 and picks the correct removal order), `getPortfolioRiskMetrics`
  /`getRiskContribution`/`getStressTests` (hand-computed small examples).
- `FrontierPanel.jsx`/`FrontierTab.jsx`: component tests — <2-position empty
  state, chart renders with 3 reference points, override sliders persist to
  localStorage and affect the sensitivity of subsequent renders, rebalancing
  table renders one row per symbol.
- `OptimizerTab.jsx`: mode toggle, simulation-count selector, "Fetch" price
  button paced calls, elimination trail row count matches `steps.length`,
  corrVersion-stale badge appears after `setRealCorrelations` bumps the
  version post-run.
- `RiskTab.jsx`: hero tile band-coloring at each threshold boundary, stress
  test rows expand to show sorted per-position impacts, risk contribution
  flags render for both "outsized" and "efficient" cases.
- `CorrelationHeatmap.jsx`/`PortfolioContext.jsx`: band coloring at each
  threshold, lower-triangle-only rendering, panel gated correctly on the
  `investments.length>0 && symbols.length>0` condition.
- `ResearchTab.jsx`: new test asserting the correlation-fetch `useEffect`
  fires when the combined symbol list changes.
- Manual smoke test: with a real portfolio (≥2 positions) and Finnhub key,
  verify Frontier's chart and rebalancing table look sane, run Optimizer at
  "Fast" and confirm the elimination trail completes, check Risk's hero tiles
  and stress tests against a rough manual sanity check, and confirm Research's
  Portfolio Context panel appears and its heatmap/frontier react to a newly
  researched symbol.
