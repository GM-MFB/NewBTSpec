# Stats Page (Investments) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build out `/stats` with a full realized-performance dashboard for Investments (open + closed), with a Numbers/Charts toggle, per `docs/superpowers/specs/2026-07-25-stats-page-design.md`.

**Architecture:** A new read-only `useInvestmentsHistory` hook fetches all investments (open + closed) for the account. `computeInvestmentStats` (pure function) turns that list into every derived stat. `StatsPage` renders either stat tiles/tables or (via a new `StatsCharts` component, built using the `dataviz` skill) four charts over the same data, toggled by local state.

**Tech Stack:** Same as the rest of the app, plus `recharts` for charting (new dependency).

## Global Constraints

- Investments only — no Trades data on this page.
- Realized P&L formula (exact, from the spec):
  - Stock: `(sellPrice - avgCost) × shares`
  - Option, long (`call`, `put`): `(sellPrice - avgCost) × shares × 100`
  - Option, short (`cash_secured_put`, `covered_call`, `put_credit_spread`, `call_credit_spread`): `(avgCost - sellPrice) × shares × 100`, with a blank `sellPrice` treated as `0`.
- PDF export is explicitly out of scope for this plan.
- Chart code must follow the `dataviz` skill (invoke it before writing `StatsCharts.jsx`).

---

## Task 1: `useInvestmentsHistory` hook (TDD)

**Files:**
- Create: `src/hooks/useInvestmentsHistory.js`
- Test: `src/hooks/useInvestmentsHistory.test.js`

**Interfaces:**
- Consumes: `supabase` (`src/utils/supabase.js`), `fromRow` from `src/lib/investmentMappers.js`; an `accountId` string.
- Produces: `useInvestmentsHistory(accountId) -> { investments, loading, error, reload() }` — **all** investments (open + closed), unlike `useInvestments` which is open-only. Consumed by `StatsPage` (Task 3).

- [ ] **Step 1: Write the failing test**

`src/hooks/useInvestmentsHistory.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useInvestmentsHistory } from './useInvestmentsHistory'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

describe('useInvestmentsHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads both open and closed investments for the account, mapped to camelCase', async () => {
    const rows = [
      {
        id: 'i1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
        symbol: 'AAPL', name: '', asset_type: 'Stock', sector: '',
        shares: 10, avg_cost: 150, current_price: null, buy_date: '2026-01-01',
        status: 'open', sell_price: null, sell_date: null, stop_loss: null,
        target_price: null, chart_link: null, notes: null,
        option_type: null, option_direction: null, strike: null, expiry: null,
        strategy: null, strike_2: null,
      },
      {
        id: 'i2', account_id: 'a1', user_id: 'u1', created_at: '2026-01-02',
        symbol: 'TSLA', name: '', asset_type: 'Stock', sector: '',
        shares: 5, avg_cost: 200, current_price: null, buy_date: '2026-01-02',
        status: 'closed', sell_price: 250, sell_date: '2026-01-10', stop_loss: null,
        target_price: null, chart_link: null, notes: null,
        option_type: null, option_direction: null, strike: null, expiry: null,
        strategy: null, strike_2: null,
      },
    ]
    const order = vi.fn().mockResolvedValue({ data: rows, error: null })
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    const { result } = renderHook(() => useInvestmentsHistory('a1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.investments).toHaveLength(2)
    expect(result.current.investments.map((i) => i.status)).toEqual(['open', 'closed'])
    expect(supabase.from).toHaveBeenCalledWith('investments')
    expect(eq).toHaveBeenCalledWith('account_id', 'a1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useInvestmentsHistory`
Expected: FAIL — `useInvestmentsHistory.js` does not exist.

- [ ] **Step 3: Implement the hook**

`src/hooks/useInvestmentsHistory.js`:
```js
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { fromRow } from '../lib/investmentMappers'

export function useInvestmentsHistory(accountId) {
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('investments')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    setInvestments(data.map(fromRow))
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    load()
  }, [load])

  return { investments, loading, error, reload: load }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useInvestmentsHistory`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useInvestmentsHistory.js src/hooks/useInvestmentsHistory.test.js
git commit -m "feat: add useInvestmentsHistory hook (open + closed investments)"
```

---

## Task 2: `computeInvestmentStats` (TDD)

**Files:**
- Create: `src/lib/investmentStats.js`
- Test: `src/lib/investmentStats.test.js`

**Interfaces:**
- Consumes: `strategyByValue`, `STRATEGIES` from `src/lib/optionStrategies.js`.
- Produces: `realizedPnlFor(investment) -> number | null` and `computeInvestmentStats(investments) -> { totalRealizedPnl, winRate, totalClosed, totalOpen, avgWin, avgLoss, bestTrade, worstTrade, stock, options, byStrategy, bySymbol, equityCurve }`. Consumed by `StatsPage` (Task 3) and `StatsCharts` (Task 4).

- [ ] **Step 1: Write the failing tests**

`src/lib/investmentStats.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { realizedPnlFor, computeInvestmentStats } from './investmentStats'

describe('realizedPnlFor', () => {
  it('computes stock realized P&L', () => {
    const investment = { status: 'closed', assetType: 'Stock', shares: 10, avgCost: 100, sellPrice: 150 }
    expect(realizedPnlFor(investment)).toBe(500)
  })

  it('computes long option realized P&L (x100 multiplier)', () => {
    const investment = { status: 'closed', assetType: 'Option', strategy: 'call', shares: 1, avgCost: 5, sellPrice: 8 }
    expect(realizedPnlFor(investment)).toBe(300)
  })

  it('computes short option realized P&L when bought back at a price', () => {
    const investment = { status: 'closed', assetType: 'Option', strategy: 'cash_secured_put', shares: 1, avgCost: 2, sellPrice: 0.5 }
    expect(realizedPnlFor(investment)).toBe(150)
  })

  it('treats a blank sellPrice as 0 for a short option (expired worthless = full premium)', () => {
    const investment = { status: 'closed', assetType: 'Option', strategy: 'cash_secured_put', shares: 1, avgCost: 2, sellPrice: '' }
    expect(realizedPnlFor(investment)).toBe(200)
  })

  it('returns null for an open investment', () => {
    const investment = { status: 'open', assetType: 'Stock', shares: 10, avgCost: 100, sellPrice: '' }
    expect(realizedPnlFor(investment)).toBeNull()
  })
})

describe('computeInvestmentStats', () => {
  const investments = [
    { status: 'closed', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 100, sellPrice: 150, sellDate: '2026-01-10' },
    { status: 'closed', assetType: 'Stock', symbol: 'TSLA', shares: 5, avgCost: 300, sellPrice: 250, sellDate: '2026-01-05' },
    { status: 'closed', assetType: 'Option', symbol: 'AAPL', strategy: 'cash_secured_put', shares: 2, avgCost: 1.5, sellPrice: '', sellDate: '2026-01-20' },
    { status: 'open', assetType: 'Stock', symbol: 'MSFT', shares: 3, avgCost: 400, sellPrice: '', sellDate: '' },
  ]

  it('computes overview totals and win rate', () => {
    const stats = computeInvestmentStats(investments)
    // 500 (AAPL stock) - 250 (TSLA stock) + 300 (AAPL CSP) = 550
    expect(stats.totalRealizedPnl).toBe(550)
    expect(stats.totalClosed).toBe(3)
    expect(stats.totalOpen).toBe(1)
    // 2 wins (500, 300) out of 3 closed = 66.67%
    expect(stats.winRate).toBeCloseTo(66.67, 1)
  })

  it('identifies the best and worst closed trade', () => {
    const stats = computeInvestmentStats(investments)
    expect(stats.bestTrade.symbol).toBe('AAPL')
    expect(stats.worstTrade.symbol).toBe('TSLA')
  })

  it('splits stock vs option stats', () => {
    const stats = computeInvestmentStats(investments)
    expect(stats.stock.count).toBe(2)
    expect(stats.stock.totalPnl).toBe(250)
    expect(stats.options.count).toBe(1)
    expect(stats.options.totalPnl).toBe(300)
    expect(stats.options.totalPremiumCollected).toBe(300)
  })

  it('groups by strategy', () => {
    const stats = computeInvestmentStats(investments)
    expect(stats.byStrategy).toEqual([
      expect.objectContaining({ strategy: 'cash_secured_put', count: 1, totalPnl: 300 }),
    ])
  })

  it('groups by symbol, sorted by totalPnl descending', () => {
    const stats = computeInvestmentStats(investments)
    expect(stats.bySymbol[0]).toEqual(expect.objectContaining({ symbol: 'AAPL', totalPnl: 800 }))
    expect(stats.bySymbol[1]).toEqual(expect.objectContaining({ symbol: 'TSLA', totalPnl: -250 }))
  })

  it('builds a chronological equity curve of cumulative P&L', () => {
    const stats = computeInvestmentStats(investments)
    expect(stats.equityCurve).toEqual([
      { date: '2026-01-05', cumulative: -250 },
      { date: '2026-01-10', cumulative: 250 },
      { date: '2026-01-20', cumulative: 550 },
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- investmentStats`
Expected: FAIL — `investmentStats.js` does not exist.

- [ ] **Step 3: Implement the module**

`src/lib/investmentStats.js`:
```js
import { strategyByValue, STRATEGIES } from './optionStrategies'

function toNum(value) {
  return value === '' || value === undefined || value === null ? 0 : Number(value)
}

export function realizedPnlFor(investment) {
  if (investment.status !== 'closed') return null
  const shares = toNum(investment.shares)
  const avgCost = toNum(investment.avgCost)
  const sellPrice = toNum(investment.sellPrice)

  if (investment.assetType === 'Stock') {
    return (sellPrice - avgCost) * shares
  }

  const strategyDef = strategyByValue(investment.strategy)
  if (strategyDef?.optionDirection === 'short') {
    return (avgCost - sellPrice) * shares * 100
  }
  return (sellPrice - avgCost) * shares * 100
}

function winLossStats(items) {
  const pnls = items.map(realizedPnlFor).filter((p) => p !== null)
  const wins = pnls.filter((p) => p > 0)
  const losses = pnls.filter((p) => p < 0)
  const totalPnl = pnls.reduce((sum, p) => sum + p, 0)
  const winRate = pnls.length ? (wins.length / pnls.length) * 100 : 0
  const avgWin = wins.length ? wins.reduce((sum, p) => sum + p, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((sum, p) => sum + p, 0) / losses.length : 0
  return { count: pnls.length, totalPnl, winRate, avgWin, avgLoss }
}

export function computeInvestmentStats(investments) {
  const closed = investments.filter((i) => i.status === 'closed')
  const open = investments.filter((i) => i.status === 'open')
  const closedStocks = closed.filter((i) => i.assetType === 'Stock')
  const closedOptions = closed.filter((i) => i.assetType === 'Option')

  const overall = winLossStats(closed)

  let bestTrade = null
  let worstTrade = null
  for (const investment of closed) {
    const pnl = realizedPnlFor(investment)
    if (pnl === null) continue
    if (!bestTrade || pnl > realizedPnlFor(bestTrade)) bestTrade = investment
    if (!worstTrade || pnl < realizedPnlFor(worstTrade)) worstTrade = investment
  }

  const stockStats = winLossStats(closedStocks)
  const optionStats = winLossStats(closedOptions)
  const totalPremiumCollected = closedOptions.reduce((sum, i) => {
    const strategyDef = strategyByValue(i.strategy)
    if (strategyDef?.optionDirection !== 'short') return sum
    return sum + toNum(i.avgCost) * toNum(i.shares) * 100
  }, 0)

  const byStrategy = STRATEGIES
    .map((s) => {
      const items = closedOptions.filter((i) => i.strategy === s.value)
      return { strategy: s.value, label: s.label, ...winLossStats(items) }
    })
    .filter((g) => g.count > 0)

  const symbolTotals = new Map()
  for (const investment of closed) {
    const pnl = realizedPnlFor(investment)
    if (pnl === null) continue
    const existing = symbolTotals.get(investment.symbol) ?? { symbol: investment.symbol, count: 0, totalPnl: 0 }
    existing.count += 1
    existing.totalPnl += pnl
    symbolTotals.set(investment.symbol, existing)
  }
  const bySymbol = [...symbolTotals.values()].sort((a, b) => b.totalPnl - a.totalPnl)

  const timeline = closed
    .filter((i) => i.sellDate)
    .map((i) => ({ date: i.sellDate, pnl: realizedPnlFor(i) }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  let cumulative = 0
  const equityCurve = timeline.map(({ date, pnl }) => {
    cumulative += pnl
    return { date, cumulative }
  })

  return {
    totalRealizedPnl: overall.totalPnl,
    winRate: overall.winRate,
    totalClosed: closed.length,
    totalOpen: open.length,
    avgWin: overall.avgWin,
    avgLoss: overall.avgLoss,
    bestTrade,
    worstTrade,
    stock: stockStats,
    options: { ...optionStats, totalPremiumCollected },
    byStrategy,
    bySymbol,
    equityCurve,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- investmentStats`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/investmentStats.js src/lib/investmentStats.test.js
git commit -m "feat: add computeInvestmentStats (realized P&L, win rate, groupings, equity curve)"
```

---

## Task 3: `StatsPage` — Numbers view + toggle

**Files:**
- Create: `src/pages/StatsPage.jsx`
- Create: `src/pages/StatsPage.css`
- Test: `src/pages/StatsPage.test.jsx`

**Interfaces:**
- Consumes: `useAuth`, `useAccounts` (existing), `useInvestmentsHistory` (Task 1), `computeInvestmentStats` (Task 2), `Header` (existing).
- Produces: the screen wired to `/stats` in Task 5. `data-testid="stats-page"`. Renders a Numbers/Charts toggle; this task implements the Numbers view fully and stubs the Charts view as a placeholder (Task 4 replaces the stub).

- [ ] **Step 1: Write the failing tests**

`src/pages/StatsPage.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import StatsPage from './StatsPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestmentsHistory } from '../hooks/useInvestmentsHistory'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useInvestmentsHistory')

function mockAccounts() {
  useAuth.mockReturnValue({ user: { id: 'u1' } })
  useAccounts.mockReturnValue({
    accounts: [{ id: 'a1', name: 'Main Account' }],
    activeAccount: { id: 'a1', name: 'Main Account' },
    activeAccountId: 'a1',
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
    loading: false,
  })
}

const investments = [
  { id: 'i1', status: 'closed', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 100, sellPrice: 150, sellDate: '2026-01-10' },
  { id: 'i2', status: 'open', assetType: 'Stock', symbol: 'MSFT', shares: 3, avgCost: 400, sellPrice: '', sellDate: '' },
]

describe('StatsPage', () => {
  it('shows the Numbers view by default with overview stat tiles', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getByText('Total Realized P&L')).toBeInTheDocument()
    expect(screen.getByText('$500.00')).toBeInTheDocument()
    expect(screen.getByText('Win Rate')).toBeInTheDocument()
    expect(screen.getByText('Closed Positions')).toBeInTheDocument()
    expect(screen.getByText('Open Positions')).toBeInTheDocument()
  })

  it('switches to the Charts view when toggled', async () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^charts$/i }))

    expect(screen.queryByText('Total Realized P&L')).not.toBeInTheDocument()
    expect(screen.getByTestId('stats-charts')).toBeInTheDocument()
  })

  it('shows an error banner with retry when loading fails', async () => {
    mockAccounts()
    const reload = vi.fn()
    useInvestmentsHistory.mockReturnValue({ investments: [], loading: false, error: { message: 'fail' }, reload })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getByText(/couldn.t load stats/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(reload).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- StatsPage`
Expected: FAIL — `StatsPage.jsx` does not exist.

- [ ] **Step 3: Implement the page**

`src/pages/StatsPage.jsx`:
```jsx
import { useState } from 'react'
import './StatsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestmentsHistory } from '../hooks/useInvestmentsHistory'
import { computeInvestmentStats } from '../lib/investmentStats'
import { formatCurrency } from '../lib/format'
import Header from '../components/Header'
import StatsCharts from '../components/StatsCharts'

function StatTile({ label, value, tone }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-label">{label}</span>
      <span className={`stat-tile-value mono ${tone ? `stat-tile-value--${tone}` : ''}`}>{value}</span>
    </div>
  )
}

export default function StatsPage() {
  const { user } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount } = useAccounts(user?.id)
  const { investments, loading, error, reload } = useInvestmentsHistory(activeAccountId)
  const [view, setView] = useState('numbers')

  const stats = computeInvestmentStats(investments)

  return (
    <div data-testid="stats-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        onAddTrade={() => {}}
        addLabel=""
      />

      <div className="stats-toolbar">
        <div className="view-toggle">
          <button type="button" aria-pressed={view === 'numbers'} onClick={() => setView('numbers')}>Numbers</button>
          <button type="button" aria-pressed={view === 'charts'} onClick={() => setView('charts')}>Charts</button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>Couldn't load stats.</span>
          <button type="button" onClick={reload}>Retry</button>
        </div>
      )}

      {!loading && view === 'charts' && <StatsCharts stats={stats} />}

      {!loading && view === 'numbers' && (
        <div className="stats-numbers">
          <section className="stats-section">
            <h2 className="stats-section-title">Overview</h2>
            <div className="stat-tile-grid">
              <StatTile label="Total Realized P&L" value={formatCurrency(stats.totalRealizedPnl)} tone={stats.totalRealizedPnl >= 0 ? 'positive' : 'negative'} />
              <StatTile label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
              <StatTile label="Closed Positions" value={stats.totalClosed} />
              <StatTile label="Open Positions" value={stats.totalOpen} />
              <StatTile label="Avg Win" value={formatCurrency(stats.avgWin)} tone="positive" />
              <StatTile label="Avg Loss" value={formatCurrency(stats.avgLoss)} tone="negative" />
              <StatTile label="Best Trade" value={stats.bestTrade ? `${stats.bestTrade.symbol} · ${formatCurrency(stats.bestTrade ? Math.max(0, stats.totalRealizedPnl) : 0)}` : '—'} tone="positive" />
              <StatTile label="Worst Trade" value={stats.worstTrade ? stats.worstTrade.symbol : '—'} tone="negative" />
            </div>
          </section>

          <section className="stats-section">
            <h2 className="stats-section-title">Stocks</h2>
            <div className="stat-tile-grid">
              <StatTile label="Closed Stock P&L" value={formatCurrency(stats.stock.totalPnl)} tone={stats.stock.totalPnl >= 0 ? 'positive' : 'negative'} />
              <StatTile label="Stock Win Rate" value={`${stats.stock.winRate.toFixed(1)}%`} />
              <StatTile label="Stock Positions Closed" value={stats.stock.count} />
            </div>
          </section>

          <section className="stats-section">
            <h2 className="stats-section-title">Options</h2>
            <div className="stat-tile-grid">
              <StatTile label="Closed Option P&L" value={formatCurrency(stats.options.totalPnl)} tone={stats.options.totalPnl >= 0 ? 'positive' : 'negative'} />
              <StatTile label="Option Win Rate" value={`${stats.options.winRate.toFixed(1)}%`} />
              <StatTile label="Option Positions Closed" value={stats.options.count} />
              <StatTile label="Total Premium Collected" value={formatCurrency(stats.options.totalPremiumCollected)} tone="positive" />
            </div>
          </section>

          <section className="stats-section">
            <h2 className="stats-section-title">By Strategy</h2>
            <table className="stats-table">
              <thead>
                <tr><th>Strategy</th><th>Count</th><th>Win Rate</th><th>Total P&L</th></tr>
              </thead>
              <tbody>
                {stats.byStrategy.map((row) => (
                  <tr key={row.strategy}>
                    <td>{row.label}</td>
                    <td className="mono">{row.count}</td>
                    <td className="mono">{row.winRate.toFixed(1)}%</td>
                    <td className={`mono ${row.totalPnl >= 0 ? 'stat-tile-value--positive' : 'stat-tile-value--negative'}`}>{formatCurrency(row.totalPnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="stats-section">
            <h2 className="stats-section-title">By Symbol</h2>
            <table className="stats-table">
              <thead>
                <tr><th>Symbol</th><th>Count</th><th>Total P&L</th></tr>
              </thead>
              <tbody>
                {stats.bySymbol.map((row) => (
                  <tr key={row.symbol}>
                    <td>{row.symbol}</td>
                    <td className="mono">{row.count}</td>
                    <td className={`mono ${row.totalPnl >= 0 ? 'stat-tile-value--positive' : 'stat-tile-value--negative'}`}>{formatCurrency(row.totalPnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  )
}
```

**Note:** `Header`'s `onAddTrade`/`addLabel` props are required by its signature but not meaningful here — passing a no-op and empty label renders an empty-label button. This is acceptable for this task; if it looks wrong when manually tested in Task 6, tighten `Header` to accept an `showAddButton` flag as a follow-up (not blocking this plan).

Temporary stub so this task's tests around the Numbers/Charts toggle pass before Task 4 exists:

`src/components/StatsCharts.jsx` (temporary — Task 4 replaces this):
```jsx
export default function StatsCharts() {
  return <div data-testid="stats-charts">Charts loading…</div>
}
```

- [ ] **Step 4: Write `StatsPage.css`**

```css
.stats-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 16px 32px 0;
}

.view-toggle {
  display: flex;
  gap: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
}

.view-toggle button {
  background: transparent;
  border: none;
  color: var(--text-dim);
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.view-toggle button[aria-pressed="true"] {
  background: var(--bg);
  color: var(--green);
}

.stats-numbers {
  padding: 20px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.stats-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.stat-tile-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.stat-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
}

.stat-tile-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

.stat-tile-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.stat-tile-value--positive {
  color: var(--green);
}

.stat-tile-value--negative {
  color: var(--red);
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.stats-table th {
  text-align: left;
  color: var(--text-dim);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.stats-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- StatsPage`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/pages/StatsPage.jsx src/pages/StatsPage.css src/pages/StatsPage.test.jsx src/components/StatsCharts.jsx
git commit -m "feat: implement StatsPage numbers view with Numbers/Charts toggle"
```

---

## Task 4: `StatsCharts` component

**Files:**
- Modify: `src/components/StatsCharts.jsx` (replacing the Task 3 stub)
- Test: `src/components/StatsCharts.test.jsx`

**Interfaces:**
- Consumes: the `stats` object shape produced by `computeInvestmentStats` (Task 2).
- Produces: `<StatsCharts stats={stats} />`, rendered by `StatsPage` (Task 3, already wired) when `view === 'charts'`.

- [ ] **Step 1: Load the dataviz skill**

Before writing any chart code, invoke the `dataviz` skill (`Skill({ skill: 'dataviz' })`) to get the palette, mark specs, and layout guidance this codebase should follow. Apply its palette/contrast rules to the chart colors below instead of picking colors ad hoc.

- [ ] **Step 2: Install `recharts`**

```bash
npm install recharts
```

- [ ] **Step 3: Write the failing tests**

`src/components/StatsCharts.test.jsx`:
```js
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatsCharts from './StatsCharts'

const stats = {
  totalRealizedPnl: 550,
  winRate: 66.7,
  totalClosed: 3,
  totalOpen: 1,
  avgWin: 400,
  avgLoss: -250,
  bestTrade: { symbol: 'AAPL' },
  worstTrade: { symbol: 'TSLA' },
  stock: { count: 2, totalPnl: 250, winRate: 50, avgWin: 500, avgLoss: -250 },
  options: { count: 1, totalPnl: 300, winRate: 100, avgWin: 300, avgLoss: 0, totalPremiumCollected: 300 },
  byStrategy: [{ strategy: 'cash_secured_put', label: 'Cash Secured Put', count: 1, totalPnl: 300, winRate: 100 }],
  bySymbol: [
    { symbol: 'AAPL', count: 2, totalPnl: 800 },
    { symbol: 'TSLA', count: 1, totalPnl: -250 },
  ],
  equityCurve: [
    { date: '2026-01-05', cumulative: -250 },
    { date: '2026-01-10', cumulative: 250 },
    { date: '2026-01-20', cumulative: 550 },
  ],
}

describe('StatsCharts', () => {
  it('renders the charts container', () => {
    render(<StatsCharts stats={stats} />)
    expect(screen.getByTestId('stats-charts')).toBeInTheDocument()
  })

  it('renders a heading for each chart', () => {
    render(<StatsCharts stats={stats} />)
    expect(screen.getByText(/equity curve/i)).toBeInTheDocument()
    expect(screen.getByText(/p&l by strategy/i)).toBeInTheDocument()
    expect(screen.getByText(/win.*loss/i)).toBeInTheDocument()
    expect(screen.getByText(/p&l by symbol/i)).toBeInTheDocument()
  })

  it('shows an empty message instead of a chart when there is no closed data', () => {
    const empty = { ...stats, totalClosed: 0, byStrategy: [], bySymbol: [], equityCurve: [] }
    render(<StatsCharts stats={empty} />)
    expect(screen.getByText(/no closed positions yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test -- StatsCharts`
Expected: FAIL — current stub only renders "Charts loading…".

- [ ] **Step 5: Implement the component**

Using the palette and guidance loaded from the `dataviz` skill in Step 1, implement `src/components/StatsCharts.jsx` with four `recharts` charts:
- `ResponsiveContainer` + `LineChart` for `stats.equityCurve` (x: `date`, y: `cumulative`).
- `ResponsiveContainer` + `BarChart` for `stats.byStrategy` (x: `label`, y: `totalPnl`).
- `ResponsiveContainer` + `PieChart` for win/loss split, derived from `stats.totalClosed`, `stats.winRate` (wins = `Math.round(totalClosed * winRate / 100)`, losses = `totalClosed - wins`).
- `ResponsiveContainer` + `BarChart` for `stats.bySymbol.slice(0, 10)` (x: `symbol`, y: `totalPnl`).

Each chart section has a heading (`<h3>Equity Curve</h3>`, `<h3>P&L by Strategy</h3>`, `<h3>Win/Loss</h3>`, `<h3>P&L by Symbol</h3>`) matching the test's case-insensitive regex matches. When `stats.totalClosed === 0`, render a single `<p>No closed positions yet — stats will appear here once you close a position.</p>` instead of the four chart sections (still inside the `data-testid="stats-charts"` wrapper).

Follow the dataviz skill's mark/color/accessibility guidance for the actual chart styling (bar colors, gridlines, tooltips, dark-mode contrast) rather than improvising — this step's exact CSS/JSX is intentionally left to be derived from that skill's output rather than hardcoded here.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- StatsCharts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/StatsCharts.jsx src/components/StatsCharts.test.jsx package.json package-lock.json
git commit -m "feat: implement StatsCharts (equity curve, by-strategy, win/loss, by-symbol)"
```

---

## Task 5: Wire `/stats` to `StatsPage`

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

**Interfaces:**
- Produces: `/stats` renders `StatsPage` instead of `PlaceholderPage`.

- [ ] **Step 1: Update the failing test**

Add to `src/App.test.jsx` (mock `useInvestmentsHistory` alongside the existing mocks):
```js
import { useInvestmentsHistory } from './hooks/useInvestmentsHistory'
vi.mock('./hooks/useInvestmentsHistory')
```
and a new test:
```js
  it('renders StatsPage at /stats', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' }, session: {}, loading: false, signOut: vi.fn() })
    useAccounts.mockReturnValue({
      accounts: [{ id: 'a1', name: 'Main Account' }],
      activeAccount: { id: 'a1', name: 'Main Account' },
      activeAccountId: 'a1',
      switchAccount: vi.fn(),
      createAccount: vi.fn(),
      loading: false,
    })
    useInvestmentsHistory.mockReturnValue({ investments: [], loading: false, error: null, reload: vi.fn() })

    render(<MemoryRouter initialEntries={['/stats']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('stats-page')).toBeInTheDocument())
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- App.test`
Expected: FAIL — `/stats` still renders `PlaceholderPage`.

- [ ] **Step 3: Update `App.jsx`**

Replace the `PlaceholderPage` import's Stats usage:
```jsx
import StatsPage from './pages/StatsPage'
// ...
<Route path="/stats" element={<RequireAuth user={user}><StatsPage /></RequireAuth>} />
```
Leave `/analyze` and `/matt-cap` on `PlaceholderPage` — only `/stats` changes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- App.test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat: wire /stats to StatsPage"
```

---

## Task 6: Full test suite pass and manual smoke test

**Files:** none (verification-only task).

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Manual smoke test against the live Supabase project**

Run `npm run dev`, navigate to `/stats`:
1. Confirm the Numbers view shows Overview/Stocks/Options tiles and By Strategy/By Symbol tables (likely all zeros/empty if no positions have been closed yet in this account — that's expected).
2. Click "Charts" — confirm the toggle switches views and (if no closed positions exist) the "No closed positions yet" message appears instead of empty/broken charts.
3. If any positions are closed during this session (via the Close button on `/`), confirm Stats numbers update after reloading `/stats`.
4. Check that `Header`'s Add button renders reasonably (empty label) on this page — if it looks broken, note it as a quick follow-up fix (add a `showAddButton` prop to `Header` defaulting to true, set false here) rather than blocking this plan.

- [ ] **Step 3: Fix any issues found, re-run affected unit tests, and commit fixes**

If manual testing surfaces a bug (including the Header Add-button cosmetic issue from Step 2.4), fix it, re-run that file's test suite, and commit with a `fix:` message.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Stats page (Investments) complete"
```
