# Analyze Tab — Phase 4 (DCF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `bt_fundamentals_cache` write gap in `ResearchTab`, build the pure `dcf.js` valuation engine, and build `DCFTab.jsx` — an interactive DCF calculator with adjustable inputs, a sensitivity grid, an FCF chart, and a math breakdown.

**Architecture:** `dcf.js` is pure computation (no fetching). `DCFTab.jsx` reuses the exact same 3-tier financials cache chain already built for `FinancialsTab.jsx`, seeds its inputs via `deriveDcfInputs`, and lets the user override any of them.

**Tech Stack:** React 19, Vitest + @testing-library/react, `recharts` (already a dependency). Dataviz skill invoked before writing the FCF chart.

## Global Constraints

- No Supabase schema changes; reuse `financials_cache` via the existing `financialsSharedCache.js`.
- No MSFT mock-data fallback — Key Required state only, matching Financials.
- TDD throughout: failing test → implementation → passing test → commit, per task.

---

### Task 1: Fix `ResearchTab` — write to `bt_fundamentals_cache`

**Files:**
- Modify: `src/components/analysis/ResearchTab.jsx`
- Modify: `src/components/analysis/ResearchTab.test.jsx`

**Interfaces:**
- No new exports — internal behavior fix only. `localStorage['bt_fundamentals_cache']` shape: `{ [symbol]: { profile, metrics, quote } }`, read by Task 3 (`deriveDcfInputs` via `DCFTab.jsx`).

- [ ] **Step 1: Write the failing test**

Add to `ResearchTab.test.jsx`:

```jsx
it('writes profile/metrics/quote to bt_fundamentals_cache after fetching a symbol', async () => {
  useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
  fetchFundamentals.mockResolvedValue(mockResult('Apple Inc'))

  render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
  await waitFor(() => expect(screen.getByText('Apple Inc')).toBeInTheDocument())

  const cache = JSON.parse(localStorage.getItem('bt_fundamentals_cache'))
  expect(cache.AAPL.profile).toEqual({ name: 'Apple Inc' })
  expect(cache.AAPL.metrics).toEqual({ peBasicExclExtraTTM: 20 })
})
```

Add `localStorage.clear()` to the existing `beforeEach` if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ResearchTab`
Expected: FAIL — cache never written.

- [ ] **Step 3: Implement the fix in `fetchSymbol`**

In `src/components/analysis/ResearchTab.jsx`, after `setPeers(...)`:

```js
const cacheRaw = localStorage.getItem('bt_fundamentals_cache')
const cache = cacheRaw ? JSON.parse(cacheRaw) : {}
cache[symbol] = { profile: result.profile, metrics: result.metrics, quote: result.quote }
localStorage.setItem('bt_fundamentals_cache', JSON.stringify(cache))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ResearchTab`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis/ResearchTab.jsx src/components/analysis/ResearchTab.test.jsx
git commit -m "fix: restore bt_fundamentals_cache write in ResearchTab (needed by DCF)"
```

---

### Task 2: `dcf.js` — `parseShorthandNumber` + `deriveDcfInputs`

**Files:**
- Create: `src/lib/dcf.js`
- Create: `src/lib/dcf.test.js`

**Interfaces:**
- Produces: `parseShorthandNumber(input) -> number | null`, `deriveDcfInputs({ financialsData, fundamentalsCacheEntry, investment }) -> { baseFCF, netCash, impliedGrowthPct, sharesOutstanding, currentPrice }`. Consumed by Task 4 (`DCFTab`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { parseShorthandNumber, deriveDcfInputs } from './dcf'

describe('parseShorthandNumber', () => {
  it('parses B/M/K suffixes', () => {
    expect(parseShorthandNumber('10B')).toBe(10e9)
    expect(parseShorthandNumber('1.5M')).toBe(1.5e6)
    expect(parseShorthandNumber('500K')).toBe(500e3)
  })

  it('passes plain numbers through', () => {
    expect(parseShorthandNumber('42')).toBe(42)
    expect(parseShorthandNumber('42.5')).toBe(42.5)
  })

  it('is case-insensitive', () => {
    expect(parseShorthandNumber('2b')).toBe(2e9)
  })

  it('returns null for invalid input', () => {
    expect(parseShorthandNumber('abc')).toBeNull()
    expect(parseShorthandNumber('')).toBeNull()
  })
})

describe('deriveDcfInputs', () => {
  const annual = [
    { date: '2021-12-31', freeCF: 80 },
    { date: '2022-12-31', freeCF: 90 },
    { date: '2023-12-31', freeCF: 100, cash: 50, cashAndShortTerm: 70, longTermDebt: 20 },
    { date: '2024-12-31', freeCF: 110, cash: 60, cashAndShortTerm: 80, longTermDebt: 25 },
  ]

  it('uses the 3-year annual average when there is no newer quarter', () => {
    const quarterly = []
    const result = deriveDcfInputs({ financialsData: { annual, quarterly }, fundamentalsCacheEntry: null, investment: null })
    expect(result.baseFCF).toBeCloseTo((90 + 100 + 110) / 3, 5)
    expect(result.netCash).toBe(80 - 25)
  })

  it('uses the TTM sum when all 4 trailing quarters are newer and non-null', () => {
    const quarterly = [
      { date: '2025-03-31', freeCF: 30, cash: 65, cashAndShortTerm: 85, longTermDebt: 25 },
      { date: '2024-12-31', freeCF: 28 },
      { date: '2024-09-30', freeCF: 27 },
      { date: '2024-06-30', freeCF: 26 },
    ]
    const result = deriveDcfInputs({ financialsData: { annual, quarterly }, fundamentalsCacheEntry: null, investment: null })
    expect(result.baseFCF).toBe(30 + 28 + 27 + 26)
    expect(result.netCash).toBe(85 - 25)
  })

  it('falls back to the annual average when a trailing quarter has a null freeCF', () => {
    const quarterly = [
      { date: '2025-03-31', freeCF: null },
      { date: '2024-12-31', freeCF: 28 },
      { date: '2024-09-30', freeCF: 27 },
      { date: '2024-06-30', freeCF: 26 },
    ]
    const result = deriveDcfInputs({ financialsData: { annual, quarterly }, fundamentalsCacheEntry: null, investment: null })
    expect(result.baseFCF).toBeCloseTo((90 + 100 + 110) / 3, 5)
  })

  it('computes implied growth as CAGR across all positive-freeCF annual periods', () => {
    const result = deriveDcfInputs({ financialsData: { annual, quarterly: [] }, fundamentalsCacheEntry: null, investment: null })
    const expected = ((110 / 80) ** (1 / 3) - 1) * 100
    expect(result.impliedGrowthPct).toBeCloseTo(expected, 5)
  })

  it('returns null implied growth with fewer than 2 qualifying periods', () => {
    const result = deriveDcfInputs({ financialsData: { annual: [annual[0]], quarterly: [] }, fundamentalsCacheEntry: null, investment: null })
    expect(result.impliedGrowthPct).toBeNull()
  })

  it('reads shares outstanding from the fundamentals cache entry', () => {
    const result = deriveDcfInputs({
      financialsData: { annual, quarterly: [] },
      fundamentalsCacheEntry: { profile: { shareOutstanding: 15000 } },
      investment: null,
    })
    expect(result.sharesOutstanding).toBe(15000 * 1e6)
  })

  it('returns null shares outstanding when there is no cache entry', () => {
    const result = deriveDcfInputs({ financialsData: { annual, quarterly: [] }, fundamentalsCacheEntry: null, investment: null })
    expect(result.sharesOutstanding).toBeNull()
  })

  it('falls back from currentPrice to avgCost on the matching investment', () => {
    const result = deriveDcfInputs({
      financialsData: { annual, quarterly: [] },
      fundamentalsCacheEntry: null,
      investment: { currentPrice: '', avgCost: 150 },
    })
    expect(result.currentPrice).toBe(150)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dcf`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `parseShorthandNumber` and `deriveDcfInputs` in `src/lib/dcf.js`**

```js
export function parseShorthandNumber(input) {
  if (input === null || input === undefined || input === '') return null
  const match = String(input).trim().match(/^(-?\d+(\.\d+)?)\s*([bmkBMK])?$/)
  if (!match) return null
  const value = Number(match[1])
  const suffix = match[3]?.toLowerCase()
  if (suffix === 'b') return value * 1e9
  if (suffix === 'm') return value * 1e6
  if (suffix === 'k') return value * 1e3
  return value
}

function toNum(v) {
  return v === null || v === undefined ? null : Number(v)
}

function average(values) {
  const present = values.filter((v) => v !== null && v !== undefined)
  if (present.length === 0) return null
  return present.reduce((sum, v) => sum + v, 0) / present.length
}

export function deriveDcfInputs({ financialsData, fundamentalsCacheEntry, investment }) {
  const annual = financialsData?.annual ?? []
  const quarterly = financialsData?.quarterly ?? []

  const recentAnnual = [...annual].slice(-3)
  const last4Q = [...quarterly].slice(-4)
  const allQuartersPresent = last4Q.length === 4 && last4Q.every((q) => q.freeCF !== null && q.freeCF !== undefined)
  const latestQuarterDate = quarterly[quarterly.length - 1]?.date
  const latestAnnualDate = annual[annual.length - 1]?.date
  const useTTM = allQuartersPresent && latestQuarterDate && latestAnnualDate && latestQuarterDate > latestAnnualDate

  const basisPeriod = useTTM ? quarterly[quarterly.length - 1] : annual[annual.length - 1]

  const baseFCF = useTTM
    ? last4Q.reduce((sum, q) => sum + q.freeCF, 0)
    : average(recentAnnual.map((p) => p.freeCF))

  const netCash = basisPeriod
    ? (toNum(basisPeriod.cashAndShortTerm) ?? toNum(basisPeriod.cash) ?? 0) - (toNum(basisPeriod.longTermDebt) ?? 0)
    : null

  const positiveFcfAnnual = annual.filter((p) => p.freeCF !== null && p.freeCF > 0)
  let impliedGrowthPct = null
  if (positiveFcfAnnual.length >= 2) {
    const oldest = positiveFcfAnnual[0].freeCF
    const newest = positiveFcfAnnual[positiveFcfAnnual.length - 1].freeCF
    const n = positiveFcfAnnual.length
    impliedGrowthPct = ((newest / oldest) ** (1 / (n - 1)) - 1) * 100
  }

  const sharesOutstanding = fundamentalsCacheEntry?.profile?.shareOutstanding
    ? fundamentalsCacheEntry.profile.shareOutstanding * 1e6
    : null

  const currentPriceRaw = investment?.currentPrice
  const currentPrice = (currentPriceRaw !== '' && currentPriceRaw !== undefined && currentPriceRaw !== null)
    ? Number(currentPriceRaw)
    : (investment?.avgCost ? Number(investment.avgCost) : null)

  return { baseFCF, netCash, impliedGrowthPct, sharesOutstanding, currentPrice }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- dcf`
Expected: PASS (12 tests so far).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dcf.js src/lib/dcf.test.js
git commit -m "feat: add parseShorthandNumber and deriveDcfInputs to dcf.js"
```

---

### Task 3: `dcf.js` — `runDcf`, `marginOfSafety`, `buildSensitivityGrid`

**Files:**
- Modify: `src/lib/dcf.js`
- Modify: `src/lib/dcf.test.js`

**Interfaces:**
- Produces: `runDcf(inputs) -> DcfResult`, `marginOfSafety(intrinsicValue, currentPrice) -> number|null`, `buildSensitivityGrid(inputs) -> Cell[]`. Consumed by Task 4 (`DCFTab`).

- [ ] **Step 1: Write the failing test**

Add to `dcf.test.js`:

```js
import { runDcf, marginOfSafety, buildSensitivityGrid } from './dcf'

describe('runDcf', () => {
  const inputs = { baseFCF: 100, growthRatePct: 10, terminalRatePct: 3, discountRatePct: 10, netCash: 50, sharesOutstanding: 10 }

  it('produces 5 years of mid-year-discounted FCF', () => {
    const result = runDcf(inputs)
    expect(result.years).toHaveLength(5)
    const r = 0.10
    const year1Fcf = 100 * 1.10
    expect(result.years[0].fcf).toBeCloseTo(year1Fcf, 5)
    expect(result.years[0].discounted).toBeCloseTo(year1Fcf / (1 + r) ** 0.5, 5)
    // mid-year discounting means this is NOT equal to full-year discounting
    expect(result.years[0].discounted).not.toBeCloseTo(year1Fcf / (1 + r) ** 1, 5)
  })

  it('discounts the terminal value at a full year 5, not 4.5', () => {
    const result = runDcf(inputs)
    const r = 0.10
    expect(result.pvTerminal).toBeCloseTo(result.terminalValue / (1 + r) ** 5, 5)
  })

  it('computes intrinsic value as total equity value over shares outstanding', () => {
    const result = runDcf(inputs)
    expect(result.intrinsicValue).toBeCloseTo(result.totalEquityValue / 10, 5)
  })

  it('returns null intrinsic value when shares outstanding is null', () => {
    const result = runDcf({ ...inputs, sharesOutstanding: null })
    expect(result.intrinsicValue).toBeNull()
  })
})

describe('marginOfSafety', () => {
  it('computes upside percentage', () => {
    expect(marginOfSafety(120, 100)).toBeCloseTo(20, 5)
  })

  it('returns null when either input is null or currentPrice is 0', () => {
    expect(marginOfSafety(null, 100)).toBeNull()
    expect(marginOfSafety(120, null)).toBeNull()
    expect(marginOfSafety(120, 0)).toBeNull()
  })
})

describe('buildSensitivityGrid', () => {
  const inputs = { baseFCF: 100, growthRatePct: 10, terminalRatePct: 3, netCash: 50, sharesOutstanding: 10, currentPrice: 100 }

  it('produces 30 cells (6 discount rates x 5 growth rates)', () => {
    expect(buildSensitivityGrid(inputs)).toHaveLength(30)
  })

  it('assigns the strong bucket for a high margin of safety', () => {
    const grid = buildSensitivityGrid({ ...inputs, currentPrice: 1 })
    expect(grid.every((c) => c.bucket === 'strong')).toBe(true)
  })

  it('assigns the weak bucket for a very negative margin of safety', () => {
    const grid = buildSensitivityGrid({ ...inputs, currentPrice: 100000 })
    expect(grid.every((c) => c.bucket === 'weak')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dcf`
Expected: FAIL — `runDcf` etc. not exported.

- [ ] **Step 3: Implement in `src/lib/dcf.js`**

```js
export function runDcf({ baseFCF, growthRatePct, terminalRatePct, discountRatePct, netCash, sharesOutstanding }) {
  const r = discountRatePct / 100
  const g = growthRatePct / 100
  const gt = terminalRatePct / 100

  const years = []
  let sumDiscounted = 0
  for (let t = 1; t <= 5; t += 1) {
    const fcf = baseFCF * (1 + g) ** t
    const discounted = fcf / (1 + r) ** (t - 0.5)
    years.push({ year: t, fcf, discounted })
    sumDiscounted += discounted
  }

  const fcfYear5 = baseFCF * (1 + g) ** 5
  const terminalValue = (fcfYear5 * (1 + gt)) / (r - gt)
  const pvTerminal = terminalValue / (1 + r) ** 5
  const totalEquityValue = sumDiscounted + pvTerminal + netCash
  const intrinsicValue = sharesOutstanding ? totalEquityValue / sharesOutstanding : null

  return { years, terminalValue, pvTerminal, totalEquityValue, intrinsicValue }
}

export function marginOfSafety(intrinsicValue, currentPrice) {
  if (intrinsicValue === null || intrinsicValue === undefined) return null
  if (!currentPrice) return null
  return ((intrinsicValue - currentPrice) / currentPrice) * 100
}

function bucketFor(marginPct) {
  if (marginPct === null) return null
  if (marginPct > 20) return 'strong'
  if (marginPct >= 0) return 'good'
  if (marginPct >= -20) return 'caution'
  return 'weak'
}

export function buildSensitivityGrid({ baseFCF, growthRatePct, terminalRatePct, netCash, sharesOutstanding, currentPrice }) {
  const discountRates = [7, 8, 9, 10, 11, 12]
  const growthRates = [-10, -5, 0, 5, 10].map((delta) => Math.min(100, Math.max(-50, growthRatePct + delta)))

  const grid = []
  for (const discountRatePct of discountRates) {
    for (const g of growthRates) {
      const result = runDcf({ baseFCF, growthRatePct: g, terminalRatePct, discountRatePct, netCash, sharesOutstanding })
      const marginPct = marginOfSafety(result.intrinsicValue, currentPrice)
      grid.push({ discountRatePct, growthRatePct: g, marginOfSafetyPct: marginPct, bucket: bucketFor(marginPct) })
    }
  }
  return grid
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- dcf`
Expected: PASS (all dcf.js tests, ~22 total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dcf.js src/lib/dcf.test.js
git commit -m "feat: add runDcf, marginOfSafety, buildSensitivityGrid to dcf.js"
```

---

### Task 4: `DCFTab` component (inputs, results, sensitivity grid, math breakdown — no chart yet)

**Files:**
- Create: `src/components/analysis/DCFTab.jsx`
- Create: `src/components/analysis/DCFTab.css`
- Create: `src/components/analysis/DCFTab.test.jsx`

**Interfaces:**
- Consumes: `useAuth`, `useUserSettings` (existing), `fetchFinancials` (existing), `getSharedCache`/`saveSharedCache` (existing), `deriveDcfInputs`/`runDcf`/`marginOfSafety`/`buildSensitivityGrid`/`parseShorthandNumber` (Tasks 2–3), `formatLarge`/`formatCurrency` (existing).
- Props: `{ investments }`.

- [ ] **Step 1: Write the failing tests**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DCFTab from './DCFTab'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFinancials } from '../../lib/fetchFinancials'
import { getSharedCache, saveSharedCache } from '../../lib/financialsSharedCache'

vi.mock('../../hooks/useAuth')
vi.mock('../../hooks/useUserSettings')
vi.mock('../../lib/fetchFinancials')
vi.mock('../../lib/financialsSharedCache')

const investments = [
  { id: 'i1', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 165 },
]

const sampleData = {
  annual: [
    { date: '2022-12-31', freeCF: 80, cash: 40, cashAndShortTerm: 60, longTermDebt: 20 },
    { date: '2023-12-31', freeCF: 90, cash: 45, cashAndShortTerm: 65, longTermDebt: 22 },
    { date: '2024-12-31', freeCF: 100, cash: 50, cashAndShortTerm: 70, longTermDebt: 25 },
  ],
  quarterly: [],
}

describe('DCFTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    getSharedCache.mockResolvedValue(null)
    saveSharedCache.mockResolvedValue(undefined)
    localStorage.clear()
  })

  it('shows a Key Required state when there is no Alpha Vantage key', () => {
    useUserSettings.mockReturnValue({ avKey: '', finnhubKey: '', loading: false })
    render(<MemoryRouter><DCFTab investments={investments} /></MemoryRouter>)
    expect(screen.getByText(/key required/i)).toBeInTheDocument()
  })

  it('auto-researches the first stock and renders intrinsic value results', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)

    render(<MemoryRouter><DCFTab investments={investments} /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('Intrinsic Value')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'AAPL' })).toHaveClass('fin-chip--active')
  })

  it('renders the 30-cell sensitivity grid', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)

    render(<MemoryRouter><DCFTab investments={investments} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Intrinsic Value')).toBeInTheDocument())

    expect(screen.getAllByTestId('sensitivity-cell')).toHaveLength(30)
  })

  it('updates results when the Base FCF override is changed', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)

    render(<MemoryRouter><DCFTab investments={investments} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Intrinsic Value')).toBeInTheDocument())

    const before = screen.getByTestId('intrinsic-value').textContent
    const baseFcfInput = screen.getByLabelText(/base fcf/i)
    await userEvent.clear(baseFcfInput)
    await userEvent.type(baseFcfInput, '10B')

    await waitFor(() => expect(screen.getByTestId('intrinsic-value').textContent).not.toBe(before))
  })

  it('does not crash when there is only 1 annual period (no implied growth)', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue({ annual: [sampleData.annual[0]], quarterly: [] })

    render(<MemoryRouter><DCFTab investments={investments} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Intrinsic Value')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DCFTab`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/components/analysis/DCFTab.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './DCFTab.css'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFinancials } from '../../lib/fetchFinancials'
import { getSharedCache, saveSharedCache } from '../../lib/financialsSharedCache'
import { deriveDcfInputs, runDcf, marginOfSafety, buildSensitivityGrid, parseShorthandNumber } from '../../lib/dcf'
import { formatLarge, formatCurrency } from '../../lib/format'

function getFundamentalsCacheEntry(symbol) {
  const raw = localStorage.getItem('bt_fundamentals_cache')
  if (!raw) return null
  return JSON.parse(raw)[symbol] ?? null
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export default function DCFTab({ investments }) {
  const { user } = useAuth()
  const { avKey, loading: settingsLoading } = useUserSettings(user?.id)
  const [data, setData] = useState({})
  const [activeSymbol, setActiveSymbol] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [loadingSymbol, setLoadingSymbol] = useState(null)
  const [overrides, setOverrides] = useState({})

  const stockSymbols = [...new Set(investments.filter((i) => i.assetType === 'Stock').map((i) => i.symbol))]

  async function research(rawSymbol) {
    const symbol = rawSymbol.trim().toUpperCase()
    if (!symbol) return
    setActiveSymbol(symbol)
    setInputValue('')
    setOverrides({})
    if (data[symbol]) return

    const cacheRaw = localStorage.getItem('bt_financials_cache')
    const localCache = cacheRaw ? JSON.parse(cacheRaw) : {}
    if (localCache[symbol]) {
      setData((prev) => ({ ...prev, [symbol]: localCache[symbol] }))
      return
    }

    const shared = await getSharedCache(symbol)
    if (shared) {
      setData((prev) => ({ ...prev, [symbol]: shared }))
      localCache[symbol] = shared
      localStorage.setItem('bt_financials_cache', JSON.stringify(localCache))
      return
    }

    if (!avKey) return
    setLoadingSymbol(symbol)
    const result = await fetchFinancials(symbol, avKey)
    setData((prev) => ({ ...prev, [symbol]: result }))
    setLoadingSymbol(null)

    localCache[symbol] = result
    localStorage.setItem('bt_financials_cache', JSON.stringify(localCache))
    await saveSharedCache(symbol, result, user?.id)
  }

  useEffect(() => {
    if (avKey && !activeSymbol && stockSymbols.length > 0) {
      research(stockSymbols[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avKey, stockSymbols.length])

  if (!settingsLoading && !avKey) {
    return (
      <div className="fin-key-required">
        <p>Key Required</p>
        <p>Add your Alpha Vantage API key in Settings to run a DCF valuation.</p>
        <Link to="/settings">Go to Settings</Link>
      </div>
    )
  }

  const financialsData = activeSymbol ? data[activeSymbol] : null
  const investment = activeSymbol ? investments.find((i) => i.symbol === activeSymbol) : null
  const fundamentalsCacheEntry = activeSymbol ? getFundamentalsCacheEntry(activeSymbol) : null

  const derived = financialsData
    ? deriveDcfInputs({ financialsData, fundamentalsCacheEntry, investment })
    : { baseFCF: null, netCash: null, impliedGrowthPct: null, sharesOutstanding: null, currentPrice: null }

  const baseFCF = overrides.baseFCF ?? derived.baseFCF ?? 0
  const netCash = overrides.netCash ?? derived.netCash ?? 0
  const sharesOutstanding = overrides.sharesOutstanding ?? derived.sharesOutstanding
  const currentPrice = overrides.currentPrice ?? derived.currentPrice
  const growthRatePct = overrides.growthRatePct ?? clamp(derived.impliedGrowthPct ?? 10, -30, 60)
  const terminalRatePct = overrides.terminalRatePct ?? 3
  const discountRatePct = overrides.discountRatePct ?? 10

  const result = financialsData
    ? runDcf({ baseFCF, growthRatePct, terminalRatePct, discountRatePct, netCash, sharesOutstanding })
    : null
  const margin = result ? marginOfSafety(result.intrinsicValue, currentPrice) : null
  const grid = financialsData
    ? buildSensitivityGrid({ baseFCF, growthRatePct, terminalRatePct, netCash, sharesOutstanding, currentPrice })
    : []

  function setOverride(key, value) {
    setOverrides((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="dcf-tab">
      <div className="fin-symbol-picker">
        {stockSymbols.map((symbol) => (
          <button
            key={symbol}
            type="button"
            className={`fin-chip${symbol === activeSymbol ? ' fin-chip--active' : ''}`}
            onClick={() => research(symbol)}
          >
            {symbol}
          </button>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); research(inputValue) }}>
          <label htmlFor="dcfAddSymbol">Add symbol</label>
          <input
            id="dcfAddSymbol"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); research(inputValue) } }}
          />
        </form>
      </div>

      {loadingSymbol && <p>Loading {loadingSymbol}…</p>}

      {financialsData && result && (
        <div className="dcf-panels">
          <section className="dcf-inputs">
            <h2>Inputs</h2>
            <div className="dcf-input-grid">
              <label>
                Base FCF
                <input value={overrides.baseFcfText ?? formatLarge(baseFCF)} onChange={(e) => {
                  setOverride('baseFcfText', e.target.value)
                  const parsed = parseShorthandNumber(e.target.value)
                  if (parsed !== null) setOverride('baseFCF', parsed)
                }} />
              </label>
              <label>
                Net Cash/Debt
                <input value={overrides.netCashText ?? formatLarge(netCash)} onChange={(e) => {
                  setOverride('netCashText', e.target.value)
                  const parsed = parseShorthandNumber(e.target.value)
                  if (parsed !== null) setOverride('netCash', parsed)
                }} />
              </label>
              <label>
                Shares Outstanding
                <input value={sharesOutstanding ?? ''} onChange={(e) => setOverride('sharesOutstanding', Number(e.target.value) || null)} />
              </label>
              <label>
                Current Price
                <input value={currentPrice ?? ''} onChange={(e) => setOverride('currentPrice', Number(e.target.value) || null)} />
              </label>
              <label>
                FCF Growth Rate Yr1-5: {growthRatePct.toFixed(1)}%
                <input type="range" min="-30" max="60" value={growthRatePct} onChange={(e) => setOverride('growthRatePct', Number(e.target.value))} />
              </label>
              <label>
                Terminal Growth Rate: {terminalRatePct.toFixed(1)}%
                <input type="range" min="0" max="6" step="0.1" value={terminalRatePct} onChange={(e) => setOverride('terminalRatePct', Number(e.target.value))} />
              </label>
              <label>
                Discount Rate (WACC): {discountRatePct.toFixed(1)}%
                <input type="range" min="5" max="20" step="0.5" value={discountRatePct} onChange={(e) => setOverride('discountRatePct', Number(e.target.value))} />
              </label>
            </div>
          </section>

          <section className="dcf-results">
            <h2>Intrinsic Value</h2>
            <div className="dcf-result-tiles">
              <div className="dcf-result-tile">
                <span className="dcf-result-label">Intrinsic Value / Share</span>
                <span className="dcf-result-value mono" data-testid="intrinsic-value">
                  {result.intrinsicValue !== null ? formatCurrency(result.intrinsicValue) : '—'}
                </span>
              </div>
              <div className="dcf-result-tile">
                <span className="dcf-result-label">Current Price</span>
                <span className="dcf-result-value mono">{currentPrice ? formatCurrency(currentPrice) : '—'}</span>
              </div>
              <div className="dcf-result-tile">
                <span className="dcf-result-label">Margin of Safety</span>
                <span className={`dcf-result-value mono ${margin !== null ? (margin >= 0 ? 'dcf-positive' : 'dcf-negative') : ''}`}>
                  {margin !== null ? `${margin.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
          </section>

          <section className="dcf-years">
            <h2>Year-by-Year FCF</h2>
            <table className="dcf-table">
              <thead><tr><th>Year</th><th>Projected FCF</th><th>PV</th></tr></thead>
              <tbody>
                {result.years.map((y) => (
                  <tr key={y.year}>
                    <td>Year {y.year}</td>
                    <td className="mono">{formatLarge(y.fcf)}</td>
                    <td className="mono">{formatLarge(y.discounted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dcf-sensitivity">
            <h2>Sensitivity Grid</h2>
            <table className="dcf-table">
              <thead>
                <tr>
                  <th>Discount \ Growth</th>
                  {[...new Set(grid.map((c) => c.growthRatePct))].map((g) => <th key={g}>{g.toFixed(0)}%</th>)}
                </tr>
              </thead>
              <tbody>
                {[...new Set(grid.map((c) => c.discountRatePct))].map((d) => (
                  <tr key={d}>
                    <td>{d}%</td>
                    {grid.filter((c) => c.discountRatePct === d).map((c) => (
                      <td key={c.growthRatePct} data-testid="sensitivity-cell" className={`dcf-cell-${c.bucket}`}>
                        {c.marginOfSafetyPct !== null ? `${c.marginOfSafetyPct.toFixed(0)}%` : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dcf-breakdown">
            <h2>Math Breakdown</h2>
            <p>Base FCF: {formatLarge(baseFCF)}, grown at {growthRatePct.toFixed(1)}%/yr for 5 years, discounted at {discountRatePct.toFixed(1)}% (mid-year convention).</p>
            <p>Terminal Value: Year 5 FCF × (1 + {terminalRatePct.toFixed(1)}%) / ({discountRatePct.toFixed(1)}% − {terminalRatePct.toFixed(1)}%) = {formatLarge(result.terminalValue)}, discounted to {formatLarge(result.pvTerminal)}.</p>
            <p>Total Equity Value = Σ PV(FCF) + PV(Terminal) + Net Cash = {formatLarge(result.totalEquityValue)}.</p>
            <p>Intrinsic Value / Share = Total Equity Value ÷ Shares Outstanding{sharesOutstanding ? ` (${sharesOutstanding.toLocaleString()})` : ' (unknown — enter shares outstanding above)'}.</p>
          </section>
        </div>
      )}
    </div>
  )
}
```

Note: the Base FCF / Net Cash text inputs track a raw text override
(`baseFcfText`/`netCashText`) separately from the parsed numeric override so
the user can type freely (including partial input like `"10"` before adding
`"B"`) without the field snapping back to a formatted value mid-keystroke.

- [ ] **Step 4: Add `src/components/analysis/DCFTab.css`**

Match `FinancialsTab.css`'s conventions for `.dcf-tab` (reuse `fin-symbol-picker`/`fin-chip`/`fin-key-required` classes via `FinancialsTab.css` already being loaded), plus:

```css
.dcf-panels {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding-top: 16px;
}

.dcf-input-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.dcf-input-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

.dcf-input-grid input {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 8px;
  font-size: 13px;
  font-weight: 400;
  text-transform: none;
}

.dcf-result-tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.dcf-result-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dcf-result-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

.dcf-result-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}

.dcf-positive { color: var(--green); }
.dcf-negative { color: var(--red); }

.dcf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.dcf-table th, .dcf-table td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  text-align: right;
}

.dcf-table th:first-child, .dcf-table td:first-child {
  text-align: left;
  color: var(--text-dim);
}

.dcf-cell-strong { background: rgba(34, 197, 94, 0.25); }
.dcf-cell-good { background: rgba(34, 197, 94, 0.1); }
.dcf-cell-caution { background: rgba(234, 179, 8, 0.15); }
.dcf-cell-weak { background: rgba(239, 68, 68, 0.2); }

.dcf-breakdown p {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.6;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- DCFTab`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/DCFTab.jsx src/components/analysis/DCFTab.css src/components/analysis/DCFTab.test.jsx
git commit -m "feat: implement DCF tab core (inputs, results, sensitivity grid, math breakdown)"
```

---

### Task 5: FCF historical + projected chart

**Files:**
- Modify: `src/components/analysis/DCFTab.jsx`
- Modify: `src/components/analysis/DCFTab.css`
- Modify: `src/components/analysis/DCFTab.test.jsx`

**Interfaces:** none new — purely additive to `DCFTab.jsx`.

- [ ] **Step 1: Invoke the dataviz skill before writing chart code**

Re-read the dataviz skill's guidance (already established this session):
single y-axis, thin marks, hairline gridlines, `itemStyle`/`labelStyle` on
every `Tooltip` (the fix already applied to `FinancialsCharts.jsx`), a
legend when ≥2 series. This chart is a single series (historical + a
visually-distinct projected segment), so no categorical palette decision
needed — reuse the app's existing blue (`#3987e5`) for historical and a
lighter/dashed treatment for the projected segment.

- [ ] **Step 2: Write the failing test**

Add to `DCFTab.test.jsx`:

```jsx
it('renders the FCF history and projection chart', async () => {
  useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
  fetchFinancials.mockResolvedValue(sampleData)

  render(<MemoryRouter><DCFTab investments={investments} /></MemoryRouter>)
  await waitFor(() => expect(screen.getByText('Intrinsic Value')).toBeInTheDocument())

  expect(screen.getByText('FCF History & Projection')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- DCFTab`
Expected: FAIL — chart section doesn't exist yet.

- [ ] **Step 4: Add the chart to `DCFTab.jsx`**

Import recharts pieces and add a data-building step + a new section between
"Year-by-Year FCF" and "Sensitivity Grid":

```jsx
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
```

```js
function buildFcfChartData(financialsData, years) {
  const historical = (financialsData.annual ?? []).map((p) => ({ date: p.date, historicalFCF: p.freeCF, projectedFCF: null }))
  const lastHistorical = historical[historical.length - 1]
  const projected = years.map((y) => ({ date: `Year ${y.year}`, historicalFCF: null, projectedFCF: y.fcf }))
  if (lastHistorical) projected[0] = { ...projected[0], projectedFCF: projected[0].projectedFCF, historicalFCF: null }
  return [...historical, ...projected]
}
```

```jsx
<section className="dcf-chart-section">
  <h2>FCF History & Projection</h2>
  <ResponsiveContainer width="100%" height={260}>
    <LineChart data={buildFcfChartData(financialsData, result.years)} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
      <CartesianGrid stroke="#262626" strokeDasharray="0" vertical={false} />
      <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#262626' }} tickLine={false} />
      <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#262626' }} tickLine={false} tickFormatter={(v) => formatLarge(v)} width={70} />
      <Tooltip
        contentStyle={{ background: '#141414', border: '1px solid #262626', borderRadius: 6, fontSize: 12 }}
        itemStyle={{ color: '#e5e5e5' }}
        labelStyle={{ color: '#888' }}
        formatter={(v) => formatLarge(v)}
      />
      <Legend wrapperStyle={{ fontSize: 11, color: '#888' }} />
      <Line type="monotone" dataKey="historicalFCF" name="Historical FCF" stroke="#3987e5" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
      <Line type="monotone" dataKey="projectedFCF" name="Projected FCF" stroke="#3987e5" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} connectNulls />
    </LineChart>
  </ResponsiveContainer>
</section>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- DCFTab`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/DCFTab.jsx src/components/analysis/DCFTab.css src/components/analysis/DCFTab.test.jsx
git commit -m "feat: add FCF history + projection chart to DCF tab"
```

---

### Task 6: Page wiring

**Files:**
- Modify: `src/pages/AnalyzePage.jsx`
- Modify: `src/pages/AnalyzePage.test.jsx`

- [ ] **Step 1: Wire `DCFTab` into `AnalyzePage.jsx`**

Import `DCFTab`, render it for `tab === 'dcf'` in place of the placeholder,
following the exact same pattern as `financials`/`research`.

- [ ] **Step 2: Update `AnalyzePage.test.jsx`**

Change the "Coming soon" test to target `frontier` instead of `dcf`. Mock
`fetchFinancials`/`financialsSharedCache` if `AnalyzePage`'s default render
path would otherwise trigger real calls (it won't — `DCFTab` only renders
when `tab === 'dcf'`, and the default tab is `research`, so no new mocks
should be needed; verify by running the tests).

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- AnalyzePage`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AnalyzePage.jsx src/pages/AnalyzePage.test.jsx
git commit -m "feat: wire DCF tab into AnalyzePage"
```

---

### Task 7: Full suite + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (340 existing + ~30 new from this plan).

- [ ] **Step 2: Restart dev server, manual smoke test**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

At `/analyze` → DCF: with a real Alpha Vantage key, confirm a stock
auto-loads, intrinsic value/margin of safety render, overriding Base FCF
(try `"10B"` shorthand) updates the results, the sensitivity grid is
colored sensibly, and the FCF chart renders. Cross-check the intrinsic
value against a manual calculation for one symbol.

- [ ] **Step 3: Report completion**

No commit needed for this task unless smoke testing surfaces a bug — fix
as a new small commit and re-run Step 1.
