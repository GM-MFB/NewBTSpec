# Analyze Tab — Phase 2a (Financials Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Financials tab's core: Alpha Vantage 3-statement fetch, a 3-tier cache (in-memory → localStorage → Supabase shared `financials_cache` table), and Income Statement / Balance Sheet / Cash Flow tables with an Annual/Quarterly toggle and period-over-period % change badges.

**Architecture:** `fetchFinancials.js` does the AV fetch + merge/normalize. `financialsSharedCache.js` wraps the Supabase table. `FinancialsTab.jsx` orchestrates the cache chain and renders the tables, following the same symbol-picker pattern as `FundamentalsTab.jsx`.

**Tech Stack:** React 19, Vitest + @testing-library/react + `vi.useFakeTimers`. No new dependencies.

## Global Constraints

- Do not change Supabase table/column names — `financials_cache` already exists (`ticker` unique, `data` jsonb, `fetched_at`, `user_id` nullable).
- Match existing conventions: camelCase JS, dark/mono CSS tokens, `formatLarge` from `src/lib/format.js` (already built) for dollar figures.
- TDD throughout: failing test → implementation → passing test → commit, per task.
- No manual paste importer, no charts — those are later phases (do not build stubs for them either; the Financials tab has no sub-tabs yet).

---

### Task 1: `fetchFinancials`

**Files:**
- Create: `src/lib/fetchFinancials.js`
- Create: `src/lib/fetchFinancials.test.js`

**Interfaces:**
- Produces: `fetchFinancials(symbol, apiKey) -> Promise<{ annual: Period[], quarterly: Period[] }>`, consumed by Task 4 (`FinancialsTab`).
- `Period = { date, revenue, cogs, grossProfit, rd, sga, ebitda, operatingIncome, netIncome, cash, cashAndShortTerm, currentAssets, totalAssets, currentLiabilities, longTermDebt, totalLiabilities, equity, retainedEarnings, operatingCF, capex, freeCF, depreciation, dividendsPaid, investingCF, financingCF }` — any missing/non-numeric AV field maps to `null`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchFinancials } from './fetchFinancials'

function jsonResponse(body) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
}

describe('fetchFinancials', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls the 3 AV endpoints in order with a 1.1s gap, and merges by fiscalDateEnding', async () => {
    const calls = []
    global.fetch.mockImplementation((url) => {
      calls.push(url)
      if (url.includes('INCOME_STATEMENT')) {
        return jsonResponse({ annualReports: [{ fiscalDateEnding: '2024-12-31', totalRevenue: '1000', costOfRevenue: '400', grossProfit: '600', researchAndDevelopment: '50', sellingGeneralAndAdministrative: '30', ebitda: '300', operatingIncome: '250', netIncome: '200' }], quarterlyReports: [] })
      }
      if (url.includes('BALANCE_SHEET')) {
        return jsonResponse({ annualReports: [{ fiscalDateEnding: '2024-12-31', cashAndCashEquivalentsAtCarryingValue: '100', cashAndShortTermInvestments: '150', totalCurrentAssets: '500', totalAssets: '2000', totalCurrentLiabilities: '300', longTermDebt: '400', totalLiabilities: '900', totalShareholderEquity: '1100', retainedEarnings: '600' }], quarterlyReports: [] })
      }
      if (url.includes('CASH_FLOW')) {
        return jsonResponse({ annualReports: [{ fiscalDateEnding: '2024-12-31', operatingCashflow: '350', capitalExpenditures: '80', depreciationDepletionAndAmortization: '40', dividendPayout: '20', cashflowFromInvestment: '-90', cashflowFromFinancing: '-60' }], quarterlyReports: [] })
      }
      return jsonResponse({})
    })

    const promise = fetchFinancials('AAPL', 'key123')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(calls[0]).toContain('INCOME_STATEMENT')
    expect(calls[1]).toContain('BALANCE_SHEET')
    expect(calls[2]).toContain('CASH_FLOW')

    expect(result.annual).toHaveLength(1)
    const period = result.annual[0]
    expect(period.date).toBe('2024-12-31')
    expect(period.revenue).toBe(1000)
    expect(period.grossProfit).toBe(600)
    expect(period.cash).toBe(100)
    expect(period.equity).toBe(1100)
    expect(period.operatingCF).toBe(350)
    expect(period.capex).toBe(-80)
    expect(period.freeCF).toBe(270)
  })

  it('slices to the most recent 8 periods, sorted ascending by date', async () => {
    const annualReports = Array.from({ length: 10 }, (_, i) => ({ fiscalDateEnding: `${2015 + i}-12-31`, totalRevenue: String(i) }))
    global.fetch.mockImplementation((url) => {
      if (url.includes('INCOME_STATEMENT')) return jsonResponse({ annualReports, quarterlyReports: [] })
      return jsonResponse({ annualReports: [], quarterlyReports: [] })
    })

    const promise = fetchFinancials('AAPL', 'key123')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.annual).toHaveLength(8)
    expect(result.annual[0].date).toBe('2017-12-31')
    expect(result.annual[7].date).toBe('2024-12-31')
  })

  it('leaves freeCF null when capex is missing', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('CASH_FLOW')) return jsonResponse({ annualReports: [{ fiscalDateEnding: '2024-12-31', operatingCashflow: '350' }], quarterlyReports: [] })
      return jsonResponse({ annualReports: [{ fiscalDateEnding: '2024-12-31' }], quarterlyReports: [] })
    })

    const promise = fetchFinancials('AAPL', 'key123')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.annual[0].freeCF).toBeNull()
  })

  it('throws when AV returns a rate-limit Note', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('INCOME_STATEMENT')) return jsonResponse({ Note: 'Thank you for using Alpha Vantage! Our standard API call frequency is 25 requests per day.' })
      return jsonResponse({ annualReports: [], quarterlyReports: [] })
    })

    const promise = fetchFinancials('AAPL', 'key123')
    vi.runAllTimersAsync()
    await expect(promise).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fetchFinancials`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/lib/fetchFinancials.js`**

```js
const BASE = 'https://www.alphavantage.co/query'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchStatement(fn, symbol, apiKey) {
  const res = await fetch(`${BASE}?function=${fn}&symbol=${symbol}&apikey=${apiKey}`)
  const data = await res.json()
  if (data['Error Message']) throw new Error(data['Error Message'])
  if (data['Note']) throw new Error(data['Note'])
  if (data['Information']) throw new Error(data['Information'])
  return data
}

function toNum(value) {
  if (value === undefined || value === null || value === 'None') return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

function mergeByDate(incomeReports, balanceReports, cashFlowReports) {
  const byDate = new Map()

  function get(map, date) {
    if (!byDate.has(date)) byDate.set(date, { date })
    return byDate.get(date)
  }

  for (const r of incomeReports) {
    const p = get(byDate, r.fiscalDateEnding)
    p.revenue = toNum(r.totalRevenue)
    p.cogs = toNum(r.costOfRevenue)
    p.grossProfit = toNum(r.grossProfit)
    p.rd = toNum(r.researchAndDevelopment)
    p.sga = toNum(r.sellingGeneralAndAdministrative)
    p.ebitda = toNum(r.ebitda)
    p.operatingIncome = toNum(r.operatingIncome)
    p.netIncome = toNum(r.netIncome)
  }

  for (const r of balanceReports) {
    const p = get(byDate, r.fiscalDateEnding)
    p.cash = toNum(r.cashAndCashEquivalentsAtCarryingValue)
    p.cashAndShortTerm = toNum(r.cashAndShortTermInvestments)
    p.currentAssets = toNum(r.totalCurrentAssets)
    p.totalAssets = toNum(r.totalAssets)
    p.currentLiabilities = toNum(r.totalCurrentLiabilities)
    p.longTermDebt = toNum(r.longTermDebt)
    p.totalLiabilities = toNum(r.totalLiabilities)
    p.equity = toNum(r.totalShareholderEquity)
    p.retainedEarnings = toNum(r.retainedEarnings)
  }

  for (const r of cashFlowReports) {
    const p = get(byDate, r.fiscalDateEnding)
    p.operatingCF = toNum(r.operatingCashflow)
    const capex = toNum(r.capitalExpenditures)
    p.capex = capex === null ? null : -Math.abs(capex)
    p.depreciation = toNum(r.depreciationDepletionAndAmortization)
    p.dividendsPaid = toNum(r.dividendPayout)
    p.investingCF = toNum(r.cashflowFromInvestment)
    p.financingCF = toNum(r.cashflowFromFinancing)
    p.freeCF = (p.operatingCF !== null && p.capex !== null) ? p.operatingCF - Math.abs(p.capex) : null
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-8)
}

export async function fetchFinancials(symbol, apiKey) {
  const income = await fetchStatement('INCOME_STATEMENT', symbol, apiKey)
  await delay(1100)
  const balance = await fetchStatement('BALANCE_SHEET', symbol, apiKey)
  await delay(1100)
  const cashFlow = await fetchStatement('CASH_FLOW', symbol, apiKey)

  return {
    annual: mergeByDate(income.annualReports ?? [], balance.annualReports ?? [], cashFlow.annualReports ?? []),
    quarterly: mergeByDate(income.quarterlyReports ?? [], balance.quarterlyReports ?? [], cashFlow.quarterlyReports ?? []),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- fetchFinancials`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchFinancials.js src/lib/fetchFinancials.test.js
git commit -m "feat: add fetchFinancials Alpha Vantage 3-statement fetch + merge/normalize"
```

---

### Task 2: `financialsSharedCache`

**Files:**
- Create: `src/lib/financialsSharedCache.js`
- Create: `src/lib/financialsSharedCache.test.js`

**Interfaces:**
- Produces:
  - `getSharedCache(ticker) -> Promise<{annual, quarterly} | null>`
  - `saveSharedCache(ticker, data, userId) -> Promise<void>`
- Consumed by Task 4 (`FinancialsTab`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSharedCache, saveSharedCache } from './financialsSharedCache'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

describe('getSharedCache', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the cached data for a ticker', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { data: { annual: [{ date: '2024-12-31' }], quarterly: [] } }, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    const result = await getSharedCache('AAPL')

    expect(supabase.from).toHaveBeenCalledWith('financials_cache')
    expect(eq).toHaveBeenCalledWith('ticker', 'AAPL')
    expect(result).toEqual({ annual: [{ date: '2024-12-31' }], quarterly: [] })
  })

  it('returns null when there is no cached row', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    expect(await getSharedCache('ZZZZ')).toBeNull()
  })
})

describe('saveSharedCache', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts the ticker with data/fetched_at/user_id', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ upsert })

    await saveSharedCache('AAPL', { annual: [], quarterly: [] }, 'u1')

    expect(supabase.from).toHaveBeenCalledWith('financials_cache')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'AAPL', data: { annual: [], quarterly: [] }, user_id: 'u1' }),
      { onConflict: 'ticker' }
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- financialsSharedCache`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/lib/financialsSharedCache.js`**

```js
import { supabase } from '../utils/supabase'

export async function getSharedCache(ticker) {
  const { data, error } = await supabase
    .from('financials_cache')
    .select('data')
    .eq('ticker', ticker)
    .maybeSingle()

  if (error || !data) return null
  return data.data
}

export async function saveSharedCache(ticker, data, userId) {
  await supabase
    .from('financials_cache')
    .upsert({ ticker, data, fetched_at: new Date().toISOString(), user_id: userId }, { onConflict: 'ticker' })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- financialsSharedCache`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/financialsSharedCache.js src/lib/financialsSharedCache.test.js
git commit -m "feat: add financialsSharedCache wrapping the Supabase financials_cache table"
```

---

### Task 3: `pctChange` helper

**Files:**
- Create: `src/lib/pctChange.js`
- Create: `src/lib/pctChange.test.js`

**Interfaces:**
- Produces: `pctChange(current, previous) -> number | null` — consumed by Task 4.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { pctChange } from './pctChange'

describe('pctChange', () => {
  it('computes percent change between two values', () => {
    expect(pctChange(120, 100)).toBe(20)
    expect(pctChange(80, 100)).toBe(-20)
  })

  it('returns null when either value is null', () => {
    expect(pctChange(null, 100)).toBeNull()
    expect(pctChange(120, null)).toBeNull()
  })

  it('returns null when the previous value is 0 (divide-by-zero guard)', () => {
    expect(pctChange(50, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pctChange`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/lib/pctChange.js`**

```js
export function pctChange(current, previous) {
  if (current === null || current === undefined) return null
  if (previous === null || previous === undefined) return null
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- pctChange`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pctChange.js src/lib/pctChange.test.js
git commit -m "feat: add pctChange helper for period-over-period statement badges"
```

---

### Task 4: `FinancialsTab` component

**Files:**
- Create: `src/components/analysis/FinancialsTab.jsx`
- Create: `src/components/analysis/FinancialsTab.css`
- Create: `src/components/analysis/FinancialsTab.test.jsx`
- Modify: `src/pages/AnalyzePage.jsx` (render `FinancialsTab` for the `financials` tab)
- Modify: `src/pages/AnalyzePage.test.jsx` (the "Coming soon" test now targets a still-unbuilt tab, e.g. `research`, instead of `financials`)

**Interfaces:**
- Consumes: `useAuth`, `useUserSettings` (existing), `fetchFinancials` (Task 1), `getSharedCache`/`saveSharedCache` (Task 2), `pctChange` (Task 3), `formatLarge` (existing, from Fundamentals work).
- Props: `{ investments }` — same shape `FundamentalsTab` already receives from `AnalyzePage`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/analysis/FinancialsTab.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import FinancialsTab from './FinancialsTab'
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
    { date: '2023-12-31', revenue: 1000, cogs: 400, grossProfit: 600, rd: 50, sga: 30, ebitda: 300, operatingIncome: 250, netIncome: 200, cash: 90, cashAndShortTerm: 140, currentAssets: 450, totalAssets: 1900, currentLiabilities: 280, longTermDebt: 380, totalLiabilities: 850, equity: 1050, retainedEarnings: 550, operatingCF: 300, capex: -70, freeCF: 230, depreciation: 35, dividendsPaid: 15, investingCF: -80, financingCF: -50 },
    { date: '2024-12-31', revenue: 1200, cogs: 450, grossProfit: 750, rd: 60, sga: 35, ebitda: 380, operatingIncome: 300, netIncome: 250, cash: 100, cashAndShortTerm: 150, currentAssets: 500, totalAssets: 2000, currentLiabilities: 300, longTermDebt: 400, totalLiabilities: 900, equity: 1100, retainedEarnings: 600, operatingCF: 350, capex: -80, freeCF: 270, depreciation: 40, dividendsPaid: 20, investingCF: -90, financingCF: -60 },
  ],
  quarterly: [
    { date: '2024-09-30', revenue: 290, cogs: 110, grossProfit: 180, rd: 15, sga: 9, ebitda: 95, operatingIncome: 75, netIncome: 60, cash: 100, cashAndShortTerm: 150, currentAssets: 500, totalAssets: 2000, currentLiabilities: 300, longTermDebt: 400, totalLiabilities: 900, equity: 1100, retainedEarnings: 600, operatingCF: 90, capex: -20, freeCF: 70, depreciation: 10, dividendsPaid: 5, investingCF: -22, financingCF: -15 },
  ],
}

describe('FinancialsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    getSharedCache.mockResolvedValue(null)
    saveSharedCache.mockResolvedValue(undefined)
    localStorage.clear()
  })

  it('shows a Key Required state when there is no Alpha Vantage key', () => {
    useUserSettings.mockReturnValue({ avKey: '', finnhubKey: '', loading: false })
    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    expect(screen.getByText(/key required/i)).toBeInTheDocument()
  })

  it('shows a symbol chip for each open stock investment', () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'AAPL' })).toBeInTheDocument()
  })

  it('fetches and renders the three statement tables when a symbol is researched', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)

    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Income Statement')).toBeInTheDocument())
    expect(screen.getByText('Balance Sheet')).toBeInTheDocument()
    expect(screen.getByText('Cash Flow')).toBeInTheDocument()
  })

  it('uses the Supabase shared cache instead of fetching when available', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    getSharedCache.mockResolvedValue(sampleData)

    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Income Statement')).toBeInTheDocument())
    expect(fetchFinancials).not.toHaveBeenCalled()
  })

  it('defaults to Annual and switches periods when Quarterly is clicked', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)

    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))
    await waitFor(() => expect(screen.getByText('Income Statement')).toBeInTheDocument())

    expect(screen.getByText('2024-12-31')).toBeInTheDocument()
    expect(screen.queryByText('2024-09-30')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^quarterly$/i }))
    expect(screen.getByText('2024-09-30')).toBeInTheDocument()
  })

  it('does not crash when a metric is null for a period', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue({
      annual: [{ date: '2024-12-31', revenue: null, cogs: null, grossProfit: null, rd: null, sga: null, ebitda: null, operatingIncome: null, netIncome: null, cash: null, cashAndShortTerm: null, currentAssets: null, totalAssets: null, currentLiabilities: null, longTermDebt: null, totalLiabilities: null, equity: null, retainedEarnings: null, operatingCF: null, capex: null, freeCF: null, depreciation: null, dividendsPaid: null, investingCF: null, financingCF: null }],
      quarterly: [],
    })

    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Income Statement')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FinancialsTab`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/components/analysis/FinancialsTab.jsx`**

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import './FinancialsTab.css'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFinancials } from '../../lib/fetchFinancials'
import { getSharedCache, saveSharedCache } from '../../lib/financialsSharedCache'
import { pctChange } from '../../lib/pctChange'
import { formatLarge } from '../../lib/format'

const INCOME_ROWS = [
  ['revenue', 'Revenue'], ['cogs', 'COGS'], ['grossProfit', 'Gross Profit'],
  ['rd', 'R&D'], ['sga', 'SG&A'], ['operatingIncome', 'Operating Income'],
  ['ebitda', 'EBITDA'], ['netIncome', 'Net Income'],
]
const BALANCE_ROWS = [
  ['cash', 'Cash'], ['cashAndShortTerm', 'Cash & Short-Term Investments'],
  ['currentAssets', 'Current Assets'], ['totalAssets', 'Total Assets'],
  ['currentLiabilities', 'Current Liabilities'], ['longTermDebt', 'Long-Term Debt'],
  ['totalLiabilities', 'Total Liabilities'], ['equity', 'Equity'],
  ['retainedEarnings', 'Retained Earnings'],
]
const CASH_FLOW_ROWS = [
  ['operatingCF', 'Operating CF'], ['capex', 'CapEx'], ['freeCF', 'Free Cash Flow'],
  ['depreciation', 'Depreciation'], ['dividendsPaid', 'Dividends Paid'],
  ['investingCF', 'Investing CF'], ['financingCF', 'Financing CF'],
]

function StatementTable({ title, rows, periods }) {
  const mostRecentFirst = [...periods].reverse()
  return (
    <section className="fin-section">
      <h2>{title}</h2>
      <div className="fin-table-wrap">
        <table className="fin-table">
          <thead>
            <tr>
              <th className="fin-sticky-col">Metric</th>
              {mostRecentFirst.map((p) => <th key={p.date}>{p.date}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, label]) => (
              <tr key={key}>
                <td className="fin-sticky-col">{label}</td>
                {mostRecentFirst.map((p, idx) => {
                  const prior = mostRecentFirst[idx + 1]
                  const change = prior ? pctChange(p[key], prior[key]) : null
                  return (
                    <td key={p.date} className="mono">
                      {p[key] === null ? '—' : formatLarge(p[key])}
                      {change !== null && (
                        <span className={`fin-badge ${change >= 0 ? 'fin-badge--up' : 'fin-badge--down'}`}>
                          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function FinancialsTab({ investments }) {
  const { user } = useAuth()
  const { avKey, loading: settingsLoading } = useUserSettings(user?.id)
  const [data, setData] = useState({})
  const [activeSymbol, setActiveSymbol] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [frequency, setFrequency] = useState('annual')
  const [loadingSymbol, setLoadingSymbol] = useState(null)

  const stockSymbols = [...new Set(investments.filter((i) => i.assetType === 'Stock').map((i) => i.symbol))]

  async function research(rawSymbol) {
    const symbol = rawSymbol.trim().toUpperCase()
    if (!symbol) return
    setActiveSymbol(symbol)
    setInputValue('')
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

  if (!settingsLoading && !avKey) {
    return (
      <div className="fin-key-required">
        <p>Key Required</p>
        <p>Add your Alpha Vantage API key in Settings to research financial statements.</p>
        <Link to="/settings">Go to Settings</Link>
      </div>
    )
  }

  const result = activeSymbol ? data[activeSymbol] : null
  const periods = result ? result[frequency] : []

  return (
    <div className="financials-tab">
      <div className="fin-symbol-picker">
        {stockSymbols.map((symbol) => (
          <button key={symbol} type="button" className="fin-chip" onClick={() => research(symbol)}>
            {symbol}
          </button>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); research(inputValue) }}>
          <label htmlFor="finAddSymbol">Add symbol</label>
          <input
            id="finAddSymbol"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); research(inputValue) } }}
          />
        </form>
      </div>

      {result && (
        <div className="fin-frequency-toggle">
          <button type="button" aria-pressed={frequency === 'annual'} onClick={() => setFrequency('annual')}>Annual</button>
          <button type="button" aria-pressed={frequency === 'quarterly'} onClick={() => setFrequency('quarterly')}>Quarterly</button>
        </div>
      )}

      {loadingSymbol && loadingSymbol === activeSymbol && <p>Loading {activeSymbol}…</p>}

      {result && periods.length > 0 && (
        <div className="fin-panels">
          <StatementTable title="Income Statement" rows={INCOME_ROWS} periods={periods} />
          <StatementTable title="Balance Sheet" rows={BALANCE_ROWS} periods={periods} />
          <StatementTable title="Cash Flow" rows={CASH_FLOW_ROWS} periods={periods} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add `src/components/analysis/FinancialsTab.css`**

Match `FundamentalsTab.css`'s conventions (`.fin-chip` like `.fund-chip`,
`.fin-key-required` like `.fund-key-required`) plus:

```css
.fin-frequency-toggle {
  display: flex;
  gap: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  width: fit-content;
}

.fin-frequency-toggle button {
  background: transparent;
  border: none;
  color: var(--text-dim);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.fin-frequency-toggle button[aria-pressed="true"] {
  background: var(--bg);
  color: var(--green);
}

.fin-table-wrap {
  overflow-x: auto;
}

.fin-table {
  border-collapse: collapse;
  font-size: 12px;
  white-space: nowrap;
}

.fin-table th, .fin-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  text-align: right;
}

.fin-table th:first-child, .fin-table td:first-child {
  text-align: left;
}

.fin-sticky-col {
  position: sticky;
  left: 0;
  background: var(--bg);
  color: var(--text-dim);
}

.fin-badge {
  margin-left: 6px;
  font-size: 10px;
  font-weight: 700;
}

.fin-badge--up {
  color: var(--green);
}

.fin-badge--down {
  color: var(--red);
}
```

- [ ] **Step 5: Wire into `AnalyzePage.jsx`**

Import `FinancialsTab` and render it when `tab === 'financials'` (same
pattern as `fundamentals`). Update `AnalyzePage.test.jsx`'s "Coming soon"
test to target `research` instead (the next still-unbuilt tab), since
`financials` now has real content — and mock `useUserSettings` there too
(new dependency of the now-real `FinancialsTab`), returning `{ avKey: '',
finnhubKey: '', loading: false }` so it renders its Key Required state
harmlessly under the default `AnalyzePage` tests.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- FinancialsTab AnalyzePage`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/analysis/FinancialsTab.jsx src/components/analysis/FinancialsTab.css src/components/analysis/FinancialsTab.test.jsx src/pages/AnalyzePage.jsx src/pages/AnalyzePage.test.jsx
git commit -m "feat: implement Financials tab core (3-statement tables, Annual/Quarterly, cache chain)"
```

---

### Task 5: Full suite + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (266 existing + ~20 new from this plan).

- [ ] **Step 2: Restart dev server, manual smoke test**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

At `/analyze` → Financials tab: with a real Alpha Vantage key set in
Settings, research a real symbol (e.g. AAPL) — confirm all three tables
populate, the Annual/Quarterly toggle switches periods, and % change
badges show the correct direction/color. Research the same symbol again
in a fresh page load — confirm it loads from `localStorage` instantly
without a new AV fetch (check the Network tab).

- [ ] **Step 3: Report completion**

No commit needed for this task unless smoke testing surfaces a bug — fix
as a new small commit and re-run Step 1.
