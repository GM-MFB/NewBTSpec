# Analyze Tab — Phase 1 (Shell + Fundamentals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `/analyze` to a real tab-router shell (9 tabs, 8 "Coming soon") and build a working Fundamentals tab: single-ticker Finnhub dashboard with symbol chips from open Stock investments, ETF short-circuit, and stat panels.

**Architecture:** `AnalyzePage.jsx` owns tab state and renders `FundamentalsTab` (or a placeholder) per active tab. `FundamentalsTab` owns its own in-memory `{symbol: data}` map, fetched via `fetchFundamentals`/`fetchPeers` in `src/lib/fetchFundamentals.js`. ETF tickers (`src/lib/knownEtfs.js`) skip fetching entirely.

**Tech Stack:** React 19, Vitest + @testing-library/react. No new dependencies.

## Global Constraints

- Do not change Supabase table/column names — no new queries beyond the existing `useInvestments`/`useUserSettings` hooks.
- Match existing app conventions: camelCase JS, dark/mono CSS tokens (`--bg`, `--bg-elevated`, `--border`, `--text`, `--text-dim`, `--green`, `--red`), `formatCurrency`/`formatCurrencyAuto` from `src/lib/format.js`.
- TDD throughout: failing test → implementation → passing test → commit, per task.
- No new tabs beyond Fundamentals get real content this phase — the other 8 must render a placeholder, not be omitted from the tab bar.

---

### Task 1: `formatLarge` helper

**Files:**
- Modify: `src/lib/format.js`
- Modify: `src/lib/format.test.js`

**Interfaces:**
- Produces: `formatLarge(value) -> string` — `$` with T/B/M suffix by magnitude (≥1e12 → T, ≥1e9 → B, ≥1e6 → M, else plain currency via `formatCurrency`). Blank/NaN input → `''`, matching the other formatters.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/format.test.js`:

```js
import { formatLarge } from './format'

describe('formatLarge', () => {
  it('formats trillions with a T suffix', () => {
    expect(formatLarge(2_400_000_000_000)).toBe('$2.40T')
  })

  it('formats billions with a B suffix', () => {
    expect(formatLarge(850_000_000)).toBe('$850.00M')
  })

  it('formats millions with an M suffix', () => {
    expect(formatLarge(4_200_000)).toBe('$4.20M')
  })

  it('formats sub-million values as plain currency', () => {
    expect(formatLarge(4200)).toBe('$4,200.00')
  })

  it('returns blank for blank input', () => {
    expect(formatLarge('')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- format`
Expected: FAIL — `formatLarge` not exported.

- [ ] **Step 3: Implement in `src/lib/format.js`**

```js
export function formatLarge(value) {
  if (value === '' || value === undefined || value === null || Number.isNaN(Number(value))) return ''
  const n = Number(value)
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return formatCurrency(n)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- format`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.js src/lib/format.test.js
git commit -m "feat: add formatLarge helper for T/B/M-suffixed currency"
```

---

### Task 2: `KNOWN_ETFS`

**Files:**
- Create: `src/lib/knownEtfs.js`
- Create: `src/lib/knownEtfs.test.js`

**Interfaces:**
- Produces: `KNOWN_ETFS: Set<string>`, consumed by Task 5 (`FundamentalsTab`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { KNOWN_ETFS } from './knownEtfs'

describe('KNOWN_ETFS', () => {
  it('includes common ETF tickers', () => {
    expect(KNOWN_ETFS.has('SPY')).toBe(true)
    expect(KNOWN_ETFS.has('QQQ')).toBe(true)
    expect(KNOWN_ETFS.has('GLD')).toBe(true)
  })

  it('does not include ordinary stock tickers', () => {
    expect(KNOWN_ETFS.has('AAPL')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- knownEtfs`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```js
export const KNOWN_ETFS = new Set([
  'SPY', 'QQQ', 'VOO', 'VTI', 'DIA', 'IWM', 'MDY',
  'XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC',
  'GLD', 'SLV', 'TLT', 'IEF', 'SHY', 'HYG', 'LQD',
  'EEM', 'EFA', 'VEA', 'VWO',
  'ARKK', 'SMH', 'SOXX', 'XBI', 'IBB', 'VNQ',
  'BND', 'AGG', 'SCHD', 'VIG', 'VYM', 'JEPI', 'JEPQ',
])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- knownEtfs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knownEtfs.js src/lib/knownEtfs.test.js
git commit -m "feat: add KNOWN_ETFS list for Fundamentals ETF short-circuit"
```

---

### Task 3: `fetchFundamentals` / `fetchPeers`

**Files:**
- Create: `src/lib/fetchFundamentals.js`
- Create: `src/lib/fetchFundamentals.test.js`

**Interfaces:**
- Produces:
  - `fetchFundamentals(symbol, apiKey) -> Promise<{ profile, quote, metrics, recs, targets, news, earnings }>`
  - `fetchPeers(symbol, apiKey) -> Promise<string[]>`
- Consumed by Task 5 (`FundamentalsTab`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchFundamentals, fetchPeers } from './fetchFundamentals'

describe('fetchFundamentals', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  function jsonResponse(body) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
  }

  it('fetches all 7 pieces and shapes the result', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/stock/profile2')) return jsonResponse({ name: 'Apple Inc' })
      if (url.includes('/quote')) return jsonResponse({ c: 150 })
      if (url.includes('/stock/metric')) return jsonResponse({ metric: { peTTM: 25 } })
      if (url.includes('/stock/recommendation')) return jsonResponse([{ buy: 10 }, { buy: 5 }])
      if (url.includes('/stock/price-target')) return jsonResponse({ targetMean: 200 })
      if (url.includes('/company-news')) return jsonResponse(Array.from({ length: 12 }, (_, i) => ({ id: i })))
      if (url.includes('/stock/earnings')) return jsonResponse({ earnings: [{ actual: 1 }] })
      return jsonResponse({})
    })

    const result = await fetchFundamentals('AAPL', 'key123')

    expect(result.profile).toEqual({ name: 'Apple Inc' })
    expect(result.quote).toEqual({ c: 150 })
    expect(result.metrics).toEqual({ peTTM: 25 })
    expect(result.recs).toEqual({ buy: 10 })
    expect(result.targets).toEqual({ targetMean: 200 })
    expect(result.news).toHaveLength(8)
    expect(result.earnings).toEqual({ earnings: [{ actual: 1 }] })
  })

  it('resolves with null for a piece whose request fails, without rejecting the whole call', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/stock/profile2')) return Promise.reject(new Error('network error'))
      return jsonResponse({})
    })

    const result = await fetchFundamentals('AAPL', 'key123')
    expect(result.profile).toBeNull()
  })
})

describe('fetchPeers', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('returns the peers array', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(['MSFT', 'GOOGL']) })
    const peers = await fetchPeers('AAPL', 'key123')
    expect(peers).toEqual(['MSFT', 'GOOGL'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fetchFundamentals`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/lib/fetchFundamentals.js`**

```js
const BASE = 'https://finnhub.io/api/v1'

async function safeFetchJson(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoISO(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function fetchFundamentals(symbol, apiKey) {
  const [profile, quote, metric, recs, targets, news, earnings] = await Promise.allSettled([
    safeFetchJson(`${BASE}/stock/profile2?symbol=${symbol}&token=${apiKey}`),
    safeFetchJson(`${BASE}/quote?symbol=${symbol}&token=${apiKey}`),
    safeFetchJson(`${BASE}/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`),
    safeFetchJson(`${BASE}/stock/recommendation?symbol=${symbol}&token=${apiKey}`),
    safeFetchJson(`${BASE}/stock/price-target?symbol=${symbol}&token=${apiKey}`),
    safeFetchJson(`${BASE}/company-news?symbol=${symbol}&from=${daysAgoISO(30)}&to=${todayISO()}&token=${apiKey}`),
    safeFetchJson(`${BASE}/stock/earnings?symbol=${symbol}&token=${apiKey}`),
  ])

  const value = (r) => (r.status === 'fulfilled' ? r.value : null)
  const newsList = value(news)

  return {
    profile: value(profile),
    quote: value(quote),
    metrics: value(metric)?.metric ?? null,
    recs: Array.isArray(value(recs)) ? value(recs)[0] ?? null : null,
    targets: value(targets),
    news: Array.isArray(newsList) ? newsList.slice(0, 8) : [],
    earnings: value(earnings),
  }
}

export async function fetchPeers(symbol, apiKey) {
  const peers = await safeFetchJson(`${BASE}/stock/peers?symbol=${symbol}&token=${apiKey}`)
  return Array.isArray(peers) ? peers : []
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- fetchFundamentals`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchFundamentals.js src/lib/fetchFundamentals.test.js
git commit -m "feat: add fetchFundamentals/fetchPeers Finnhub aggregate fetchers"
```

---

### Task 4: `AnalyzePage` shell with tab router

**Files:**
- Create: `src/pages/AnalyzePage.jsx`
- Create: `src/pages/AnalyzePage.css`
- Create: `src/pages/AnalyzePage.test.jsx`
- Modify: `src/App.jsx` (swap `/analyze` route from `PlaceholderPage` to `AnalyzePage`)
- Modify: `src/App.test.jsx` (add a route test)

**Interfaces:**
- Consumes: `useAuth`, `useAccounts`, `useInvestments` (existing hooks), `FundamentalsTab` (Task 5 — stub it here, replace in Task 5).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Write the failing test**

Create `src/pages/AnalyzePage.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AnalyzePage from './AnalyzePage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useInvestments')

function mockCommon() {
  useAuth.mockReturnValue({ user: { id: 'u1' } })
  useAccounts.mockReturnValue({
    accounts: [{ id: 'a1', name: 'Main Account' }],
    activeAccount: { id: 'a1', name: 'Main Account' },
    activeAccountId: 'a1',
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
    loading: false,
  })
  useInvestments.mockReturnValue({ investments: [], loading: false, error: null, reload: vi.fn() })
}

describe('AnalyzePage', () => {
  it('defaults to the Fundamentals tab', () => {
    mockCommon()
    render(<MemoryRouter><AnalyzePage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /^fundamentals$/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders all 9 tabs', () => {
    mockCommon()
    render(<MemoryRouter><AnalyzePage /></MemoryRouter>)
    for (const label of ['Fundamentals', 'Financials', 'Research', 'DCF', 'Frontier', 'Optimizer', 'Risk', 'Wheel', 'Screener']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeInTheDocument()
    }
  })

  it('shows a Coming soon placeholder for an unbuilt tab', async () => {
    mockCommon()
    render(<MemoryRouter><AnalyzePage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /^financials$/i }))
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AnalyzePage`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/pages/AnalyzePage.jsx`**

```jsx
import { useState } from 'react'
import './AnalyzePage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'
import Header from '../components/Header'
import FundamentalsTab from '../components/analysis/FundamentalsTab'

const TABS = [
  { key: 'fundamentals', label: 'Fundamentals' },
  { key: 'financials', label: 'Financials' },
  { key: 'research', label: 'Research' },
  { key: 'dcf', label: 'DCF' },
  { key: 'frontier', label: 'Frontier' },
  { key: 'optimizer', label: 'Optimizer' },
  { key: 'risk', label: 'Risk' },
  { key: 'wheel', label: 'Wheel' },
  { key: 'screener', label: 'Screener' },
]

function AnalyzeTabPlaceholder({ label }) {
  return <p className="analyze-tab-placeholder">{label} — Coming soon.</p>
}

export default function AnalyzePage() {
  const { user } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount } = useAccounts(user?.id)
  const { investments } = useInvestments(activeAccountId)
  const [tab, setTab] = useState('fundamentals')

  return (
    <div data-testid="analyze-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        showAddButton={false}
      />

      <div className="analyze-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fundamentals' ? (
        <FundamentalsTab investments={investments} />
      ) : (
        <AnalyzeTabPlaceholder label={TABS.find((t) => t.key === tab).label} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add a temporary `FundamentalsTab` stub so the page compiles**

Create `src/components/analysis/FundamentalsTab.jsx` (replaced fully in Task 5):

```jsx
export default function FundamentalsTab() {
  return <div data-testid="fundamentals-tab" />
}
```

- [ ] **Step 5: Wire `App.jsx`**

In `src/App.jsx`, import `AnalyzePage` and replace the `/analyze` route's
`<PlaceholderPage title="Analyze" />` with `<AnalyzePage />`. Remove the
`PlaceholderPage` import only if `/matt-cap` no longer needs it (it does —
leave that import in place).

- [ ] **Step 6: Add an `App.test.jsx` route test**

Add a test mirroring the existing `/stats` route test, mocking `useInvestments`
in addition to the other hooks, asserting `getByTestId('analyze-page')`
renders at `/analyze`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- AnalyzePage App.test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/AnalyzePage.jsx src/pages/AnalyzePage.css src/pages/AnalyzePage.test.jsx src/components/analysis/FundamentalsTab.jsx src/App.jsx src/App.test.jsx
git commit -m "feat: wire /analyze to a real tab-router shell (Fundamentals live, 8 tabs Coming soon)"
```

---

### Task 5: `FundamentalsTab` — symbol picker, key-required state, ETF short-circuit

**Files:**
- Modify: `src/components/analysis/FundamentalsTab.jsx` (replace stub)
- Create: `src/components/analysis/FundamentalsTab.test.jsx`

**Interfaces:**
- Consumes: `useUserSettings` (existing hook, `finnhubKey`), `fetchFundamentals`/`fetchPeers` (Task 3), `KNOWN_ETFS` (Task 2), `unrealizedPnlFor` (existing, `investmentStats.js`), `formatCurrency`/`formatCurrencyAuto`/`formatLarge` (Task 1 + existing).
- Props: `{ investments }` — open investments array from `AnalyzePage` (Task 4).

- [ ] **Step 1: Write the failing tests**

Create `src/components/analysis/FundamentalsTab.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FundamentalsTab from './FundamentalsTab'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFundamentals, fetchPeers } from '../../lib/fetchFundamentals'

vi.mock('../../hooks/useUserSettings')
vi.mock('../../lib/fetchFundamentals')

const investments = [
  { id: 'i1', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 165 },
]

describe('FundamentalsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchPeers.mockResolvedValue([])
  })

  it('shows a Key Required state when there is no Finnhub key', () => {
    useUserSettings.mockReturnValue({ finnhubKey: '', avKey: '', loading: false })
    render(<FundamentalsTab investments={investments} />)
    expect(screen.getByText(/key required/i)).toBeInTheDocument()
  })

  it('shows a symbol chip for each open stock investment', () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    render(<FundamentalsTab investments={investments} />)
    expect(screen.getByRole('button', { name: 'AAPL' })).toBeInTheDocument()
  })

  it('fetches and renders the Valuation panel when a symbol chip is clicked', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockResolvedValue({
      profile: { name: 'Apple Inc', exchange: 'NASDAQ', finnhubIndustry: 'Technology' },
      quote: { c: 165, pc: 160, h: 167, l: 159 },
      metrics: { peBasicExclExtraTTM: 28, marketCapitalization: 2_500_000 },
      recs: null,
      targets: null,
      news: [],
      earnings: null,
    })

    render(<FundamentalsTab investments={investments} />)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Valuation')).toBeInTheDocument())
    expect(screen.getByText('Apple Inc')).toBeInTheDocument()
  })

  it('shows Your Position for a symbol that matches an open investment', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockResolvedValue({
      profile: { name: 'Apple Inc' }, quote: { c: 165, pc: 160 }, metrics: {}, recs: null, targets: null, news: [], earnings: null,
    })

    render(<FundamentalsTab investments={investments} />)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Your Position')).toBeInTheDocument())
  })

  it('shows the ETF info card and skips fetching for a known ETF', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    render(<FundamentalsTab investments={investments} />)

    await userEvent.type(screen.getByLabelText(/add symbol/i), 'SPY{enter}')

    expect(await screen.findByText(/no financials available for etfs/i)).toBeInTheDocument()
    expect(fetchFundamentals).not.toHaveBeenCalled()
  })

  it('does not crash the Valuation panel when metrics is null', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockResolvedValue({
      profile: { name: 'Apple Inc' }, quote: { c: 165, pc: 160 }, metrics: null, recs: null, targets: null, news: [], earnings: null,
    })

    render(<FundamentalsTab investments={investments} />)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Apple Inc')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FundamentalsTab`
Expected: FAIL — real component not implemented yet (stub renders nothing matching).

- [ ] **Step 3: Implement `src/components/analysis/FundamentalsTab.jsx`**

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import './FundamentalsTab.css'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFundamentals, fetchPeers } from '../../lib/fetchFundamentals'
import { KNOWN_ETFS } from '../../lib/knownEtfs'
import { unrealizedPnlFor } from '../../lib/investmentStats'
import { formatCurrency, formatCurrencyAuto, formatLarge } from '../../lib/format'

function toneFor(value, { greenAbove, redAbove, greenBelow, redBelow } = {}) {
  if (value === undefined || value === null) return ''
  if (redAbove !== undefined && value > redAbove) return 'negative'
  if (greenAbove !== undefined && value > greenAbove) return 'positive'
  if (redBelow !== undefined && value < redBelow) return 'negative'
  if (greenBelow !== undefined && value < greenBelow) return 'positive'
  return ''
}

function StatTile({ label, value, tone }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="fund-stat-tile">
      <span className="fund-stat-label">{label}</span>
      <span className={`fund-stat-value mono ${tone ? `fund-stat-value--${tone}` : ''}`}>{value}</span>
    </div>
  )
}

export default function FundamentalsTab({ investments }) {
  const { finnhubKey, loading: settingsLoading } = useUserSettings()
  const [data, setData] = useState({})
  const [peers, setPeers] = useState({})
  const [activeSymbol, setActiveSymbol] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [loadingSymbol, setLoadingSymbol] = useState(null)

  const stockSymbols = [...new Set(investments.filter((i) => i.assetType === 'Stock').map((i) => i.symbol))]

  async function research(rawSymbol) {
    const symbol = rawSymbol.trim().toUpperCase()
    if (!symbol) return
    setActiveSymbol(symbol)
    setInputValue('')
    if (KNOWN_ETFS.has(symbol) || data[symbol]) return

    setLoadingSymbol(symbol)
    const [result, peerList] = await Promise.all([
      fetchFundamentals(symbol, finnhubKey),
      fetchPeers(symbol, finnhubKey),
    ])
    setData((prev) => ({ ...prev, [symbol]: result }))
    setPeers((prev) => ({ ...prev, [symbol]: peerList }))
    setLoadingSymbol(null)

    const cacheRaw = localStorage.getItem('bt_fundamentals_cache')
    const cache = cacheRaw ? JSON.parse(cacheRaw) : {}
    cache[symbol] = { profile: result.profile, metrics: result.metrics, quote: result.quote }
    localStorage.setItem('bt_fundamentals_cache', JSON.stringify(cache))
  }

  if (!settingsLoading && !finnhubKey) {
    return (
      <div className="fund-key-required">
        <p>Key Required</p>
        <p>Add your Finnhub API key in Settings to research fundamentals.</p>
        <Link to="/settings">Go to Settings</Link>
      </div>
    )
  }

  const isEtf = activeSymbol && KNOWN_ETFS.has(activeSymbol)
  const result = activeSymbol ? data[activeSymbol] : null
  const investment = activeSymbol ? investments.find((i) => i.symbol === activeSymbol) : null

  return (
    <div className="fundamentals-tab">
      <div className="fund-symbol-picker">
        {stockSymbols.map((symbol) => (
          <button key={symbol} type="button" className="fund-chip" onClick={() => research(symbol)}>
            {symbol}
          </button>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); research(inputValue) }}>
          <label htmlFor="fundAddSymbol">Add symbol</label>
          <input
            id="fundAddSymbol"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); research(inputValue) } }}
          />
        </form>
      </div>

      {isEtf && (
        <div className="fund-etf-card">
          <p>No financials available for ETFs.</p>
          <a href={`https://etf.com/${activeSymbol}`} target="_blank" rel="noreferrer">ETF.com</a>
          <a href={`https://finance.yahoo.com/quote/${activeSymbol}`} target="_blank" rel="noreferrer">Yahoo Finance</a>
          <a href={`https://www.morningstar.com/etfs/xnas/${activeSymbol}/quote`} target="_blank" rel="noreferrer">Morningstar</a>
        </div>
      )}

      {loadingSymbol && loadingSymbol === activeSymbol && <p>Loading {activeSymbol}…</p>}

      {result && !isEtf && (
        <div className="fund-panels">
          <div className="fund-header">
            <span className="fund-symbol">{activeSymbol}</span>
            <span>{result.profile?.name}</span>
            <span className="fund-meta">{result.profile?.exchange} · {result.profile?.finnhubIndustry}</span>
            {result.quote?.c !== undefined && (
              <span className="mono">
                {formatCurrency(result.quote.c)}
                {result.quote.pc ? ` (${(((result.quote.c - result.quote.pc) / result.quote.pc) * 100).toFixed(2)}%)` : ''}
              </span>
            )}
          </div>

          {investment && (
            <section className="fund-section">
              <h2>Your Position</h2>
              <div className="fund-stat-grid">
                <StatTile label="Shares" value={investment.shares} />
                <StatTile label="Avg Cost" value={formatCurrency(investment.avgCost)} />
                <StatTile label="Market Value" value={formatCurrency(Number(investment.currentPrice) * Number(investment.shares))} />
                <StatTile
                  label="Unrealized P&L"
                  value={formatCurrency(unrealizedPnlFor(investment))}
                  tone={unrealizedPnlFor(investment) >= 0 ? 'positive' : 'negative'}
                />
              </div>
            </section>
          )}

          {peers[activeSymbol]?.length > 0 && (
            <section className="fund-section">
              <h2>Similar Stocks</h2>
              <div className="fund-symbol-picker">
                {peers[activeSymbol].map((peer) => (
                  <button key={peer} type="button" className="fund-chip" onClick={() => research(peer)}>{peer}</button>
                ))}
              </div>
            </section>
          )}

          <section className="fund-section">
            <h2>Valuation</h2>
            <div className="fund-stat-grid">
              <StatTile label="Market Cap" value={result.metrics?.marketCapitalization ? formatLarge(result.metrics.marketCapitalization * 1e6) : null} />
              <StatTile label="P/E" value={result.metrics?.peBasicExclExtraTTM} tone={toneFor(result.metrics?.peBasicExclExtraTTM, { redAbove: 30, greenBelow: 15 })} />
              <StatTile label="Forward P/E" value={result.metrics?.peTTM} />
              <StatTile label="P/S" value={result.metrics?.psTTM} />
              <StatTile label="P/B" value={result.metrics?.pbQuarterly} />
              <StatTile label="EV/EBITDA" value={result.metrics?.evEbitdaTTM} />
              <StatTile label="EPS TTM" value={result.metrics?.epsTTM} />
              <StatTile label="Div Yield" value={result.metrics?.dividendYieldIndicatedAnnual} />
            </div>
          </section>

          <section className="fund-section">
            <h2>Growth & Profitability</h2>
            <div className="fund-stat-grid">
              <StatTile label="Rev/Share" value={result.metrics?.revenuePerShareTTM} />
              <StatTile label="ROE" value={result.metrics?.roeTTM} tone={toneFor(result.metrics?.roeTTM, { greenAbove: 15, redBelow: 0 })} />
              <StatTile label="ROA" value={result.metrics?.roaTTM} tone={toneFor(result.metrics?.roaTTM, { greenAbove: 5 })} />
              <StatTile label="Net Margin" value={result.metrics?.netProfitMarginTTM} />
              <StatTile label="Gross Margin" value={result.metrics?.grossMarginTTM} />
              <StatTile label="Rev Growth YoY" value={result.metrics?.revenueGrowthTTMYoy} />
              <StatTile label="EPS Growth YoY" value={result.metrics?.epsGrowthTTMYoy} />
            </div>
          </section>

          <section className="fund-section">
            <h2>Risk & Price Range</h2>
            <div className="fund-stat-grid">
              <StatTile label="Beta" value={result.metrics?.beta} tone={toneFor(result.metrics?.beta, { redAbove: 1.5, greenBelow: 0.8 })} />
              <StatTile label="Debt/Equity" value={result.metrics?.['totalDebt/totalEquityQuarterly']} tone={toneFor(result.metrics?.['totalDebt/totalEquityQuarterly'], { redAbove: 2 })} />
              <StatTile label="Current Ratio" value={result.metrics?.currentRatioQuarterly} tone={toneFor(result.metrics?.currentRatioQuarterly, { greenAbove: 1.5, redBelow: 1 })} />
              <StatTile label="52W High" value={formatCurrencyAuto(result.metrics?.['52WeekHigh'])} />
              <StatTile label="52W Low" value={formatCurrencyAuto(result.metrics?.['52WeekLow'])} />
              <StatTile label="Shares Outstanding" value={result.metrics?.marketCapitalization && result.quote?.c ? Math.round((result.metrics.marketCapitalization * 1e6) / result.quote.c).toLocaleString() : null} />
            </div>
          </section>

          {result.earnings?.earnings?.length > 0 && (
            <section className="fund-section">
              <h2>Earnings History</h2>
              <table className="fund-table">
                <thead>
                  <tr><th>Period</th><th>Actual</th><th>Estimate</th></tr>
                </thead>
                <tbody>
                  {[...result.earnings.earnings].slice(0, 8).reverse().map((e, idx) => (
                    <tr key={idx}>
                      <td>{e.period}</td>
                      <td className="mono">{e.actual}</td>
                      <td className="mono">{e.estimate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {result.news?.length > 0 && (
            <section className="fund-section">
              <h2>Recent News</h2>
              <ul className="fund-news-list">
                {result.news.map((item) => (
                  <li key={item.id}>
                    <a href={item.url} target="_blank" rel="noreferrer">{item.headline}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- FundamentalsTab`
Expected: PASS (6 tests). If a selector/label doesn't match (e.g. `metrics?.['52WeekHigh']` field name), check Finnhub's actual metric key names and adjust — Finnhub uses `52WeekHigh`/`52WeekLow` as literal keys.

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis/FundamentalsTab.jsx src/components/analysis/FundamentalsTab.test.jsx src/components/analysis/FundamentalsTab.css
git commit -m "feat: implement Fundamentals tab (symbol picker, valuation/growth/risk panels, ETF short-circuit)"
```

---

### Task 6: CSS pass + full suite + manual smoke test

**Files:**
- Create/modify: `src/pages/AnalyzePage.css`, `src/components/analysis/FundamentalsTab.css` (created inline in Tasks 4/5 — this task is styling polish only)

- [ ] **Step 1: Style `AnalyzePage.css`**

Match the Stats page's `.view-toggle` pattern for `.analyze-tabs` (flex row,
`aria-pressed="true"` highlighted green), `.analyze-tab-placeholder` centered
muted text.

- [ ] **Step 2: Style `FundamentalsTab.css`**

Match `StatsPage.css`'s `.stat-tile-grid`/`.stat-tile` pattern for
`.fund-stat-grid`/`.fund-stat-tile`; `.fund-chip` styled like existing chip/
badge patterns (`border-radius`, `--bg-elevated` background); `.fund-etf-card`
and `.fund-key-required` centered empty-state text matching
`.empty-state`/`.error-banner` conventions already in `InvestmentsPage.css`.

- [ ] **Step 3: Run full suite**

Run: `npm test`
Expected: all tests pass (241 existing + ~20 new from this plan).

- [ ] **Step 4: Restart dev server, manual smoke test**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

At `/analyze`: confirm the 9-tab bar renders, Fundamentals is active by
default, other tabs show "Coming soon". With a real Finnhub key set in
Settings, research a real stock symbol (e.g. AAPL) — confirm the header,
Valuation/Growth/Risk panels, earnings table, and news list populate.
Research a known ETF (e.g. SPY) — confirm the static ETF card appears
instead of a fetch. If an open Stock investment exists, click its chip and
confirm the "Your Position" panel appears.

- [ ] **Step 5: Report completion**

No commit needed for this task unless smoke testing surfaces a bug — fix
as a new small commit and re-run Step 3.
