# Analyze Tab — Phase 5 (Frontier, Optimizer, Risk) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Yahoo-proxy infrastructure, the shared `efficientFrontier.js` MPT engine, and the Frontier/Optimizer/Risk tabs, and close out Research's Portfolio Context deferral — per `docs/superpowers/specs/2026-07-26-analyze-frontier-optimizer-risk-design.md`.

**Architecture:** A Netlify Function proxies Yahoo Finance (no CORS in the browser). `fetchCorrelations.js` turns that into real weekly-return correlations with a 24h cache. `efficientFrontier.js` is a pure calculation engine (Monte Carlo simulation, frontier extraction, backward-elimination optimizer, risk metrics) with module-level singleton state for real correlation/param overrides. Three tabs (Frontier, Optimizer, Risk) and a Research Portfolio Context panel consume that engine.

**Tech Stack:** React 19, Vitest + @testing-library/react, `recharts`, Netlify Functions + Netlify CLI (local dev), Finnhub (existing).

## Global Constraints

- No Supabase schema changes.
- `ASSET_PARAMS`/`CAT_CORR` numeric values are documented placeholders (spec's "Numeric placeholders" section) — implement exactly as given in the spec, do not invent different numbers.
- TDD throughout: failing test → implementation → passing test → commit, per task.
- `npm run dev` becomes `netlify dev` starting with Task 1 — every subsequent task's dev-server verification uses that command, not plain `vite`.

---

### Task 1: Yahoo proxy infrastructure (Netlify Function + `netlify dev`)

**Files:**
- Create: `netlify/functions/yahoo-proxy.js`
- Create: `netlify.toml`
- Modify: `package.json`

**Interfaces:**
- Produces: a running `GET /yahoo-proxy?symbol=X&interval=1wk&range=2y` endpoint, consumed by Task 3 (`fetchCorrelations.js`).

- [ ] **Step 1: Install netlify-cli as a dev dependency**

Run: `npm install --save-dev netlify-cli`

- [ ] **Step 2: Create the proxy function**

`netlify/functions/yahoo-proxy.js`:
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

- [ ] **Step 3: Create `netlify.toml`**

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

- [ ] **Step 4: Update `package.json` scripts**

Rename the existing `"dev": "vite"` to `"dev:vite": "vite"`, and add
`"dev": "netlify dev"`.

- [ ] **Step 5: Verify the proxy responds**

Run: `npm run dev` (this now runs `netlify dev`), wait for it to report ready,
then in another shell: `curl "http://localhost:8888/yahoo-proxy?symbol=AAPL&interval=1wk&range=2y"`
Expected: Yahoo's chart JSON body (a `chart.result` array), not a 404.
Stop the dev server after confirming (`taskkill //F //IM node.exe //T`).

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/yahoo-proxy.js netlify.toml package.json package-lock.json
git commit -m "feat: add Yahoo Finance proxy Netlify Function and switch dev to netlify dev"
```

---

### Task 2: `fetchCorrelations.js` — `computeAssetParams` + `pearson`

**Files:**
- Create: `src/lib/fetchCorrelations.js`
- Create: `src/lib/fetchCorrelations.test.js`

**Interfaces:**
- Produces: `computeAssetParams(returns: number[]) -> { r: number, s: number }`,
  `pearson(a: number[], b: number[]) -> number | null`. Consumed by Task 3
  (orchestration) and by `efficientFrontier.js` tests indirectly (not a direct
  dependency — kept separate per the spec's module boundary).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { computeAssetParams, pearson } from './fetchCorrelations'

describe('computeAssetParams', () => {
  it('annualizes weekly mean and stddev', () => {
    const returns = [0.01, -0.02, 0.015, 0.005, -0.01, 0.02]
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
    const stddev = Math.sqrt(variance)

    const result = computeAssetParams(returns)
    expect(result.r).toBeCloseTo(mean * 52, 6)
    expect(result.s).toBeCloseTo(stddev * Math.sqrt(52), 6)
  })
})

describe('pearson', () => {
  it('returns 1 for perfectly correlated series', () => {
    expect(pearson([1, 2, 3, 4, 5, 6, 7, 8], [2, 4, 6, 8, 10, 12, 14, 16])).toBeCloseTo(1, 5)
  })

  it('returns -1 for perfectly anti-correlated series', () => {
    expect(pearson([1, 2, 3, 4, 5, 6, 7, 8], [8, 7, 6, 5, 4, 3, 2, 1])).toBeCloseTo(-1, 5)
  })

  it('uses the overlapping tail when arrays differ in length', () => {
    const a = [100, 1, 2, 3, 4, 5, 6, 7, 8]
    const b = [2, 4, 6, 8, 10, 12, 14, 16]
    expect(pearson(a, b)).toBeCloseTo(1, 5)
  })

  it('returns null when the overlap is under 8 points', () => {
    expect(pearson([1, 2, 3], [1, 2, 3])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fetchCorrelations`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement in `src/lib/fetchCorrelations.js`**

```js
export function computeAssetParams(returns) {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
  const stddev = Math.sqrt(variance)
  return { r: mean * 52, s: stddev * Math.sqrt(52) }
}

export function pearson(a, b) {
  const n = Math.min(a.length, b.length)
  if (n < 8) return null
  const ta = a.slice(a.length - n)
  const tb = b.slice(b.length - n)

  const meanA = ta.reduce((x, y) => x + y, 0) / n
  const meanB = tb.reduce((x, y) => x + y, 0) / n

  let cov = 0
  let varA = 0
  let varB = 0
  for (let i = 0; i < n; i += 1) {
    const da = ta[i] - meanA
    const db = tb[i] - meanB
    cov += da * db
    varA += da * da
    varB += db * db
  }
  const denom = Math.sqrt(varA * varB)
  return denom === 0 ? null : cov / denom
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- fetchCorrelations`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchCorrelations.js src/lib/fetchCorrelations.test.js
git commit -m "feat: add computeAssetParams and pearson to fetchCorrelations.js"
```

---

### Task 3: `fetchCorrelations.js` — orchestration (`fetchCorrelations`)

**Files:**
- Modify: `src/lib/fetchCorrelations.js`
- Modify: `src/lib/fetchCorrelations.test.js`

**Interfaces:**
- Produces: `fetchCorrelations(symbols: string[]) -> Promise<{ corrMap, paramsMap }>`.
  Consumed by `FrontierTab.jsx`, `OptimizerTab.jsx`, `RiskTab.jsx`, `ResearchTab.jsx` (Tasks 13, 16, 18, 21).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchCorrelations } from './fetchCorrelations'

function mockYahooResponse(closes) {
  return {
    ok: true,
    text: async () => JSON.stringify({ chart: { result: [{ indicators: { quote: [{ close: closes }] } }] } }),
  }
}

describe('fetchCorrelations', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('skips known crypto symbols entirely', async () => {
    global.fetch = vi.fn()
    const { corrMap, paramsMap } = await fetchCorrelations(['BTC', 'ETH'])
    expect(global.fetch).not.toHaveBeenCalled()
    expect(paramsMap).toEqual({})
    expect(corrMap).toEqual({})
  })

  it('fetches and computes params/correlations for non-crypto symbols', async () => {
    const closesA = Array.from({ length: 20 }, (_, i) => 100 + i)
    const closesB = Array.from({ length: 20 }, (_, i) => 200 + i * 2)
    global.fetch = vi.fn((url) => {
      if (url.includes('AAPL')) return Promise.resolve(mockYahooResponse(closesA))
      return Promise.resolve(mockYahooResponse(closesB))
    })

    const { corrMap, paramsMap } = await fetchCorrelations(['AAPL', 'MSFT'])

    expect(paramsMap.AAPL).toBeDefined()
    expect(paramsMap.MSFT).toBeDefined()
    expect(corrMap.AAPL.MSFT).toBeCloseTo(1, 3)
    expect(corrMap.MSFT.AAPL).toBeCloseTo(1, 3)
  })

  it('uses the localStorage cache instead of fetching when fresh', async () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    localStorage.setItem('bt_returns_cache_v2', JSON.stringify({
      AAPL: { returns: closes.slice(1).map((c, i) => c / closes[i] - 1), _ts: Date.now() },
    }))
    global.fetch = vi.fn()

    await fetchCorrelations(['AAPL'])

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('refetches when the cache entry is older than 24h', async () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    localStorage.setItem('bt_returns_cache_v2', JSON.stringify({
      AAPL: { returns: [0.01], _ts: Date.now() - 25 * 60 * 60 * 1000 },
    }))
    global.fetch = vi.fn(() => Promise.resolve(mockYahooResponse(closes)))

    await fetchCorrelations(['AAPL'])

    expect(global.fetch).toHaveBeenCalled()
  })

  it('omits a symbol whose fetch fails, without throwing', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('network error')))

    const { corrMap, paramsMap } = await fetchCorrelations(['AAPL'])

    expect(paramsMap.AAPL).toBeUndefined()
    expect(corrMap.AAPL).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fetchCorrelations`
Expected: FAIL — `fetchCorrelations` not exported.

- [ ] **Step 3: Implement in `src/lib/fetchCorrelations.js`**

```js
const CRYPTO_SKIP = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'SHIB', 'LTC'])
const CACHE_KEY = 'bt_returns_cache_v2'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function weeklyReturns(closes) {
  const present = closes.filter((c) => c !== null && c !== undefined)
  const returns = []
  for (let i = 1; i < present.length; i += 1) {
    returns.push(present[i] / present[i - 1] - 1)
  }
  return returns
}

async function getReturnsForSymbol(symbol) {
  const cacheRaw = localStorage.getItem(CACHE_KEY)
  const cache = cacheRaw ? JSON.parse(cacheRaw) : {}
  const entry = cache[symbol]
  if (entry && Date.now() - entry._ts < CACHE_TTL_MS) {
    return entry.returns
  }

  const res = await fetch(`/yahoo-proxy?symbol=${symbol}&interval=1wk&range=2y`)
  const body = JSON.parse(await res.text())
  const closes = body.chart.result[0].indicators.quote[0].close
  const returns = weeklyReturns(closes)

  cache[symbol] = { returns, _ts: Date.now() }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  return returns
}

export async function fetchCorrelations(symbols) {
  const eligible = symbols.filter((s) => !CRYPTO_SKIP.has(s))
  const returnsMap = {}

  for (const symbol of eligible) {
    try {
      returnsMap[symbol] = await getReturnsForSymbol(symbol)
    } catch {
      // omitted from the maps below; caller's static fallback absorbs the gap
    }
  }

  const fetched = Object.keys(returnsMap)
  const paramsMap = {}
  for (const symbol of fetched) {
    paramsMap[symbol] = computeAssetParams(returnsMap[symbol])
  }

  const corrMap = {}
  for (const a of fetched) {
    corrMap[a] = {}
    for (const b of fetched) {
      if (a === b) continue
      const corr = pearson(returnsMap[a], returnsMap[b])
      if (corr !== null) corrMap[a][b] = corr
    }
  }

  return { corrMap, paramsMap }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- fetchCorrelations`
Expected: PASS (10 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchCorrelations.js src/lib/fetchCorrelations.test.js
git commit -m "feat: add fetchCorrelations orchestration with 24h cache and crypto skip"
```

---

### Task 4: `efficientFrontier.js` — static tables, `getAssetParams`, `getCorrelation`

**Files:**
- Create: `src/lib/efficientFrontier.js`
- Create: `src/lib/efficientFrontier.test.js`

**Interfaces:**
- Produces: `setRealCorrelations(map)`, `setComputedParams(map)`, `getCorrVersion()`,
  `getAssetParams(symbol) -> { r, s, cat }`, `getCorrelation(sym1, sym2) -> number`.
  Consumed by every later task in this plan.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { getAssetParams, getCorrelation, setRealCorrelations, setComputedParams, getCorrVersion } from './efficientFrontier'

describe('getAssetParams', () => {
  it('returns the static table entry for a known ticker', () => {
    const params = getAssetParams('AAPL')
    expect(params.r).toBe(0.15)
    expect(params.s).toBe(0.27)
    expect(params.cat).toBe('tech')
  })

  it('returns the default for an unknown ticker', () => {
    const params = getAssetParams('ZZZZ')
    expect(params).toEqual({ r: 0.12, s: 0.28, cat: 'other' })
  })

  it('overrides r/s with computed params while keeping the static category', () => {
    setComputedParams({ AAPL: { r: 0.20, s: 0.30 } })
    const params = getAssetParams('AAPL')
    expect(params.r).toBe(0.20)
    expect(params.s).toBe(0.30)
    expect(params.cat).toBe('tech')
  })
})

describe('getCorrelation', () => {
  it('returns 1 for identical symbols', () => {
    expect(getCorrelation('AAPL', 'AAPL')).toBe(1)
  })

  it('returns 0 when either symbol is CASH', () => {
    expect(getCorrelation('AAPL', 'CASH')).toBe(0)
    expect(getCorrelation('CASH', 'AAPL')).toBe(0)
  })

  it('prefers a real correlation override when present', () => {
    setRealCorrelations({ AAPL: { MSFT: 0.99 } })
    expect(getCorrelation('AAPL', 'MSFT')).toBe(0.99)
    expect(getCorrelation('MSFT', 'AAPL')).toBe(0.99)
  })

  it('falls back to the category table when no real correlation exists', () => {
    expect(getCorrelation('AAPL', 'MSFT_UNSET')).toBe(0.65)
  })

  it('defaults to 0.50 for an unknown category pair', () => {
    expect(getCorrelation('ZZZZ1', 'ZZZZ2')).toBe(0.50)
  })

  it('bumps corrVersion when setRealCorrelations or setComputedParams is called', () => {
    const before = getCorrVersion()
    setRealCorrelations({ AAPL: { QQQ: 0.5 } })
    expect(getCorrVersion()).toBe(before + 1)
    setComputedParams({ AAPL: { r: 0.1, s: 0.2 } })
    expect(getCorrVersion()).toBe(before + 2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- efficientFrontier`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement in `src/lib/efficientFrontier.js`**

```js
export const RISK_FREE = 0.045
export const SPY_VOL = 0.17

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
  tech: { tech: 0.65, etf_eq: 0.70, bond: -0.10, gold: 0.00, crypto: 0.25, energy: 0.20, financial: 0.35, other: 0.40, cash: 0 },
  etf_eq: { etf_eq: 0.85, bond: -0.15, gold: 0.05, crypto: 0.20, energy: 0.30, financial: 0.45, other: 0.45, cash: 0 },
  bond: { bond: 0.70, gold: 0.10, crypto: -0.05, energy: -0.10, financial: -0.05, other: -0.05, cash: 0 },
  gold: { gold: 1.0, crypto: 0.10, energy: 0.15, financial: 0.00, other: 0.05, cash: 0 },
  crypto: { crypto: 0.60, energy: 0.05, financial: 0.10, other: 0.15, cash: 0 },
  energy: { energy: 0.55, financial: 0.20, other: 0.25, cash: 0 },
  financial: { financial: 0.60, other: 0.35, cash: 0 },
  other: { other: 0.50, cash: 0 },
  cash: { cash: 0 },
}
const UNKNOWN_PAIR_CORR = 0.50

let _realCorr = {}
let _computedParams = {}
let corrVersion = 0

export function setRealCorrelations(map) {
  _realCorr = { ..._realCorr, ...map }
  corrVersion += 1
}

export function setComputedParams(map) {
  _computedParams = { ..._computedParams, ...map }
  corrVersion += 1
}

export function getCorrVersion() {
  return corrVersion
}

export function getAssetParams(symbol) {
  const base = ASSET_PARAMS[symbol] ?? { ...DEFAULT_PARAMS }
  const computed = _computedParams[symbol]
  return computed ? { r: computed.r, s: computed.s, cat: base.cat } : base
}

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- efficientFrontier`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/efficientFrontier.js src/lib/efficientFrontier.test.js
git commit -m "feat: add asset params and correlation resolution to efficientFrontier.js"
```

---

### Task 5: `efficientFrontier.js` — `portfolioStats`, `randomWeights`

**Files:**
- Modify: `src/lib/efficientFrontier.js`
- Modify: `src/lib/efficientFrontier.test.js`

**Interfaces:**
- Produces: `portfolioStats(symbols, weights, paramsOverride?) -> { ret, vol, sharpe }`,
  `randomWeights(n) -> number[]`. Consumed by Tasks 6–12.

- [ ] **Step 1: Write the failing test**

```js
import { portfolioStats, randomWeights } from './efficientFrontier'

describe('portfolioStats', () => {
  it('computes return/vol/sharpe for a hand-computed 2-asset example', () => {
    setComputedParams({
      ASSET_A: { r: 0.10, s: 0.20 },
      ASSET_B: { r: 0.20, s: 0.30 },
    })
    setRealCorrelations({ ASSET_A: { ASSET_B: 0.5 } })

    const { ret, vol, sharpe } = portfolioStats(['ASSET_A', 'ASSET_B'], [0.5, 0.5])

    const expectedRet = 0.5 * 0.10 + 0.5 * 0.20
    const variance = (0.5 ** 2) * (0.20 ** 2) + (0.5 ** 2) * (0.30 ** 2) + 2 * 0.5 * 0.5 * 0.20 * 0.30 * 0.5
    const expectedVol = Math.sqrt(variance)

    expect(ret).toBeCloseTo(expectedRet, 6)
    expect(vol).toBeCloseTo(expectedVol, 6)
    expect(sharpe).toBeCloseTo((expectedRet - 0.045) / expectedVol, 6)
  })
})

describe('randomWeights', () => {
  it('sums to 1 and all values are positive', () => {
    const weights = randomWeights(5)
    expect(weights).toHaveLength(5)
    expect(weights.every((w) => w > 0)).toBe(true)
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- efficientFrontier`
Expected: FAIL — `portfolioStats`/`randomWeights` not exported.

- [ ] **Step 3: Implement in `src/lib/efficientFrontier.js`**

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

export function randomWeights(n) {
  const draws = Array.from({ length: n }, () => -Math.log(Math.random()))
  const total = draws.reduce((a, b) => a + b, 0)
  return draws.map((d) => d / total)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- efficientFrontier`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/efficientFrontier.js src/lib/efficientFrontier.test.js
git commit -m "feat: add portfolioStats and randomWeights to efficientFrontier.js"
```

---

### Task 6: `efficientFrontier.js` — Monte Carlo simulation + frontier extraction

**Files:**
- Modify: `src/lib/efficientFrontier.js`
- Modify: `src/lib/efficientFrontier.test.js`

**Interfaces:**
- Produces: `generateEfficientFrontierData(symbols, options?) -> { symbols, points, maxSharpe, maxDiversification, frontier }`,
  `extractFrontier(points) -> Array<point>`. Consumed by Task 7 (combined mode),
  Task 8 (subset optimizer), Task 13 (`FrontierPanel`).

- [ ] **Step 1: Write the failing test**

```js
import { generateEfficientFrontierData, extractFrontier } from './efficientFrontier'

describe('extractFrontier', () => {
  it('keeps only monotonically-increasing-return points across vol buckets', () => {
    const points = [
      { ret: 0.05, vol: 0.10 },
      { ret: 0.08, vol: 0.15 },
      { ret: 0.06, vol: 0.20 }, // dominated — lower return than a lower-vol point
      { ret: 0.12, vol: 0.25 },
    ]
    const frontier = extractFrontier(points)
    const returns = frontier.map((p) => p.ret)
    expect(returns).toEqual([...returns].sort((a, b) => a - b))
    expect(frontier.some((p) => p.ret === 0.06)).toBe(false)
  })

  it('returns an empty array for no points', () => {
    expect(extractFrontier([])).toEqual([])
  })
})

describe('generateEfficientFrontierData', () => {
  it('runs the requested number of simulations and returns a non-empty frontier', () => {
    const result = generateEfficientFrontierData(['AAPL', 'SPY', 'TLT'], { nSim: 500 })
    expect(result.points).toHaveLength(500)
    expect(result.frontier.length).toBeGreaterThan(0)
    expect(result.maxSharpe).toBeDefined()
    expect(result.maxDiversification).toBeDefined()
  })

  it('adds CASH as a near-risk-free asset when cashOptions.amount > 0', () => {
    const result = generateEfficientFrontierData(['AAPL', 'SPY'], { nSim: 200, cashOptions: { amount: 1000, rate: 0.03 } })
    expect(result.symbols).toContain('CASH')
    expect(result.points[0].weights).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- efficientFrontier`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement in `src/lib/efficientFrontier.js`**

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- efficientFrontier`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/efficientFrontier.js src/lib/efficientFrontier.test.js
git commit -m "feat: add Monte Carlo simulation and frontier extraction to efficientFrontier.js"
```

---

### Task 7: `efficientFrontier.js` — combined mode

**Files:**
- Modify: `src/lib/efficientFrontier.js`
- Modify: `src/lib/efficientFrontier.test.js`

**Interfaces:**
- Produces: `generateCombinedFrontierData(portfolioSymbols, portfolioWeights, extraSymbols, options?) -> { ...simData, current }`.
  Consumed by Task 13 (`FrontierPanel` combined mode, Portfolio Context).

- [ ] **Step 1: Write the failing test**

```js
import { generateCombinedFrontierData } from './efficientFrontier'

describe('generateCombinedFrontierData', () => {
  it('unions portfolio and new symbols, with 0 weight for new ones in the current point', () => {
    const result = generateCombinedFrontierData(['AAPL', 'SPY'], [0.6, 0.4], ['TLT'], { nSim: 200 })
    expect(result.symbols).toEqual(['AAPL', 'SPY', 'TLT'])
    expect(result.current.weights).toEqual([0.6, 0.4, 0])
  })

  it('excludes an extra symbol already held from the new-symbols union', () => {
    const result = generateCombinedFrontierData(['AAPL', 'SPY'], [0.5, 0.5], ['AAPL'], { nSim: 200 })
    expect(result.symbols).toEqual(['AAPL', 'SPY'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- efficientFrontier`
Expected: FAIL.

- [ ] **Step 3: Implement in `src/lib/efficientFrontier.js`**

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- efficientFrontier`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/efficientFrontier.js src/lib/efficientFrontier.test.js
git commit -m "feat: add generateCombinedFrontierData to efficientFrontier.js"
```

---

### Task 8: `efficientFrontier.js` — backward-elimination subset optimizer

**Files:**
- Modify: `src/lib/efficientFrontier.js`
- Modify: `src/lib/efficientFrontier.test.js`

**Interfaces:**
- Produces: `getMaxSharpeForSubset(symbols, nSim, options?) -> point`,
  `runBackwardElimination(symbols, nSim, options?) -> { steps, fullSharpe, fullSymbols, optimalSymbols, optimalSharpe, optimalRet, optimalVol, optimalWeights, improved, dropped }`,
  `findOptimalSubset(portfolioSymbols, nSim, options?)`, `findOptimalSubsetForSymbols(symbols, nSim, options?)`
  (both aliases of `runBackwardElimination`). Consumed by Task 16
  (`OptimizerTab`).

- [ ] **Step 1: Write the failing test**

```js
import { runBackwardElimination, findOptimalSubset, findOptimalSubsetForSymbols } from './efficientFrontier'

describe('runBackwardElimination', () => {
  it('drops a clearly-bad symbol and stops at the floor of 2 when no further improvement is possible', () => {
    // GOOD_A / GOOD_B correlate weakly and have strong risk-adjusted returns;
    // BAD drags Sharpe down whenever it's included.
    setComputedParams({
      GOOD_A: { r: 0.15, s: 0.15 },
      GOOD_B: { r: 0.14, s: 0.16 },
      BAD: { r: 0.02, s: 0.40 },
    })
    setRealCorrelations({
      GOOD_A: { GOOD_B: 0.1, BAD: 0.1 },
      GOOD_B: { BAD: 0.1 },
    })

    const result = runBackwardElimination(['GOOD_A', 'GOOD_B', 'BAD'], 2000)

    expect(result.dropped).toEqual(['BAD'])
    expect(result.optimalSymbols.sort()).toEqual(['GOOD_A', 'GOOD_B'])
    expect(result.improved).toBe(true)
    expect(result.optimalSharpe).toBeGreaterThan(result.fullSharpe)
    expect(result.steps.length).toBe(2)
  })

  it('stops immediately when removing any symbol does not improve Sharpe', () => {
    setComputedParams({
      A: { r: 0.10, s: 0.10 },
      B: { r: 0.10, s: 0.10 },
    })
    setRealCorrelations({ A: { B: 0.0 } })

    const result = runBackwardElimination(['A', 'B'], 2000)

    expect(result.steps.length).toBe(1)
    expect(result.dropped).toEqual([])
    expect(result.optimalSymbols).toEqual(['A', 'B'])
  })

  it('findOptimalSubset and findOptimalSubsetForSymbols both delegate to runBackwardElimination', () => {
    const a = findOptimalSubset(['A', 'B'], 500)
    const b = findOptimalSubsetForSymbols(['A', 'B'], 500)
    expect(a.fullSymbols).toEqual(b.fullSymbols)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- efficientFrontier`
Expected: FAIL.

- [ ] **Step 3: Implement in `src/lib/efficientFrontier.js`**

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- efficientFrontier`
Expected: PASS (20 tests). Note: this test is Monte-Carlo-based and
probabilistic — if it flakes on the exact `dropped` symbol under CI-level
randomness, increase `nSim` in the test rather than loosening the assertion,
since the params/correlations are deliberately chosen to make `BAD`'s
removal an overwhelming improvement.

- [ ] **Step 5: Commit**

```bash
git add src/lib/efficientFrontier.js src/lib/efficientFrontier.test.js
git commit -m "feat: add backward-elimination subset optimizer to efficientFrontier.js"
```

---

### Task 9: `efficientFrontier.js` — correlation matrix helpers

**Files:**
- Modify: `src/lib/efficientFrontier.js`
- Modify: `src/lib/efficientFrontier.test.js`

**Interfaces:**
- Produces: `getCorrelationMatrix(symbols) -> number[][]`, `getCorrelationMatrixForSymbols(symbols) -> number[][]`
  (identical — the spec keeps both names since both are referenced by
  different original-app call sites). Consumed by Task 20 (`CorrelationHeatmap`).

- [ ] **Step 1: Write the failing test**

```js
import { getCorrelationMatrix, getCorrelationMatrixForSymbols } from './efficientFrontier'

describe('getCorrelationMatrix', () => {
  it('returns a symmetric matrix with 1 on the diagonal', () => {
    const matrix = getCorrelationMatrix(['AAPL', 'MSFT', 'SPY'])
    expect(matrix).toHaveLength(3)
    expect(matrix[0][0]).toBe(1)
    expect(matrix[1][1]).toBe(1)
    expect(matrix[0][1]).toBe(matrix[1][0])
  })

  it('getCorrelationMatrixForSymbols is equivalent to getCorrelationMatrix', () => {
    expect(getCorrelationMatrixForSymbols(['AAPL', 'SPY'])).toEqual(getCorrelationMatrix(['AAPL', 'SPY']))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- efficientFrontier`
Expected: FAIL.

- [ ] **Step 3: Implement in `src/lib/efficientFrontier.js`**

```js
export function getCorrelationMatrix(symbols) {
  return symbols.map((a) => symbols.map((b) => getCorrelation(a, b)))
}
export function getCorrelationMatrixForSymbols(symbols) {
  return getCorrelationMatrix(symbols)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- efficientFrontier`
Expected: PASS (22 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/efficientFrontier.js src/lib/efficientFrontier.test.js
git commit -m "feat: add correlation matrix helpers to efficientFrontier.js"
```

---

### Task 10: `efficientFrontier.js` — `getPortfolioRiskMetrics`

**Files:**
- Modify: `src/lib/efficientFrontier.js`
- Modify: `src/lib/efficientFrontier.test.js`

**Interfaces:**
- Produces: `getPortfolioRiskMetrics(positions) -> { hhi, diversificationScore, stopCoveragePct, dollarAtRisk, totalMV, expectedReturn, volatility, beta, var95 }`.
  `positions` shape: `{ symbol, weight, marketValue, currentPrice, stopLoss, shares }[]`.
  Consumed by Task 18 (`RiskTab`).

- [ ] **Step 1: Write the failing test**

```js
import { getPortfolioRiskMetrics } from './efficientFrontier'

describe('getPortfolioRiskMetrics', () => {
  const positions = [
    { symbol: 'AAPL', weight: 0.6, marketValue: 6000, currentPrice: 200, stopLoss: 180, shares: 30 },
    { symbol: 'SPY', weight: 0.4, marketValue: 4000, currentPrice: 500, stopLoss: null, shares: 8 },
  ]

  it('computes HHI and diversification score', () => {
    const metrics = getPortfolioRiskMetrics(positions)
    const hhi = 0.6 ** 2 + 0.4 ** 2
    expect(metrics.hhi).toBeCloseTo(hhi, 6)
    expect(metrics.diversificationScore).toBe(Math.round((1 - hhi) * 100))
  })

  it('computes stop coverage and dollar at risk only counting positions with a stop below price', () => {
    const metrics = getPortfolioRiskMetrics(positions)
    expect(metrics.stopCoveragePct).toBe(50)
    expect(metrics.dollarAtRisk).toBeCloseTo((200 - 180) * 30, 6)
  })

  it('computes totalMV as the sum of market values', () => {
    const metrics = getPortfolioRiskMetrics(positions)
    expect(metrics.totalMV).toBe(10000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- efficientFrontier`
Expected: FAIL.

- [ ] **Step 3: Implement in `src/lib/efficientFrontier.js`**

```js
export function getPortfolioRiskMetrics(positions) {
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- efficientFrontier`
Expected: PASS (25 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/efficientFrontier.js src/lib/efficientFrontier.test.js
git commit -m "feat: add getPortfolioRiskMetrics to efficientFrontier.js"
```

---

### Task 11: `efficientFrontier.js` — `getRiskContribution`

**Files:**
- Modify: `src/lib/efficientFrontier.js`
- Modify: `src/lib/efficientFrontier.test.js`

**Interfaces:**
- Produces: `getRiskContribution(positions) -> Array<{ symbol, weightPct, riskPct, flag }>`.
  Consumed by Task 19 (`RiskTab` risk contribution section).

- [ ] **Step 1: Write the failing test**

```js
import { getRiskContribution } from './efficientFrontier'

describe('getRiskContribution', () => {
  it('flags a position as outsized when its risk% exceeds its weight% by more than 5', () => {
    setComputedParams({
      LOW_VOL: { r: 0.08, s: 0.05 },
      HIGH_VOL: { r: 0.15, s: 0.50 },
    })
    setRealCorrelations({ LOW_VOL: { HIGH_VOL: 0.2 } })

    const positions = [
      { symbol: 'LOW_VOL', weight: 0.5 },
      { symbol: 'HIGH_VOL', weight: 0.5 },
    ]
    const contributions = getRiskContribution(positions)
    const highVol = contributions.find((c) => c.symbol === 'HIGH_VOL')
    expect(highVol.riskPct).toBeGreaterThan(highVol.weightPct + 5)
    expect(highVol.flag).toBe('outsized')
  })

  it('flags a position as efficient when its risk% is well below its weight%', () => {
    setComputedParams({
      LOW_VOL: { r: 0.08, s: 0.05 },
      HIGH_VOL: { r: 0.15, s: 0.50 },
    })
    setRealCorrelations({ LOW_VOL: { HIGH_VOL: 0.2 } })

    const positions = [
      { symbol: 'LOW_VOL', weight: 0.5 },
      { symbol: 'HIGH_VOL', weight: 0.5 },
    ]
    const contributions = getRiskContribution(positions)
    const lowVol = contributions.find((c) => c.symbol === 'LOW_VOL')
    expect(lowVol.riskPct).toBeLessThan(lowVol.weightPct - 5)
    expect(lowVol.flag).toBe('efficient')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- efficientFrontier`
Expected: FAIL.

- [ ] **Step 3: Implement in `src/lib/efficientFrontier.js`**

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- efficientFrontier`
Expected: PASS (27 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/efficientFrontier.js src/lib/efficientFrontier.test.js
git commit -m "feat: add getRiskContribution to efficientFrontier.js"
```

---

### Task 12: `efficientFrontier.js` — `getStressTests`

**Files:**
- Modify: `src/lib/efficientFrontier.js`
- Modify: `src/lib/efficientFrontier.test.js`

**Interfaces:**
- Produces: `getStressTests(positions) -> Array<{ name, marketMove, portfolioMove, perPosition }>`.
  Consumed by Task 19 (`RiskTab` stress tests section).

- [ ] **Step 1: Write the failing test**

```js
import { getStressTests } from './efficientFrontier'

describe('getStressTests', () => {
  it('returns all 6 fixed scenarios with a portfolio-level move', () => {
    const positions = [
      { symbol: 'SPY', weight: 1, marketValue: 10000 },
    ]
    const results = getStressTests(positions)
    expect(results.map((r) => r.name)).toEqual(['Bull Run', 'Mild Pullback', 'Correction', 'Bear Market', 'Crash', '2008-Level'])
    expect(results[0].marketMove).toBe(0.20)
  })

  it('sorts per-position impacts most-negative first', () => {
    const positions = [
      { symbol: 'LOW_BETA', weight: 0.5, marketValue: 5000 },
      { symbol: 'HIGH_BETA', weight: 0.5, marketValue: 5000 },
    ]
    setComputedParams({ LOW_BETA: { r: 0.08, s: 0.05 }, HIGH_BETA: { r: 0.20, s: 0.50 } })
    const results = getStressTests(positions)
    const bearMarket = results.find((r) => r.name === 'Bear Market')
    expect(bearMarket.perPosition[0].impact).toBeLessThanOrEqual(bearMarket.perPosition[1].impact)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- efficientFrontier`
Expected: FAIL.

- [ ] **Step 3: Implement in `src/lib/efficientFrontier.js`**

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- efficientFrontier`
Expected: PASS (29 tests). The engine module is now complete.

- [ ] **Step 5: Commit**

```bash
git add src/lib/efficientFrontier.js src/lib/efficientFrontier.test.js
git commit -m "feat: add getStressTests to efficientFrontier.js, completing the MPT engine"
```

---

### Task 13: `FrontierPanel.jsx` — chart + reference points

**Files:**
- Create: `src/components/analysis/FrontierPanel.jsx`
- Create: `src/components/analysis/FrontierPanel.css`
- Create: `src/components/analysis/FrontierPanel.test.jsx`

**Interfaces:**
- Consumes: `generateEfficientFrontierData`/`generateCombinedFrontierData` (Tasks 6–7)
  from `src/lib/efficientFrontier.js`.
- Produces: `<FrontierPanel symbols weights storageKey cash mode extraSymbols priceMap />`
  (props per spec section D). Consumed by Task 15 (`FrontierTab`) and Task 21
  (`PortfolioContext`).

- [ ] **Step 1: Invoke the dataviz skill before writing chart code**

Re-apply the established guidance: single shared X/Y axis pair (volatility %
/ return %), a legend since there are 4 distinct series/points (frontier
line, Your Portfolio, Max Diversification, Max Sharpe), explicit
`itemStyle`/`labelStyle` on the `<Tooltip>` (the bug already fixed once in
`FinancialsCharts.jsx` when points use per-mark color overrides).

- [ ] **Step 2: Write the failing test**

```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import FrontierPanel from './FrontierPanel'
import { setComputedParams, setRealCorrelations } from '../../lib/efficientFrontier'

describe('FrontierPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    setComputedParams({ AAPL: { r: 0.15, s: 0.20 }, SPY: { r: 0.10, s: 0.15 } })
    setRealCorrelations({ AAPL: { SPY: 0.5 } })
  })

  it('renders the frontier chart with 3 reference points labeled', () => {
    render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params" nSim={300} />)

    expect(screen.getByText('Your Portfolio')).toBeInTheDocument()
    expect(screen.getByText('Max Diversification')).toBeInTheDocument()
    expect(screen.getByText('Max Sharpe')).toBeInTheDocument()
  })

  it('renders a rebalancing table row per symbol', () => {
    render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params" nSim={300} />)

    expect(screen.getByRole('columnheader', { name: /aapl/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /spy/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Implement `src/components/analysis/FrontierPanel.jsx`**

```jsx
import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart,
} from 'recharts'
import './FrontierPanel.css'
import { generateEfficientFrontierData, generateCombinedFrontierData, getAssetParams } from '../../lib/efficientFrontier'
import { formatCurrency } from '../../lib/format'

function loadOverrides(storageKey) {
  const raw = localStorage.getItem(storageKey)
  return raw ? JSON.parse(raw) : {}
}

function loadCashRate(storageKey) {
  const raw = localStorage.getItem(`${storageKey}_cash_rate`)
  return raw ? Number(raw) : 0.03
}

export default function FrontierPanel({
  symbols, weights, storageKey, cash = 0, mode = 'portfolio', extraSymbols = [], priceMap = {}, nSim = 10000,
}) {
  const [overrides, setOverrides] = useState(() => loadOverrides(storageKey))
  const [cashRate, setCashRate] = useState(() => loadCashRate(storageKey))

  function setOverride(symbol, key, value) {
    const next = { ...overrides, [symbol]: { ...overrides[symbol], [key]: value } }
    setOverrides(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const paramsOverride = useMemo(() => {
    const result = {}
    for (const [symbol, o] of Object.entries(overrides)) {
      const base = getAssetParams(symbol)
      result[symbol] = { r: o.r ?? base.r, s: o.s ?? base.s }
    }
    return result
  }, [overrides])

  const simData = useMemo(() => {
    const cashOptions = cash > 0 ? { amount: cash, rate: cashRate } : null
    if (mode === 'combined') {
      return generateCombinedFrontierData(symbols, weights, extraSymbols, { nSim, cashOptions, paramsOverride })
    }
    return { ...generateEfficientFrontierData(symbols, { nSim, cashOptions, paramsOverride }), current: null }
  }, [symbols, weights, extraSymbols, mode, cash, cashRate, paramsOverride, nSim])

  const allSymbols = simData.symbols
  const currentPoint = mode === 'combined' ? simData.current : { ...simData.points[0], weights }
  const totalMV = allSymbols.reduce((sum, s, i) => {
    const price = priceMap[s] ?? 0
    return sum + (currentPoint.weights[i] ?? 0) * price
  }, 0)

  function actionFor(targetWeight, symbol, currentWeight) {
    const price = priceMap[symbol]
    if (!price) return '—'
    const deltaShares = Math.round(((targetWeight - currentWeight) / 100) * totalMV / price)
    if (deltaShares === 0) return 'hold'
    return deltaShares > 0 ? `buy ${deltaShares}` : `sell ${Math.abs(deltaShares)}`
  }

  const chartData = simData.frontier.map((p) => ({ vol: p.vol * 100, ret: p.ret * 100 }))

  return (
    <div className="frontier-panel">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#262626" strokeDasharray="0" />
          <XAxis dataKey="vol" name="Volatility %" tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#262626' }} tickLine={false} />
          <YAxis dataKey="ret" name="Return %" tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#262626' }} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#141414', border: '1px solid #262626', borderRadius: 6, fontSize: 12 }}
            itemStyle={{ color: '#e5e5e5' }}
            labelStyle={{ color: '#888' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#888' }} />
          <Line type="monotone" dataKey="ret" data={chartData} name="Efficient Frontier" stroke="#3987e5" strokeWidth={2} dot={false} />
          <Scatter name="Your Portfolio" data={[{ vol: currentPoint.vol * 100, ret: currentPoint.ret * 100 }]} fill="#22c55e" />
          <Scatter name="Max Diversification" data={[{ vol: simData.maxDiversification.vol * 100, ret: simData.maxDiversification.ret * 100 }]} fill="#d95926" />
          <Scatter name="Max Sharpe" data={[{ vol: simData.maxSharpe.vol * 100, ret: simData.maxSharpe.ret * 100 }]} fill="#c98500" />
        </ComposedChart>
      </ResponsiveContainer>

      <table className="frontier-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Current %</th>
            <th>Max-Div % / Action</th>
            <th>Max-Sharpe % / Action</th>
          </tr>
        </thead>
        <tbody>
          {allSymbols.map((symbol, i) => {
            const currentWeight = currentPoint.weights[i] * 100
            const maxDivWeight = simData.maxDiversification.weights[i] * 100
            const maxSharpeWeight = simData.maxSharpe.weights[i] * 100
            return (
              <tr key={symbol}>
                <th scope="row">{symbol}</th>
                <td className="mono">{currentWeight.toFixed(1)}%</td>
                <td className="mono">{maxDivWeight.toFixed(1)}% ({actionFor(maxDivWeight, symbol, currentWeight)})</td>
                <td className="mono">{maxSharpeWeight.toFixed(1)}% ({actionFor(maxSharpeWeight, symbol, currentWeight)})</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {cash > 0 && (
        <div className="frontier-cash-card">
          <label htmlFor="frontierCashRate">Cash annual return rate %</label>
          <input
            id="frontierCashRate"
            type="number"
            value={(cashRate * 100).toFixed(1)}
            onChange={(e) => {
              const rate = Number(e.target.value) / 100
              setCashRate(rate)
              localStorage.setItem(`${storageKey}_cash_rate`, String(rate))
            }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add `src/components/analysis/FrontierPanel.css`**

```css
.frontier-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.frontier-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.frontier-table th, .frontier-table td {
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  text-align: right;
}

.frontier-table th[scope="row"] {
  text-align: left;
  color: var(--text-dim);
}

.frontier-table thead th {
  color: var(--text-dim);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: right;
}

.frontier-cash-card {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-dim);
}

.frontier-cash-card input {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 8px;
  width: 80px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- FrontierPanel`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/FrontierPanel.jsx src/components/analysis/FrontierPanel.css src/components/analysis/FrontierPanel.test.jsx
git commit -m "feat: implement FrontierPanel chart and rebalancing table"
```

---

### Task 14: `FrontierPanel.jsx` — adjust-assumptions editor

**Files:**
- Modify: `src/components/analysis/FrontierPanel.jsx`
- Modify: `src/components/analysis/FrontierPanel.css`
- Modify: `src/components/analysis/FrontierPanel.test.jsx`

**Interfaces:** none new — purely additive to `FrontierPanel.jsx`.

- [ ] **Step 1: Write the failing test**

```jsx
it('expands the assumptions editor and persists an override to localStorage', async () => {
  const userEvent = (await import('@testing-library/user-event')).default
  render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params_2" nSim={300} />)

  await userEvent.click(screen.getByRole('button', { name: /adjust expected returns/i }))
  const returnInput = screen.getByLabelText(/aapl.*return/i)
  await userEvent.clear(returnInput)
  await userEvent.type(returnInput, '25')

  const stored = JSON.parse(localStorage.getItem('test_ef_params_2'))
  expect(stored.AAPL.r).toBeCloseTo(0.25, 5)
})

it('marks a symbol in extraSymbols as "new" in the assumptions editor', async () => {
  const userEvent = (await import('@testing-library/user-event')).default
  render(
    <FrontierPanel
      symbols={['AAPL']}
      weights={[1]}
      storageKey="test_ef_params_3"
      mode="combined"
      extraSymbols={['SPY']}
      priceMap={{ SPY: 500 }}
      nSim={300}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: /adjust expected returns/i }))
  expect(screen.getByText(/spy/i).closest('.frontier-assumption-row')).toHaveTextContent(/new/i)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FrontierPanel`
Expected: FAIL — no expand button exists yet.

- [ ] **Step 3: Add the expandable editor to `FrontierPanel.jsx`**

```jsx
import { useEffect, useMemo, useState } from 'react'
```
(add `useEffect` to the existing import if not already present — it isn't
needed here, keep the existing `useMemo, useState` import as-is).

Add state and the section, right after the closing `</table>` of the
rebalancing table and before the cash card:

```jsx
const [showAssumptions, setShowAssumptions] = useState(false)
```

```jsx
<button type="button" onClick={() => setShowAssumptions((v) => !v)}>
  {showAssumptions ? 'Hide' : 'Adjust Expected Returns & Volatility'}
</button>

{showAssumptions && (
  <div className="frontier-assumptions">
    {allSymbols.filter((s) => s !== 'CASH').map((symbol) => {
      const base = getAssetParams(symbol)
      const o = overrides[symbol] ?? {}
      const r = o.r ?? base.r
      const s = o.s ?? base.s
      const impliedSharpe = s > 0 ? (r - 0.045) / s : 0
      const isNew = extraSymbols.includes(symbol) && !symbols.includes(symbol)
      return (
        <div key={symbol} className="frontier-assumption-row">
          <span className="frontier-assumption-symbol">{symbol}{isNew ? ' (new)' : ''}</span>
          <label htmlFor={`${symbol}-return`}>
            {symbol} Return {(r * 100).toFixed(1)}%{o.r === undefined ? ' (default)' : ''}
            <input
              id={`${symbol}-return`}
              type="range" min="0" max="200" step="0.5"
              value={r * 100}
              onChange={(e) => setOverride(symbol, 'r', Number(e.target.value) / 100)}
            />
          </label>
          <label htmlFor={`${symbol}-vol`}>
            {symbol} Volatility {(s * 100).toFixed(1)}%{o.s === undefined ? ' (default)' : ''}
            <input
              id={`${symbol}-vol`}
              type="range" min="1" max="300" step="0.5"
              value={s * 100}
              onChange={(e) => setOverride(symbol, 's', Number(e.target.value) / 100)}
            />
          </label>
          <span className="frontier-assumption-sharpe">Implied Sharpe: {impliedSharpe.toFixed(2)}</span>
        </div>
      )
    })}
  </div>
)}
```

Note the test's `screen.getByLabelText(/aapl.*return/i)` matches the
`AAPL Return ...%` label text via the `htmlFor`/`id` pairing above.

- [ ] **Step 4: Add CSS for the assumptions editor**

```css
.frontier-assumptions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px 0;
}

.frontier-assumption-row {
  display: grid;
  grid-template-columns: 100px 1fr 1fr auto;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: var(--text-dim);
}

.frontier-assumption-symbol {
  font-weight: 700;
  color: var(--text);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- FrontierPanel`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/FrontierPanel.jsx src/components/analysis/FrontierPanel.css src/components/analysis/FrontierPanel.test.jsx
git commit -m "feat: add adjustable return/volatility assumptions editor to FrontierPanel"
```

---

### Task 15: `FrontierTab.jsx` — thin wrapper

**Files:**
- Create: `src/components/analysis/FrontierTab.jsx`
- Create: `src/components/analysis/FrontierTab.css`
- Create: `src/components/analysis/FrontierTab.test.jsx`

**Interfaces:**
- Consumes: `FrontierPanel` (Tasks 13–14), `fetchCorrelations` (Task 3),
  `setRealCorrelations`/`setComputedParams` (Task 4).
- Props: `{ investments }`.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import FrontierTab from './FrontierTab'
import { fetchCorrelations } from '../../lib/fetchCorrelations'

vi.mock('../../lib/fetchCorrelations')

describe('FrontierTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCorrelations.mockResolvedValue({ corrMap: {}, paramsMap: {} })
    localStorage.clear()
  })

  it('shows a minimum-positions message with fewer than 2 open positions', () => {
    render(<FrontierTab investments={[{ symbol: 'AAPL', assetType: 'Stock', shares: 10, currentPrice: 150 }]} />)
    expect(screen.getByText(/at least 2/i)).toBeInTheDocument()
  })

  it('renders FrontierPanel with real portfolio weights for 2+ positions', async () => {
    const investments = [
      { symbol: 'AAPL', assetType: 'Stock', shares: 10, currentPrice: 150 },
      { symbol: 'SPY', assetType: 'ETF', shares: 5, currentPrice: 500 },
    ]
    render(<FrontierTab investments={investments} />)

    await waitFor(() => expect(fetchCorrelations).toHaveBeenCalledWith(['AAPL', 'SPY']))
    expect(screen.getByText('Your Portfolio')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FrontierTab`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/components/analysis/FrontierTab.jsx`**

```jsx
import { useEffect } from 'react'
import './FrontierTab.css'
import FrontierPanel from './FrontierPanel'
import { fetchCorrelations } from '../../lib/fetchCorrelations'
import { setRealCorrelations, setComputedParams } from '../../lib/efficientFrontier'

export default function FrontierTab({ investments }) {
  const positions = investments.filter((i) => ['Stock', 'ETF', 'Crypto'].includes(i.assetType))
  const symbols = positions.map((p) => p.symbol)

  useEffect(() => {
    if (symbols.length < 2) return
    fetchCorrelations(symbols).then(({ corrMap, paramsMap }) => {
      setRealCorrelations(corrMap)
      setComputedParams(paramsMap)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')])

  if (symbols.length < 2) {
    return (
      <div className="frontier-empty">
        <p>Add at least 2 open positions to see your Efficient Frontier.</p>
      </div>
    )
  }

  const totalMV = positions.reduce((sum, p) => sum + p.shares * p.currentPrice, 0)
  const weights = positions.map((p) => (totalMV > 0 ? (p.shares * p.currentPrice) / totalMV : 0))
  const priceMap = Object.fromEntries(positions.map((p) => [p.symbol, p.currentPrice]))

  return (
    <div className="frontier-tab">
      <FrontierPanel symbols={symbols} weights={weights} storageKey="bt_ef_params" priceMap={priceMap} />
    </div>
  )
}
```

- [ ] **Step 4: Add `src/components/analysis/FrontierTab.css`**

```css
.frontier-tab {
  padding: 20px 32px 40px;
}

.frontier-empty {
  text-align: center;
  color: var(--text-dim);
  font-size: 14px;
  padding: 60px 24px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- FrontierTab`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/FrontierTab.jsx src/components/analysis/FrontierTab.css src/components/analysis/FrontierTab.test.jsx
git commit -m "feat: implement FrontierTab wrapper"
```

---

### Task 16: `OptimizerTab.jsx` — mode toggle, sim selector, assumptions table

**Files:**
- Create: `src/components/analysis/OptimizerTab.jsx`
- Create: `src/components/analysis/OptimizerTab.css`
- Create: `src/components/analysis/OptimizerTab.test.jsx`

**Interfaces:**
- Consumes: `runBackwardElimination`/`findOptimalSubset` (Task 8),
  `fetchCorrelations` (Task 3), `getCorrVersion` (Task 4), Finnhub `fetchQuote`
  (existing — check `src/lib/finnhub.js` export name before wiring).
- Props: `{ investments, incomingSymbols = null }`.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OptimizerTab from './OptimizerTab'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchCorrelations } from '../../lib/fetchCorrelations'
import { fetchQuote } from '../../lib/finnhub'

vi.mock('../../hooks/useAuth')
vi.mock('../../hooks/useUserSettings')
vi.mock('../../lib/fetchCorrelations')
vi.mock('../../lib/finnhub')

const investments = [
  { symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, currentPrice: 150 },
  { symbol: 'SPY', assetType: 'ETF', shares: 5, avgCost: 500, currentPrice: 500 },
]

describe('OptimizerTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchCorrelations.mockResolvedValue({ corrMap: {}, paramsMap: {} })
  })

  it('defaults to portfolio mode using open investments as the assumptions table rows', () => {
    render(<OptimizerTab investments={investments} />)
    expect(screen.getByRole('columnheader', { name: /aapl/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /spy/i })).toBeInTheDocument()
  })

  it('defaults the simulation-count selector to Standard (6000)', () => {
    render(<OptimizerTab investments={investments} />)
    expect(screen.getByRole('button', { name: /^standard$/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('fetches live quotes one-by-one when Fetch is clicked', async () => {
    fetchQuote.mockResolvedValue({ c: 999 })
    render(<OptimizerTab investments={investments} />)

    await userEvent.click(screen.getByRole('button', { name: /^fetch$/i }))

    await waitFor(() => expect(fetchQuote).toHaveBeenCalledTimes(2))
    expect(fetchQuote).toHaveBeenCalledWith('AAPL', 'key123')
    expect(fetchQuote).toHaveBeenCalledWith('SPY', 'key123')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- OptimizerTab`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/components/analysis/OptimizerTab.jsx`**

```jsx
import { useState } from 'react'
import './OptimizerTab.css'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchQuote } from '../../lib/finnhub'
import { findOptimalSubset, findOptimalSubsetForSymbols, getCorrVersion } from '../../lib/efficientFrontier'
import { formatCurrency } from '../../lib/format'

const SIM_LEVELS = [
  { key: 'fast', label: 'Fast', nSim: 3000 },
  { key: 'standard', label: 'Standard', nSim: 6000 },
  { key: 'high', label: 'High', nSim: 15000 },
  { key: 'max', label: 'Max', nSim: 40000 },
]

export default function OptimizerTab({ investments, incomingSymbols = null }) {
  const { user } = useAuth()
  const { finnhubKey } = useUserSettings(user?.id)
  const [mode, setMode] = useState(incomingSymbols ? 'custom' : 'portfolio')
  const [simLevel, setSimLevel] = useState('standard')
  const [priceOverrides, setPriceOverrides] = useState({})
  const [fetchErrors, setFetchErrors] = useState({})
  const [totalToInvest, setTotalToInvest] = useState('')
  const [result, setResult] = useState(null)
  const [ranWithVersion, setRanWithVersion] = useState(null)

  const portfolioSymbols = investments.filter((i) => ['Stock', 'ETF', 'Crypto'].includes(i.assetType)).map((i) => i.symbol)
  const symbols = mode === 'custom' ? (incomingSymbols ?? []) : portfolioSymbols

  function priceFor(symbol) {
    if (priceOverrides[symbol] !== undefined) return priceOverrides[symbol]
    const inv = investments.find((i) => i.symbol === symbol)
    return inv?.currentPrice ?? null
  }

  async function handleFetchPrices() {
    setFetchErrors({})
    for (const symbol of symbols) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const quote = await fetchQuote(symbol, finnhubKey)
        setPriceOverrides((prev) => ({ ...prev, [symbol]: quote.c }))
      } catch {
        setFetchErrors((prev) => ({ ...prev, [symbol]: true }))
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  function handleRun() {
    const nSim = SIM_LEVELS.find((l) => l.key === simLevel).nSim
    const runFn = mode === 'custom' ? findOptimalSubsetForSymbols : findOptimalSubset
    setResult(runFn(symbols, nSim))
    setRanWithVersion(getCorrVersion())
  }

  const isStale = ranWithVersion !== null && ranWithVersion !== getCorrVersion()

  return (
    <div className="optimizer-tab">
      <div className="optimizer-mode-toggle">
        <button type="button" aria-pressed={mode === 'portfolio'} onClick={() => setMode('portfolio')}>Portfolio</button>
        <button type="button" aria-pressed={mode === 'custom'} onClick={() => setMode('custom')}>Custom</button>
      </div>

      {mode === 'custom' && (
        <label htmlFor="optimizerTotalToInvest">
          Total to invest
          <input id="optimizerTotalToInvest" value={totalToInvest} onChange={(e) => setTotalToInvest(e.target.value)} />
        </label>
      )}

      <div className="optimizer-sim-selector">
        {SIM_LEVELS.map((level) => (
          <button key={level.key} type="button" aria-pressed={simLevel === level.key} onClick={() => setSimLevel(level.key)}>
            {level.label}
          </button>
        ))}
      </div>

      <section className="optimizer-assumptions">
        <h2>Assumptions</h2>
        <button type="button" onClick={handleFetchPrices}>Fetch</button>
        <table className="optimizer-table">
          <thead><tr><th>Symbol</th><th>Price</th></tr></thead>
          <tbody>
            {symbols.map((symbol) => (
              <tr key={symbol}>
                <th scope="row">{symbol}</th>
                <td className="mono">
                  {fetchErrors[symbol] ? 'error' : (priceFor(symbol) ? formatCurrency(priceFor(symbol)) : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <button type="button" onClick={handleRun}>Run Optimizer</button>
      {isStale && <p className="optimizer-stale-badge">Correlation data has been refreshed — re-run for updated results.</p>}

      {result && (
        <section className="optimizer-trail">
          <h2>Elimination Trail</h2>
          {result.steps.map((step, idx) => (
            <div key={idx} className="optimizer-trail-row">
              {result.fullSymbols.map((symbol) => (
                <span key={symbol} className={step.symbols.includes(symbol) ? 'optimizer-kept' : 'optimizer-dropped'}>
                  {symbol}
                </span>
              ))}
              <span className="mono">Sharpe {step.sharpe.toFixed(2)}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add `src/components/analysis/OptimizerTab.css`**

```css
.optimizer-tab {
  padding: 20px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.optimizer-mode-toggle, .optimizer-sim-selector {
  display: flex;
  gap: 4px;
}

.optimizer-mode-toggle button, .optimizer-sim-selector button {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.optimizer-mode-toggle button[aria-pressed="true"], .optimizer-sim-selector button[aria-pressed="true"] {
  border-color: var(--green);
  color: var(--green);
}

.optimizer-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.optimizer-table th, .optimizer-table td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  text-align: right;
}

.optimizer-table th[scope="row"] {
  text-align: left;
  color: var(--text-dim);
}

.optimizer-stale-badge {
  color: var(--red);
  font-size: 12px;
}

.optimizer-trail-row {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}

.optimizer-kept { color: var(--green); }
.optimizer-dropped { color: var(--text-dim); text-decoration: line-through; }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- OptimizerTab`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/OptimizerTab.jsx src/components/analysis/OptimizerTab.css src/components/analysis/OptimizerTab.test.jsx
git commit -m "feat: implement OptimizerTab mode toggle, sim selector, and assumptions table"
```

---

### Task 17: `OptimizerTab.jsx` — elimination trail detail + corrVersion badge test

**Files:**
- Modify: `src/components/analysis/OptimizerTab.jsx`
- Modify: `src/components/analysis/OptimizerTab.test.jsx`

**Interfaces:** none new — this task adds expandable per-step detail and
verifies the staleness badge end-to-end.

- [ ] **Step 1: Write the failing test**

```jsx
it('runs the optimizer and shows one elimination-trail row per step', async () => {
  render(<OptimizerTab investments={investments} />)
  await userEvent.click(screen.getByRole('button', { name: /^run optimizer$/i }))
  await waitFor(() => expect(screen.getByText('Elimination Trail')).toBeInTheDocument())
  expect(screen.getAllByText(/sharpe/i).length).toBeGreaterThan(0)
})

it('shows a stale-results badge after correlation data refreshes post-run', async () => {
  const { setRealCorrelations } = await import('../../lib/efficientFrontier')
  render(<OptimizerTab investments={investments} />)
  await userEvent.click(screen.getByRole('button', { name: /^run optimizer$/i }))
  await waitFor(() => expect(screen.getByText('Elimination Trail')).toBeInTheDocument())

  setRealCorrelations({ AAPL: { SPY: 0.9 } })

  await waitFor(() => expect(screen.getByText(/re-run for updated results/i)).toBeInTheDocument())
})
```

Note: the second test calls `setRealCorrelations` directly — since it bumps
`corrVersion` at the module level but doesn't re-render `OptimizerTab` on its
own, add a cheap re-render trigger: change the test to also
`await userEvent.hover(document.body)` or, more reliably, re-query after a
`rerender`. Simplify by re-rendering explicitly:

```jsx
it('shows a stale-results badge after correlation data refreshes post-run', async () => {
  const { setRealCorrelations } = await import('../../lib/efficientFrontier')
  const { rerender } = render(<OptimizerTab investments={investments} />)
  await userEvent.click(screen.getByRole('button', { name: /^run optimizer$/i }))
  await waitFor(() => expect(screen.getByText('Elimination Trail')).toBeInTheDocument())

  setRealCorrelations({ AAPL: { SPY: 0.9 } })
  rerender(<OptimizerTab investments={investments} />)

  expect(screen.getByText(/re-run for updated results/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- OptimizerTab`
Expected: FAIL if the "Run Optimizer" button text or trail rendering doesn't
match exactly — reconcile against the Task 16 implementation; the trail
already renders from Task 16, so this test should mostly confirm existing
behavior. If it fails only on the exact-text match, fix the test's selector
rather than the component.

- [ ] **Step 3: Verify against the Task 16 implementation, adjust only if needed**

The `handleRun`/`isStale` logic from Task 16 already satisfies this — no
production code change is expected. If the test reveals `isStale` doesn't
recompute on rerender (because `getCorrVersion()` is read at render time, it
should), fix by ensuring `isStale` is computed inline in the render body (not
memoized), which Task 16's implementation already does.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- OptimizerTab`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis/OptimizerTab.jsx src/components/analysis/OptimizerTab.test.jsx
git commit -m "test: verify OptimizerTab elimination trail and stale-correlation badge"
```

---

### Task 18: `RiskTab.jsx` — hero tiles, concentration, stop-loss panels

**Files:**
- Create: `src/components/analysis/RiskTab.jsx`
- Create: `src/components/analysis/RiskTab.css`
- Create: `src/components/analysis/RiskTab.test.jsx`

**Interfaces:**
- Consumes: `getPortfolioRiskMetrics` (Task 10) from `src/lib/efficientFrontier.js`.
- Props: `{ investments }`.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RiskTab from './RiskTab'
import { setComputedParams, setRealCorrelations } from '../../lib/efficientFrontier'

const investments = [
  { symbol: 'AAPL', assetType: 'Stock', shares: 20, currentPrice: 150, avgCost: 140, stopLoss: 130 },
  { symbol: 'SPY', assetType: 'ETF', shares: 4, currentPrice: 500, avgCost: 480, stopLoss: null },
]

describe('RiskTab', () => {
  beforeEach(() => {
    setComputedParams({ AAPL: { r: 0.15, s: 0.27 }, SPY: { r: 0.10, s: 0.16 } })
    setRealCorrelations({ AAPL: { SPY: 0.5 } })
  })

  it('renders the 4 hero tiles', () => {
    render(<RiskTab investments={investments} />)
    expect(screen.getByText(/portfolio beta/i)).toBeInTheDocument()
    expect(screen.getByText(/1-day 95% var/i)).toBeInTheDocument()
    expect(screen.getByText(/diversification score/i)).toBeInTheDocument()
    expect(screen.getByText(/stop coverage/i)).toBeInTheDocument()
  })

  it('shows a coverage warning banner when stop coverage is below 80%', () => {
    render(<RiskTab investments={investments} />)
    expect(screen.getByText(/coverage.*below 80/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- RiskTab`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/components/analysis/RiskTab.jsx`**

```jsx
import './RiskTab.css'
import { getPortfolioRiskMetrics } from '../../lib/efficientFrontier'
import { formatCurrency } from '../../lib/format'

function betaBand(beta) {
  if (beta > 1.5) return 'risk-red'
  if (beta > 1.1) return 'risk-yellow'
  if (beta < 0.8) return 'risk-green'
  return 'risk-neutral'
}

function scoreBand(score) {
  if (score > 70) return 'risk-green'
  if (score > 50) return 'risk-yellow'
  return 'risk-red'
}

function coverageBand(pct) {
  if (pct >= 80) return 'risk-green'
  if (pct >= 50) return 'risk-yellow'
  return 'risk-red'
}

export default function RiskTab({ investments }) {
  const positions = investments
    .filter((i) => ['Stock', 'ETF', 'Crypto'].includes(i.assetType))
    .map((i) => {
      const marketValue = i.shares * i.currentPrice
      return { symbol: i.symbol, marketValue, currentPrice: i.currentPrice, stopLoss: i.stopLoss || null, shares: i.shares }
    })

  const totalMV = positions.reduce((sum, p) => sum + p.marketValue, 0)
  const withWeights = positions.map((p) => ({ ...p, weight: totalMV > 0 ? p.marketValue / totalMV : 0 }))

  const metrics = getPortfolioRiskMetrics(withWeights)
  const largestWeight = Math.max(...withWeights.map((p) => p.weight), 0)

  return (
    <div className="risk-tab">
      <div className="risk-hero">
        <div className={`risk-tile ${betaBand(metrics.beta)}`}>
          <span className="risk-tile-label">Portfolio Beta</span>
          <span className="risk-tile-value">{metrics.beta.toFixed(2)}</span>
        </div>
        <div className="risk-tile">
          <span className="risk-tile-label">1-Day 95% VaR</span>
          <span className="risk-tile-value">{formatCurrency(metrics.var95)}</span>
        </div>
        <div className={`risk-tile ${scoreBand(metrics.diversificationScore)}`}>
          <span className="risk-tile-label">Diversification Score</span>
          <span className="risk-tile-value">{metrics.diversificationScore}/100</span>
        </div>
        <div className={`risk-tile ${coverageBand(metrics.stopCoveragePct)}`}>
          <span className="risk-tile-label">Stop Coverage</span>
          <span className="risk-tile-value">{metrics.stopCoveragePct.toFixed(0)}%</span>
        </div>
      </div>

      <section className="risk-concentration">
        <h2>Concentration Risk</h2>
        <p>Largest position: {(largestWeight * 100).toFixed(1)}%</p>
        <p>HHI: {metrics.hhi.toFixed(3)}</p>
        <p>Total Portfolio: {formatCurrency(metrics.totalMV)}</p>
        <p>Expected Return: {(metrics.expectedReturn * 100).toFixed(1)}%</p>
        <p>Volatility: {(metrics.volatility * 100).toFixed(1)}%</p>
      </section>

      <section className="risk-stoploss">
        <h2>Stop Loss Protection</h2>
        <p>{withWeights.filter((p) => p.stopLoss).length} / {withWeights.length} positions have a stop set</p>
        <p>$ at risk if all stops hit: {formatCurrency(metrics.dollarAtRisk)}</p>
        {metrics.stopCoveragePct < 80 && (
          <p className="risk-warning">Stop coverage is below 80% — consider setting stops on more positions.</p>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Add `src/components/analysis/RiskTab.css`**

```css
.risk-tab {
  padding: 20px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.risk-hero {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.risk-tile {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
}

.risk-tile-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

.risk-tile-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}

.risk-tile.risk-green .risk-tile-value { color: var(--green); }
.risk-tile.risk-red .risk-tile-value { color: var(--red); }
.risk-tile.risk-yellow .risk-tile-value { color: #eab308; }

.risk-concentration h2, .risk-stoploss h2 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.risk-warning {
  color: var(--red);
  font-size: 13px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- RiskTab`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/RiskTab.jsx src/components/analysis/RiskTab.css src/components/analysis/RiskTab.test.jsx
git commit -m "feat: implement RiskTab hero tiles, concentration, and stop-loss panels"
```

---

### Task 19: `RiskTab.jsx` — stress tests + risk contribution

**Files:**
- Modify: `src/components/analysis/RiskTab.jsx`
- Modify: `src/components/analysis/RiskTab.css`
- Modify: `src/components/analysis/RiskTab.test.jsx`

**Interfaces:**
- Consumes: `getStressTests` (Task 12), `getRiskContribution` (Task 11).

- [ ] **Step 1: Write the failing test**

```jsx
it('renders 6 expandable stress test scenarios, expanding to a sorted per-position table', async () => {
  const userEvent = (await import('@testing-library/user-event')).default
  render(<RiskTab investments={investments} />)

  expect(screen.getByText('Bull Run')).toBeInTheDocument()
  expect(screen.getByText('2008-Level')).toBeInTheDocument()

  await userEvent.click(screen.getByText('Bear Market'))
  expect(screen.getAllByText(/aapl|spy/i).length).toBeGreaterThan(0)
})

it('renders risk contribution rows with outsized/efficient flags', () => {
  render(<RiskTab investments={investments} />)
  expect(screen.getByText('Risk Contribution')).toBeInTheDocument()
  expect(screen.getAllByText(/AAPL|SPY/).length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- RiskTab`
Expected: FAIL — stress tests / risk contribution sections don't exist yet.

- [ ] **Step 3: Add stress tests + risk contribution to `RiskTab.jsx`**

```jsx
import { useState } from 'react'
import './RiskTab.css'
import { getPortfolioRiskMetrics, getStressTests, getRiskContribution } from '../../lib/efficientFrontier'
import { formatCurrency } from '../../lib/format'
```

Add state and sections after the Stop Loss Protection `</section>`:

```jsx
const [expandedScenario, setExpandedScenario] = useState(null)
const stressTests = getStressTests(withWeights)
const riskContributions = getRiskContribution(withWeights)
```

```jsx
<section className="risk-stress">
  <h2>Stress Tests</h2>
  {stressTests.map((scenario) => (
    <div key={scenario.name} className="risk-stress-row">
      <button type="button" onClick={() => setExpandedScenario(expandedScenario === scenario.name ? null : scenario.name)}>
        {scenario.name} ({(scenario.portfolioMove * 100).toFixed(1)}%, {formatCurrency(scenario.portfolioMove * metrics.totalMV)})
      </button>
      {expandedScenario === scenario.name && (
        <table className="risk-table">
          <thead><tr><th>Symbol</th><th>Beta</th><th>Move %</th><th>$ Impact</th></tr></thead>
          <tbody>
            {scenario.perPosition.map((p) => (
              <tr key={p.symbol}>
                <th scope="row">{p.symbol}</th>
                <td className="mono">{p.beta.toFixed(2)}</td>
                <td className="mono">{(p.move * 100).toFixed(1)}%</td>
                <td className="mono">{formatCurrency(p.impact)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  ))}
</section>

<section className="risk-contribution">
  <h2>Risk Contribution</h2>
  <table className="risk-table">
    <thead><tr><th>Symbol</th><th>Weight %</th><th>Risk %</th><th>Flag</th></tr></thead>
    <tbody>
      {riskContributions.map((c) => (
        <tr key={c.symbol}>
          <th scope="row">{c.symbol}</th>
          <td className="mono">{c.weightPct.toFixed(1)}%</td>
          <td className="mono">{c.riskPct.toFixed(1)}%</td>
          <td className={c.flag === 'outsized' ? 'risk-flag-outsized' : c.flag === 'efficient' ? 'risk-flag-efficient' : ''}>
            {c.flag ?? '—'}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</section>
```

- [ ] **Step 4: Add CSS**

```css
.risk-stress-row button {
  background: none;
  border: none;
  color: var(--text);
  font-size: 13px;
  padding: 8px 0;
  width: 100%;
  text-align: left;
}

.risk-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.risk-table th, .risk-table td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  text-align: right;
}

.risk-table th[scope="row"] {
  text-align: left;
  color: var(--text-dim);
}

.risk-flag-outsized { color: var(--red); }
.risk-flag-efficient { color: var(--green); }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- RiskTab`
Expected: PASS (4 tests total).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/RiskTab.jsx src/components/analysis/RiskTab.css src/components/analysis/RiskTab.test.jsx
git commit -m "feat: add stress tests and risk contribution sections to RiskTab"
```

---

### Task 20: `CorrelationHeatmap.jsx`

**Files:**
- Create: `src/components/analysis/CorrelationHeatmap.jsx`
- Create: `src/components/analysis/CorrelationHeatmap.css`
- Create: `src/components/analysis/CorrelationHeatmap.test.jsx`

**Interfaces:**
- Consumes: `getCorrelationMatrixForSymbols` (Task 9).
- Produces: `<CorrelationHeatmap symbols={string[]} />`. Consumed by Task 21
  (`PortfolioContext`).

- [ ] **Step 1: Invoke the dataviz skill before writing this**

The coloring bands (≥0.7 red, ≥0.4 orange, ≥0.15 yellow, ≥-0.05 gray, else
blue) are a fixed 5-step status scale, not a continuous diverging ramp —
treat it as a small discrete legend (5 swatches with labels), each band gets
a `data-band` attribute for testing and a visible legend key so color isn't
the only signal.

- [ ] **Step 2: Write the failing test**

```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import CorrelationHeatmap from './CorrelationHeatmap'
import { setRealCorrelations } from '../../lib/efficientFrontier'

describe('CorrelationHeatmap', () => {
  beforeEach(() => {
    setRealCorrelations({ AAPL: { SPY: 0.75 }, SPY: { TLT: -0.10 } })
  })

  it('renders only the lower triangle of the matrix', () => {
    render(<CorrelationHeatmap symbols={['AAPL', 'SPY', 'TLT']} />)
    const cells = screen.getAllByTestId('heatmap-cell')
    // lower triangle of a 3x3 (excluding diagonal) = 3 cells
    expect(cells).toHaveLength(3)
  })

  it('colors a cell red when correlation is >= 0.7', () => {
    render(<CorrelationHeatmap symbols={['AAPL', 'SPY']} />)
    const cell = screen.getByTestId('heatmap-cell')
    expect(cell).toHaveAttribute('data-band', 'red')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- CorrelationHeatmap`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement `src/components/analysis/CorrelationHeatmap.jsx`**

```jsx
import './CorrelationHeatmap.css'
import { getCorrelationMatrixForSymbols } from '../../lib/efficientFrontier'

function bandFor(value) {
  if (value >= 0.7) return 'red'
  if (value >= 0.4) return 'orange'
  if (value >= 0.15) return 'yellow'
  if (value >= -0.05) return 'gray'
  return 'blue'
}

export default function CorrelationHeatmap({ symbols }) {
  const matrix = getCorrelationMatrixForSymbols(symbols)

  return (
    <div className="correlation-heatmap">
      <table className="correlation-table">
        <tbody>
          {symbols.map((rowSymbol, i) => (
            <tr key={rowSymbol}>
              <th scope="row">{rowSymbol}</th>
              {symbols.slice(0, i).map((colSymbol, j) => {
                const value = matrix[i][j]
                const band = bandFor(value)
                return (
                  <td key={colSymbol} data-testid="heatmap-cell" data-band={band} className={`heatmap-cell heatmap-cell--${band}`}>
                    {value.toFixed(2)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="heatmap-legend">
        <span className="heatmap-legend-key heatmap-cell--red">&ge; 0.7</span>
        <span className="heatmap-legend-key heatmap-cell--orange">&ge; 0.4</span>
        <span className="heatmap-legend-key heatmap-cell--yellow">&ge; 0.15</span>
        <span className="heatmap-legend-key heatmap-cell--gray">&ge; -0.05</span>
        <span className="heatmap-legend-key heatmap-cell--blue">&lt; -0.05</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add `src/components/analysis/CorrelationHeatmap.css`**

```css
.correlation-table {
  border-collapse: collapse;
  font-size: 11px;
}

.correlation-table th, .correlation-table td {
  padding: 6px 10px;
  text-align: center;
}

.correlation-table th[scope="row"] {
  text-align: right;
  color: var(--text-dim);
}

.heatmap-cell--red { background: rgba(239, 68, 68, 0.35); }
.heatmap-cell--orange { background: rgba(217, 89, 38, 0.35); }
.heatmap-cell--yellow { background: rgba(201, 133, 0, 0.30); }
.heatmap-cell--gray { background: rgba(136, 136, 136, 0.25); }
.heatmap-cell--blue { background: rgba(57, 135, 229, 0.30); }

.heatmap-legend {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-dim);
}

.heatmap-legend-key {
  padding: 2px 8px;
  border-radius: 4px;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- CorrelationHeatmap`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/analysis/CorrelationHeatmap.jsx src/components/analysis/CorrelationHeatmap.css src/components/analysis/CorrelationHeatmap.test.jsx
git commit -m "feat: implement CorrelationHeatmap"
```

---

### Task 21: `PortfolioContext.jsx` + `ResearchTab.jsx` wiring

**Files:**
- Create: `src/components/analysis/PortfolioContext.jsx`
- Create: `src/components/analysis/PortfolioContext.css`
- Create: `src/components/analysis/PortfolioContext.test.jsx`
- Modify: `src/components/analysis/ResearchTab.jsx`
- Modify: `src/components/analysis/ResearchTab.test.jsx`

**Interfaces:**
- Consumes: `CorrelationHeatmap` (Task 20), `FrontierPanel` (Tasks 13–14),
  `fetchCorrelations` (Task 3).
- Props: `<PortfolioContext portfolioSymbols researchedSymbols priceMap />`.

- [ ] **Step 1: Write the failing test for `PortfolioContext`**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PortfolioContext from './PortfolioContext'
import { setComputedParams, setRealCorrelations } from '../../lib/efficientFrontier'

describe('PortfolioContext', () => {
  beforeEach(() => {
    setComputedParams({ AAPL: { r: 0.15, s: 0.27 }, NVDA: { r: 0.28, s: 0.45 } })
    setRealCorrelations({ AAPL: { NVDA: 0.6 } })
  })

  it('defaults to the Correlation Matrix sub-tab', () => {
    render(<PortfolioContext portfolioSymbols={['AAPL']} researchedSymbols={['NVDA']} priceMap={{ NVDA: 900 }} />)
    expect(screen.getByRole('button', { name: /correlation matrix/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByTestId('heatmap-cell').length).toBeGreaterThan(0)
  })

  it('switches to the Efficient Frontier sub-tab and renders FrontierPanel in combined mode', async () => {
    render(<PortfolioContext portfolioSymbols={['AAPL']} researchedSymbols={['NVDA']} priceMap={{ NVDA: 900 }} />)
    await userEvent.click(screen.getByRole('button', { name: /efficient frontier/i }))
    expect(screen.getByText('Your Portfolio')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PortfolioContext`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/components/analysis/PortfolioContext.jsx`**

```jsx
import { useState } from 'react'
import './PortfolioContext.css'
import CorrelationHeatmap from './CorrelationHeatmap'
import FrontierPanel from './FrontierPanel'

export default function PortfolioContext({ portfolioSymbols, researchedSymbols, priceMap }) {
  const [subTab, setSubTab] = useState('correlation')
  const allSymbols = [...new Set([...portfolioSymbols, ...researchedSymbols])]

  return (
    <div className="portfolio-context">
      <div className="portfolio-context-toggle">
        <button type="button" aria-pressed={subTab === 'correlation'} onClick={() => setSubTab('correlation')}>
          Correlation Matrix
        </button>
        <button type="button" aria-pressed={subTab === 'frontier'} onClick={() => setSubTab('frontier')}>
          Efficient Frontier
        </button>
      </div>

      {subTab === 'correlation' && <CorrelationHeatmap symbols={allSymbols} />}
      {subTab === 'frontier' && (
        <FrontierPanel
          symbols={portfolioSymbols}
          weights={portfolioSymbols.map(() => 1 / portfolioSymbols.length)}
          storageKey="bt_ef_research_params"
          mode="combined"
          extraSymbols={researchedSymbols}
          priceMap={priceMap}
        />
      )}
    </div>
  )
}
```

Note: `weights` here uses an equal-weight placeholder when the caller doesn't
have real portfolio market values handy in Research's context (Research
tracks researched symbols, not portfolio position sizing) — `ResearchTab`
passes real weights in Step 5 when available.

- [ ] **Step 4: Add `src/components/analysis/PortfolioContext.css`**

```css
.portfolio-context {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-top: 20px;
}

.portfolio-context-toggle {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
}

.portfolio-context-toggle button {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.portfolio-context-toggle button[aria-pressed="true"] {
  border-color: var(--green);
  color: var(--green);
}
```

- [ ] **Step 5: Wire into `ResearchTab.jsx`**

Add imports and a `useEffect` for correlation fetching, plus render
`PortfolioContext` in Single view:

```jsx
import PortfolioContext from './PortfolioContext'
import { fetchCorrelations } from '../../lib/fetchCorrelations'
import { setRealCorrelations, setComputedParams } from '../../lib/efficientFrontier'
```

```jsx
const portfolioSymbols = stockSymbols
const researchedSymbols = Object.keys(data)

useEffect(() => {
  const combined = [...new Set([...portfolioSymbols, ...researchedSymbols])]
  if (combined.length === 0) return
  fetchCorrelations(combined).then(({ corrMap, paramsMap }) => {
    setRealCorrelations(corrMap)
    setComputedParams(paramsMap)
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [portfolioSymbols.join(','), researchedSymbols.join(',')])
```

Render after the existing `SymbolPanels` block in Single view (still inside
the `view === 'single'` conditional):

```jsx
{view === 'single' && researchedSymbols.length > 0 && stockSymbols.length > 0 && (
  <PortfolioContext
    portfolioSymbols={portfolioSymbols}
    researchedSymbols={researchedSymbols}
    priceMap={Object.fromEntries(researchedSymbols.map((s) => [s, data[s]?.quote?.c]).filter(([, price]) => price))}
  />
)}
```

- [ ] **Step 6: Write the failing test for the `ResearchTab` wiring**

```jsx
it('fetches correlations for the combined portfolio+researched symbol list and renders Portfolio Context', async () => {
  const { fetchCorrelations } = await import('../../lib/fetchCorrelations')
  vi.mocked(fetchCorrelations).mockResolvedValue({ corrMap: {}, paramsMap: {} })
  useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
  fetchFundamentals.mockResolvedValue(mockResult('Apple Inc'))

  render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
  await waitFor(() => expect(screen.getByText('Apple Inc')).toBeInTheDocument())

  await waitFor(() => expect(fetchCorrelations).toHaveBeenCalledWith(['AAPL']))
})
```

Add `vi.mock('../../lib/fetchCorrelations')` near the top of
`ResearchTab.test.jsx` alongside the existing mocks.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- PortfolioContext ResearchTab`
Expected: PASS (both `PortfolioContext.test.jsx` and `ResearchTab.test.jsx`).

- [ ] **Step 8: Commit**

```bash
git add src/components/analysis/PortfolioContext.jsx src/components/analysis/PortfolioContext.css src/components/analysis/PortfolioContext.test.jsx src/components/analysis/ResearchTab.jsx src/components/analysis/ResearchTab.test.jsx
git commit -m "feat: add Research Portfolio Context (correlation heatmap + combined frontier)"
```

---

### Task 22: Page wiring

**Files:**
- Modify: `src/pages/AnalyzePage.jsx`
- Modify: `src/pages/AnalyzePage.test.jsx`

- [ ] **Step 1: Wire the three tabs into `AnalyzePage.jsx`**

Import `FrontierTab`, `OptimizerTab`, `RiskTab`; render each for its
respective `tab === '...'` value, following the same pattern as `dcf`/
`financials`/`research`. Update the placeholder-exclusion condition to also
exclude `frontier`, `optimizer`, `risk`.

- [ ] **Step 2: Update `AnalyzePage.test.jsx`**

Change the "Coming soon" test to target `wheel` instead of `frontier`.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- AnalyzePage`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AnalyzePage.jsx src/pages/AnalyzePage.test.jsx
git commit -m "feat: wire Frontier, Optimizer, and Risk tabs into AnalyzePage"
```

---

### Task 23: Full suite + `netlify dev` smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (368 existing + all new tests from this plan).

- [ ] **Step 2: Restart with `netlify dev`, manual smoke test**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

(`npm run dev` now runs `netlify dev` per Task 1.) At `/analyze`:
- **Frontier** (≥2 open positions): confirm the chart renders with 3 labeled
  reference points, the rebalancing table has one row per symbol, and
  adjusting a return/volatility slider changes the chart.
- **Optimizer**: run at "Fast", confirm the elimination trail completes and
  shows kept/dropped symbols; click "Fetch" and confirm live prices populate
  (or a per-symbol error shows) with a real Finnhub key.
- **Risk**: confirm hero tiles show sane numbers, expand a stress scenario,
  confirm risk contribution rows render with flags.
- **Research**: research a symbol not in your portfolio, confirm Portfolio
  Context appears with a working correlation heatmap and combined frontier.

- [ ] **Step 3: Report completion**

No commit needed for this task unless smoke testing surfaces a bug — fix as
a new small commit and re-run Step 1.
