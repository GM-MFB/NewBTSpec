# Day Trading Tab Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Day Trading tab so trades (Stock, Call, Put, Futures) are logged already-closed in one step, the main page shows a monthly P&L calendar plus the full trade list, and a Stats sub-tab shows dedicated day-trading analytics.

**Architecture:** New pure-function libs (`tradeStats.js` for per-trade P&L, `futuresContracts.js` for the point-value lookup, `tradeCalendar.js` for month-grid bucketing, `tradeStatsSummary.js` for aggregate stats) feed a redesigned `AddTradeModal` (now supports Stock + edit mode), a redesigned `TradeRow` (click-to-expand, matching the recent `InvestmentRow` pattern), a new `TradeCalendar` component, a new `TradeStatsCharts` component, and a tabbed `TradesPage`.

**Tech Stack:** React 19, Vite, Vitest + Testing Library, `recharts` (already a dependency), `react-router-dom`. No new npm packages, no new date library — plain `Date` math for the calendar grid.

## Global Constraints

- Do not modify `database-reference.md`-tracked schema directly — only additive migrations, and you (the user) run the SQL yourself in Supabase. The one migration this plan needs is below; run it before starting Task 1.
- TDD discipline: write failing test → run → confirm FAIL → implement → run → confirm PASS → commit, for every task.
- Follow the existing dark-theme CSS custom-property conventions (`--bg`, `--bg-elevated`, `--border`, `--text`, `--text-dim`, `--green`, `--red`, uppercase small section-header labels, `.mono` for tabular numerics) already used throughout `src/components/InvestmentRow.css`, `src/pages/StatsPage.css`, etc.
- Reuse existing generic stylesheets where the class names are already generic enough (`src/pages/StatsPage.css` for stat tiles/date-range filter, `src/components/StatsCharts.css` for chart cards) rather than duplicating CSS.
- `oxlint`/existing lint conventions: 2-space indent, single quotes in `.js`/`.jsx`, no semicolons in files that already omit them (all files touched in this plan currently omit semicolons except `Header.jsx`/`App.jsx`, which use them — match each file's existing style).

## Required Migration (run this first, in Supabase SQL editor)

```sql
alter table trades add column point_value numeric;
```

This is nullable and only ever set for `type = 'futures'` trades — no other column changes.

---

### Task 1: `point_value` in trade mappers

**Files:**
- Modify: `src/lib/tradeMappers.js`
- Test: `src/lib/tradeMappers.test.js` (create if it doesn't already exist — check first with `ls src/lib/tradeMappers.test.js`; if it exists, add to it instead of replacing it)

**Interfaces:**
- Consumes: nothing new.
- Produces: `fromRow(row).pointValue` and `toRow(trade).point_value` — used by `useTrades.js` (Task 6) and `AddTradeModal.jsx` (Task 7).

- [ ] **Step 1: Write the failing test**

```js
// src/lib/tradeMappers.test.js (add these if the file exists; create it with this content if not)
import { describe, it, expect } from 'vitest'
import { fromRow, toRow } from './tradeMappers'

describe('tradeMappers', () => {
  it('maps point_value to pointValue and back', () => {
    const row = {
      id: 't1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      type: 'futures', symbol: 'ES', option_type: null, strike: null, expiry: null,
      direction: 'long', quantity: 1, entry_price: 4500, exit_price: 4550,
      entry_date: '2026-01-01', exit_date: '2026-01-01', status: 'closed',
      fees: 0, notes: null, chart_link: null, point_value: 50,
    }
    const trade = fromRow(row)
    expect(trade.pointValue).toBe(50)
    expect(toRow(trade).point_value).toBe(50)
  })

  it('maps a blank pointValue to null in toRow', () => {
    expect(toRow({ pointValue: '' }).point_value).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tradeMappers.test`
Expected: FAIL — `trade.pointValue` is `undefined`, not `50`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/tradeMappers.js`, add to `fromRow`'s returned object (after `chartLink`):

```js
    chartLink: row.chart_link ?? '',
    pointValue: row.point_value ?? '',
```

Add to `toRow`'s returned object (after `chart_link`):

```js
    chart_link: blankToNull(trade.chartLink),
    point_value: blankToNull(trade.pointValue),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tradeMappers.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/tradeMappers.js src/lib/tradeMappers.test.js
git commit -m "feat: map point_value/pointValue for futures trades"
```

---

### Task 2: Futures point-value lookup table

**Files:**
- Create: `src/lib/futuresContracts.js`
- Test: `src/lib/futuresContracts.test.js`

**Interfaces:**
- Produces: `lookupPointValue(symbol) → number | undefined`. Consumed by `AddTradeModal.jsx` (Task 7).

- [ ] **Step 1: Write the failing test**

```js
// src/lib/futuresContracts.test.js
import { describe, it, expect } from 'vitest'
import { lookupPointValue } from './futuresContracts'

describe('lookupPointValue', () => {
  it('returns the point value for a known contract', () => {
    expect(lookupPointValue('ES')).toBe(50)
    expect(lookupPointValue('MES')).toBe(5)
    expect(lookupPointValue('CL')).toBe(1000)
  })

  it('is case-insensitive', () => {
    expect(lookupPointValue('es')).toBe(50)
  })

  it('returns undefined for an unknown symbol', () => {
    expect(lookupPointValue('ZZZZ')).toBeUndefined()
  })

  it('returns undefined for blank input', () => {
    expect(lookupPointValue('')).toBeUndefined()
    expect(lookupPointValue(undefined)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run futuresContracts.test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/futuresContracts.js
const POINT_VALUES = {
  ES: 50, MES: 5, NQ: 20, MNQ: 2, YM: 5, MYM: 0.5, RTY: 50, M2K: 5,
  CL: 1000, MCL: 100, GC: 100, MGC: 10, SI: 5000, NG: 10000, ZB: 1000, ZN: 1000,
}

export function lookupPointValue(symbol) {
  if (!symbol) return undefined
  return POINT_VALUES[symbol.trim().toUpperCase()]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run futuresContracts.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/futuresContracts.js src/lib/futuresContracts.test.js
git commit -m "feat: add futures point-value lookup table"
```

---

### Task 3: Per-trade P&L and type-label helpers

**Files:**
- Create: `src/lib/tradeStats.js`
- Test: `src/lib/tradeStats.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `pnlFor(trade) → number | null` and `tradeTypeLabel(trade) → string`. Both consumed by `tradeCalendar.js` (Task 4), `tradeStatsSummary.js` (Task 5), and `TradeRow.jsx` (Task 8).
- `trade` shape: `{ type: 'stock'|'option'|'futures', optionType: 'call'|'put'|'', direction: 'long'|'short', quantity, entryPrice, exitPrice, fees, pointValue }` (camelCase, matches `fromRow` output from Task 1).

- [ ] **Step 1: Write the failing test**

```js
// src/lib/tradeStats.test.js
import { describe, it, expect } from 'vitest'
import { pnlFor, tradeTypeLabel } from './tradeStats'

describe('pnlFor', () => {
  it('returns null when exitPrice is missing (legacy open trade)', () => {
    const trade = { type: 'stock', direction: 'long', quantity: 10, entryPrice: 100, exitPrice: '', fees: 0 }
    expect(pnlFor(trade)).toBeNull()
  })

  it('computes stock P&L: (exit-entry)*qty - fees, long', () => {
    const trade = { type: 'stock', direction: 'long', quantity: 10, entryPrice: 100, exitPrice: 105, fees: 1 }
    expect(pnlFor(trade)).toBe(49) // (105-100)*10 - 1
  })

  it('flips sign for a short stock trade', () => {
    const trade = { type: 'stock', direction: 'short', quantity: 10, entryPrice: 100, exitPrice: 105, fees: 0 }
    expect(pnlFor(trade)).toBe(-50) // (100-105)*10
  })

  it('computes option P&L with the x100 contract multiplier', () => {
    const trade = { type: 'option', optionType: 'call', direction: 'long', quantity: 2, entryPrice: 1.5, exitPrice: 2.0, fees: 2 }
    expect(pnlFor(trade)).toBe(98) // (2.0-1.5)*2*100 - 2
  })

  it('computes futures P&L using pointValue', () => {
    const trade = { type: 'futures', direction: 'long', quantity: 1, entryPrice: 4500, exitPrice: 4510, pointValue: 50, fees: 4 }
    expect(pnlFor(trade)).toBe(496) // (4510-4500)*1*50 - 4
  })

  it('treats a blank fees as zero', () => {
    const trade = { type: 'stock', direction: 'long', quantity: 1, entryPrice: 10, exitPrice: 20, fees: '' }
    expect(pnlFor(trade)).toBe(10)
  })
})

describe('tradeTypeLabel', () => {
  it('labels a call option', () => {
    expect(tradeTypeLabel({ type: 'option', optionType: 'call' })).toBe('Call')
  })

  it('labels a put option', () => {
    expect(tradeTypeLabel({ type: 'option', optionType: 'put' })).toBe('Put')
  })

  it('labels futures', () => {
    expect(tradeTypeLabel({ type: 'futures' })).toBe('Futures')
  })

  it('labels stock', () => {
    expect(tradeTypeLabel({ type: 'stock' })).toBe('Stock')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tradeStats.test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/tradeStats.js
function toNum(value) {
  return value === '' || value === undefined || value === null ? 0 : Number(value)
}

function isBlank(value) {
  return value === '' || value === undefined || value === null
}

export function pnlFor(trade) {
  if (isBlank(trade.exitPrice) || isBlank(trade.entryPrice)) return null

  const sign = trade.direction === 'short' ? -1 : 1
  const rawMove = (toNum(trade.exitPrice) - toNum(trade.entryPrice)) * sign
  const quantity = toNum(trade.quantity)
  const fees = toNum(trade.fees)

  let gross
  if (trade.type === 'option') {
    gross = rawMove * quantity * 100
  } else if (trade.type === 'futures') {
    gross = rawMove * quantity * toNum(trade.pointValue)
  } else {
    gross = rawMove * quantity
  }

  return gross - fees
}

export function tradeTypeLabel(trade) {
  if (trade.type === 'option') {
    if (trade.optionType === 'put') return 'Put'
    if (trade.optionType === 'call') return 'Call'
    return 'Option'
  }
  if (trade.type === 'futures') return 'Futures'
  if (trade.type === 'stock') return 'Stock'
  return trade.type || ''
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tradeStats.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/tradeStats.js src/lib/tradeStats.test.js
git commit -m "feat: add pnlFor and tradeTypeLabel helpers"
```

---

### Task 4: Month-grid calendar bucketing

**Files:**
- Create: `src/lib/tradeCalendar.js`
- Test: `src/lib/tradeCalendar.test.js`

**Interfaces:**
- Consumes: `pnlFor` from `src/lib/tradeStats.js` (Task 3).
- Produces: `buildMonthGrid(trades, year, month) → cellRow[]` where `month` is 0-indexed (JS `Date` convention, January = 0) and each row is an array of 7 cells: `{ date: 'YYYY-MM-DD'|null, dayNum: number, inMonth: boolean, pnl: number|null }`. Always exactly 6 rows × 7 columns (42 cells). Consumed by `TradeCalendar.jsx` (Task 9).

- [ ] **Step 1: Write the failing test**

```js
// src/lib/tradeCalendar.test.js
import { describe, it, expect } from 'vitest'
import { buildMonthGrid } from './tradeCalendar'

describe('buildMonthGrid', () => {
  it('returns 6 rows of 7 cells each', () => {
    const rows = buildMonthGrid([], 2026, 0) // January 2026
    expect(rows).toHaveLength(6)
    for (const row of rows) expect(row).toHaveLength(7)
  })

  it('marks in-month days with the correct day numbers', () => {
    const rows = buildMonthGrid([], 2026, 0) // January 2026 has 31 days
    const inMonthCells = rows.flat().filter((c) => c.inMonth)
    expect(inMonthCells).toHaveLength(31)
    expect(inMonthCells[0].dayNum).toBe(1)
    expect(inMonthCells[0].date).toBe('2026-01-01')
    expect(inMonthCells[30].dayNum).toBe(31)
    expect(inMonthCells[30].date).toBe('2026-01-31')
  })

  it('marks leading/trailing days from adjacent months as not in-month', () => {
    const rows = buildMonthGrid([], 2026, 0)
    const outsideCells = rows.flat().filter((c) => !c.inMonth)
    expect(outsideCells.length).toBeGreaterThan(0)
    for (const cell of outsideCells) {
      expect(cell.date).toBeNull()
      expect(cell.pnl).toBeNull()
    }
  })

  it('sums P&L for multiple trades closed on the same day', () => {
    const trades = [
      { type: 'stock', direction: 'long', quantity: 10, entryPrice: 100, exitPrice: 105, exitDate: '2026-01-15', fees: 0 },
      { type: 'stock', direction: 'long', quantity: 5, entryPrice: 50, exitPrice: 45, exitDate: '2026-01-15', fees: 0 },
    ]
    const rows = buildMonthGrid(trades, 2026, 0)
    const day15 = rows.flat().find((c) => c.date === '2026-01-15')
    expect(day15.pnl).toBe(25) // (105-100)*10 + (45-50)*5 = 50 - 25
  })

  it('leaves days with no trades at pnl null', () => {
    const rows = buildMonthGrid([], 2026, 0)
    const day10 = rows.flat().find((c) => c.date === '2026-01-10')
    expect(day10.pnl).toBeNull()
  })

  it('excludes legacy open trades (no exitDate) from the grid entirely', () => {
    const trades = [
      { type: 'stock', direction: 'long', quantity: 1, entryPrice: 100, exitPrice: '', exitDate: '', fees: 0 },
    ]
    const rows = buildMonthGrid(trades, 2026, 0)
    const totalPnl = rows.flat().reduce((sum, c) => sum + (c.pnl ?? 0), 0)
    expect(totalPnl).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tradeCalendar.test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/tradeCalendar.js
import { pnlFor } from './tradeStats'

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function buildMonthGrid(trades, year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startDay = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const pnlByDate = new Map()
  for (const trade of trades) {
    if (!trade.exitDate) continue
    const pnl = pnlFor(trade)
    if (pnl === null) continue
    pnlByDate.set(trade.exitDate, (pnlByDate.get(trade.exitDate) ?? 0) + pnl)
  }

  const cells = []

  for (let i = 0; i < startDay; i++) {
    cells.push({ date: null, dayNum: prevMonthDays - startDay + 1 + i, inMonth: false, pnl: null })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${pad2(month + 1)}-${pad2(d)}`
    cells.push({ date, dayNum: d, inMonth: true, pnl: pnlByDate.get(date) ?? null })
  }

  let nextDay = 1
  while (cells.length < 42) {
    cells.push({ date: null, dayNum: nextDay, inMonth: false, pnl: null })
    nextDay += 1
  }

  const rows = []
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7))
  }
  return rows
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tradeCalendar.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/tradeCalendar.js src/lib/tradeCalendar.test.js
git commit -m "feat: add buildMonthGrid for the trade calendar"
```

---

### Task 5: Aggregate trade stats

**Files:**
- Create: `src/lib/tradeStatsSummary.js`
- Test: `src/lib/tradeStatsSummary.test.js`

**Interfaces:**
- Consumes: `pnlFor`, `tradeTypeLabel` from `src/lib/tradeStats.js` (Task 3).
- Produces: `computeTradeStats(trades) → { totalRealizedPnl, winRate, totalClosed, avgWin, avgLoss, bestTrade, worstTrade, byType: [{type, count, totalPnl, winRate, avgWin, avgLoss}], bySymbol: [{symbol, count, totalPnl}], equityCurve: [{date, cumulative}] }`. Consumed by `TradesPage.jsx` (Task 11) and `TradeStatsCharts.jsx` (Task 10).

- [ ] **Step 1: Write the failing test**

```js
// src/lib/tradeStatsSummary.test.js
import { describe, it, expect } from 'vitest'
import { computeTradeStats } from './tradeStatsSummary'

const trades = [
  { id: 't1', type: 'stock', symbol: 'AAPL', direction: 'long', quantity: 10, entryPrice: 100, exitPrice: 110, exitDate: '2026-01-05', fees: 0 },
  { id: 't2', type: 'stock', symbol: 'AAPL', direction: 'long', quantity: 10, entryPrice: 50, exitPrice: 45, exitDate: '2026-01-10', fees: 0 },
  { id: 't3', type: 'option', optionType: 'call', symbol: 'SPY', direction: 'long', quantity: 1, entryPrice: 1, exitPrice: 2, exitDate: '2026-01-12', fees: 0 },
  { id: 't4', type: 'stock', symbol: 'MSFT', direction: 'long', quantity: 1, entryPrice: 100, exitPrice: '', exitDate: '', fees: 0 }, // legacy open
]

describe('computeTradeStats', () => {
  it('excludes legacy open trades from totalClosed', () => {
    const stats = computeTradeStats(trades)
    expect(stats.totalClosed).toBe(3)
  })

  it('computes totalRealizedPnl as the sum of all closed trades P&L', () => {
    const stats = computeTradeStats(trades)
    // t1: +100, t2: -50, t3: +100
    expect(stats.totalRealizedPnl).toBe(150)
  })

  it('computes win rate as a percentage of winning closed trades', () => {
    const stats = computeTradeStats(trades)
    expect(stats.winRate).toBeCloseTo((2 / 3) * 100)
  })

  it('finds best and worst trade by P&L', () => {
    const stats = computeTradeStats(trades)
    expect(stats.bestTrade.id).toBe('t1')
    expect(stats.worstTrade.id).toBe('t2')
  })

  it('groups by type label', () => {
    const stats = computeTradeStats(trades)
    const stockGroup = stats.byType.find((g) => g.type === 'Stock')
    const callGroup = stats.byType.find((g) => g.type === 'Call')
    expect(stockGroup.count).toBe(2)
    expect(stockGroup.totalPnl).toBe(50)
    expect(callGroup.count).toBe(1)
    expect(callGroup.totalPnl).toBe(100)
  })

  it('groups by symbol, sorted by totalPnl descending', () => {
    const stats = computeTradeStats(trades)
    expect(stats.bySymbol.map((s) => s.symbol)).toEqual(['AAPL', 'SPY'])
    expect(stats.bySymbol[0].totalPnl).toBe(50) // AAPL: +100 - 50
  })

  it('builds an equity curve sorted by exit date with running totals', () => {
    const stats = computeTradeStats(trades)
    expect(stats.equityCurve).toEqual([
      { date: '2026-01-05', cumulative: 100 },
      { date: '2026-01-10', cumulative: 50 },
      { date: '2026-01-12', cumulative: 150 },
    ])
  })

  it('returns zeroed stats for an empty list', () => {
    const stats = computeTradeStats([])
    expect(stats.totalClosed).toBe(0)
    expect(stats.totalRealizedPnl).toBe(0)
    expect(stats.bestTrade).toBeNull()
    expect(stats.worstTrade).toBeNull()
    expect(stats.byType).toEqual([])
    expect(stats.bySymbol).toEqual([])
    expect(stats.equityCurve).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tradeStatsSummary.test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/tradeStatsSummary.js
import { pnlFor, tradeTypeLabel } from './tradeStats'

function winLossStats(pnls) {
  const wins = pnls.filter((p) => p > 0)
  const losses = pnls.filter((p) => p < 0)
  const totalPnl = pnls.reduce((sum, p) => sum + p, 0)
  const winRate = pnls.length ? (wins.length / pnls.length) * 100 : 0
  const avgWin = wins.length ? wins.reduce((sum, p) => sum + p, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((sum, p) => sum + p, 0) / losses.length : 0
  return { count: pnls.length, totalPnl, winRate, avgWin, avgLoss }
}

export function computeTradeStats(trades) {
  const closed = trades.filter((t) => pnlFor(t) !== null)
  const pnls = closed.map(pnlFor)
  const overall = winLossStats(pnls)

  let bestTrade = null
  let worstTrade = null
  for (const trade of closed) {
    const pnl = pnlFor(trade)
    if (!bestTrade || pnl > pnlFor(bestTrade)) bestTrade = trade
    if (!worstTrade || pnl < pnlFor(worstTrade)) worstTrade = trade
  }

  const typeGroups = new Map()
  for (const trade of closed) {
    const label = tradeTypeLabel(trade)
    if (!typeGroups.has(label)) typeGroups.set(label, [])
    typeGroups.get(label).push(trade)
  }
  const byType = [...typeGroups.entries()].map(([type, items]) => ({
    type, ...winLossStats(items.map(pnlFor)),
  }))

  const symbolTotals = new Map()
  for (const trade of closed) {
    const pnl = pnlFor(trade)
    const existing = symbolTotals.get(trade.symbol) ?? { symbol: trade.symbol, count: 0, totalPnl: 0 }
    existing.count += 1
    existing.totalPnl += pnl
    symbolTotals.set(trade.symbol, existing)
  }
  const bySymbol = [...symbolTotals.values()].sort((a, b) => b.totalPnl - a.totalPnl)

  const timeline = closed
    .map((t) => ({ date: t.exitDate, pnl: pnlFor(t) }))
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
    avgWin: overall.avgWin,
    avgLoss: overall.avgLoss,
    bestTrade,
    worstTrade,
    byType,
    bySymbol,
    equityCurve,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tradeStatsSummary.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/tradeStatsSummary.js src/lib/tradeStatsSummary.test.js
git commit -m "feat: add computeTradeStats aggregate stats"
```

---

### Task 6: `useTrades` — load all trades, one-step closed trades

**Files:**
- Modify: `src/hooks/useTrades.js`
- Modify: `src/hooks/useTrades.test.js`

**Interfaces:**
- Produces: `useTrades(accountId) → { trades, loading, error, reload, addTrade, updateTrade, deleteTrade }` — `closeTrade` is removed. `addTrade(trade, userId)` now inserts with `status: 'closed'` (was `'open'`) and expects `trade` to already include `exitPrice`/`exitDate`. Consumed by `TradesPage.jsx` (Task 11).

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/hooks/useTrades.test.js`:

```js
// src/hooks/useTrades.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTrades } from './useTrades'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockSelectChain(data) {
  const order = vi.fn().mockResolvedValue({ data, error: null })
  const eq = vi.fn(() => ({ order }))
  return { select: vi.fn(() => ({ eq })) }
}

describe('useTrades', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads all trades for the account regardless of status, mapped to camelCase', async () => {
    const rows = [{
      id: 't1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      type: 'futures', symbol: 'ES', option_type: null, strike: null,
      expiry: null, direction: 'long', quantity: 1, entry_price: 4500,
      exit_price: 4550, entry_date: '2026-01-01', exit_date: '2026-01-01',
      status: 'closed', fees: 0, notes: null, chart_link: null, point_value: 50,
    }]
    supabase.from.mockReturnValue(mockSelectChain(rows))

    const { result } = renderHook(() => useTrades('a1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.trades).toHaveLength(1)
    expect(result.current.trades[0].symbol).toBe('ES')
    expect(result.current.trades[0].entryPrice).toBe(4500)
    expect(supabase.from).toHaveBeenCalledWith('trades')
  })

  it('addTrade inserts a row with status closed and the exit fields, then refreshes', async () => {
    supabase.from.mockReturnValue(mockSelectChain([]))
    const { result } = renderHook(() => useTrades('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const insertedRow = {
      id: 't2', account_id: 'a1', user_id: 'u1', created_at: '2026-01-02',
      type: 'stock', symbol: 'AAPL', option_type: null, strike: null,
      expiry: null, direction: 'long', quantity: 10, entry_price: 100,
      exit_price: 110, entry_date: '2026-01-02', exit_date: '2026-01-02',
      status: 'closed', fees: 0, notes: null, chart_link: null, point_value: null,
    }
    const single = vi.fn().mockResolvedValue({ data: insertedRow, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    supabase.from.mockReturnValue({ ...mockSelectChain([insertedRow]), insert })

    await act(async () => {
      await result.current.addTrade({
        type: 'stock', symbol: 'AAPL', direction: 'long', quantity: 10,
        entryPrice: 100, entryDate: '2026-01-02', exitPrice: 110, exitDate: '2026-01-02',
      }, 'u1')
    })

    expect(insert).toHaveBeenCalled()
    const insertArg = insert.mock.calls[0][0]
    expect(insertArg.account_id).toBe('a1')
    expect(insertArg.user_id).toBe('u1')
    expect(insertArg.status).toBe('closed')
    expect(insertArg.exit_price).toBe(110)
  })

  it('updateTrade merges the patch over the current trade and writes it', async () => {
    const rows = [{
      id: 't1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      type: 'stock', symbol: 'AAPL', option_type: null, strike: null,
      expiry: null, direction: 'long', quantity: 10, entry_price: 100,
      exit_price: 110, entry_date: '2026-01-01', exit_date: '2026-01-01',
      status: 'closed', fees: 0, notes: null, chart_link: null, point_value: null,
    }]
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    supabase.from.mockReturnValue({ ...mockSelectChain(rows), update })

    const { result } = renderHook(() => useTrades('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updateTrade('t1', { exitPrice: 120 })
    })

    const updateArg = update.mock.calls[0][0]
    expect(updateArg.symbol).toBe('AAPL')
    expect(updateArg.exit_price).toBe(120)
  })

  it('deleteTrade removes the row and refreshes', async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    const del = vi.fn(() => ({ eq: deleteEq }))
    supabase.from.mockReturnValue({ ...mockSelectChain([]), delete: del })

    const { result } = renderHook(() => useTrades('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteTrade('t1')
    })

    expect(del).toHaveBeenCalled()
    expect(deleteEq).toHaveBeenCalledWith('id', 't1')
  })

  it('does not expose closeTrade', async () => {
    supabase.from.mockReturnValue(mockSelectChain([]))
    const { result } = renderHook(() => useTrades('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.closeTrade).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run useTrades.test`
Expected: FAIL — old hook still filters by `status='open'` (extra `.eq` call breaks `mockSelectChain`'s single-`eq` shape) and still forces `status: 'open'` on insert.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/hooks/useTrades.js`:

```js
// src/hooks/useTrades.js
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { fromRow, toRow } from '../lib/tradeMappers'

export function useTrades(accountId) {
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('trades')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    setTrades(data.map(fromRow))
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    load()
  }, [load])

  async function addTrade(trade, userId) {
    const { data, error: err } = await supabase
      .from('trades')
      .insert({ account_id: accountId, user_id: userId, ...toRow({ ...trade, status: 'closed' }) })
      .select()
      .single()
    if (err) throw err
    await load()
    return fromRow(data)
  }

  async function updateTrade(id, patch) {
    const current = trades.find((t) => t.id === id)
    const { error: err } = await supabase.from('trades').update(toRow({ ...current, ...patch })).eq('id', id)
    if (err) throw err
    await load()
  }

  async function deleteTrade(id) {
    const { error: err } = await supabase.from('trades').delete().eq('id', id)
    if (err) throw err
    await load()
  }

  return { trades, loading, error, reload: load, addTrade, updateTrade, deleteTrade }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run useTrades.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTrades.js src/hooks/useTrades.test.js
git commit -m "feat: load all trades in useTrades and close trades in one step"
```

---

### Task 7: `AddTradeModal` — Stock type, exit fields, futures point value, edit mode

**Files:**
- Modify: `src/components/AddTradeModal.jsx`
- Modify: `src/components/AddTradeModal.test.jsx`

**Interfaces:**
- Consumes: `lookupPointValue` from `src/lib/futuresContracts.js` (Task 2).
- Produces: `AddTradeModal({ onClose, onSubmit, initialValues })` — same shape as `AddInvestmentModal`. Consumed by `TradesPage.jsx` (Task 11).

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/components/AddTradeModal.test.jsx`:

```jsx
// src/components/AddTradeModal.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddTradeModal from './AddTradeModal'

describe('AddTradeModal', () => {
  it('shows a Stock type option alongside Option and Futures', () => {
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^stock$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^option$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^futures$/i })).toBeInTheDocument()
  })

  it('requires exit price and exit date up front for a stock trade', async () => {
    const onSubmit = vi.fn()
    render(<AddTradeModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'AAPL')
    await userEvent.type(screen.getByLabelText(/quantity/i), '10')
    await userEvent.type(screen.getByLabelText(/entry price/i), '100')
    await userEvent.type(screen.getByLabelText(/entry date/i), '2026-01-01')
    await userEvent.type(screen.getByLabelText(/exit price/i), '110')
    await userEvent.type(screen.getByLabelText(/exit date/i), '2026-01-02')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'stock', symbol: 'AAPL', exitPrice: '110', exitDate: '2026-01-02',
    }))
  })

  it('shows option type/strike/expiry fields for an Option trade', async () => {
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^option$/i }))
    expect(screen.getByLabelText(/option type/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/strike/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/expiry/i)).toBeInTheDocument()
  })

  it('auto-fills the $ per Point field for a recognized futures symbol', async () => {
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^futures$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'ES')
    expect(screen.getByLabelText(/\$ per point/i)).toHaveValue(50)
  })

  it('leaves $ per Point blank and editable for an unrecognized futures symbol', async () => {
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^futures$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'ZZZZ')
    expect(screen.getByLabelText(/\$ per point/i)).toHaveValue(null)
    await userEvent.type(screen.getByLabelText(/\$ per point/i), '25')
    expect(screen.getByLabelText(/\$ per point/i)).toHaveValue(25)
  })

  it('pre-fills fields and locks the type toggle in edit mode', () => {
    const trade = {
      type: 'stock', symbol: 'AAPL', direction: 'long', quantity: 10,
      entryPrice: 100, entryDate: '2026-01-01', exitPrice: 110, exitDate: '2026-01-02', fees: 0,
    }
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} initialValues={trade} />)

    expect(screen.getByLabelText(/symbol/i)).toHaveValue('AAPL')
    expect(screen.getByLabelText(/exit price/i)).toHaveValue(110)
    expect(screen.getByRole('button', { name: /^stock$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^option$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^futures$/i })).toBeDisabled()
  })

  it('uses an "Edit Trade" dialog label in edit mode', () => {
    const trade = { type: 'stock', symbol: 'AAPL', direction: 'long', quantity: 10, entryPrice: 100, entryDate: '2026-01-01', exitPrice: 110, exitDate: '2026-01-02', fees: 0 }
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} initialValues={trade} />)
    expect(screen.getByRole('dialog', { name: /edit trade/i })).toBeInTheDocument()
  })

  it('shows an inline error and keeps entered values when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('insert failed'))
    render(<AddTradeModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'AAPL')
    await userEvent.type(screen.getByLabelText(/quantity/i), '10')
    await userEvent.type(screen.getByLabelText(/entry price/i), '100')
    await userEvent.type(screen.getByLabelText(/entry date/i), '2026-01-01')
    await userEvent.type(screen.getByLabelText(/exit price/i), '110')
    await userEvent.type(screen.getByLabelText(/exit date/i), '2026-01-02')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText(/insert failed/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/symbol/i)).toHaveValue('AAPL')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run AddTradeModal.test`
Expected: FAIL — no Stock button, no exit fields, no `$ per Point` field, no `initialValues` support.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/components/AddTradeModal.jsx`:

```jsx
// src/components/AddTradeModal.jsx
import { useState } from 'react'
import '../styles/modal.css'
import { lookupPointValue } from '../lib/futuresContracts'

const initial = {
  type: '', symbol: '', direction: 'long', quantity: '',
  entryPrice: '', entryDate: '', exitPrice: '', exitDate: '',
  fees: '', notes: '', chartLink: '',
  optionType: '', strike: '', expiry: '', pointValue: '',
}

export default function AddTradeModal({ onClose, onSubmit, initialValues }) {
  const isEdit = Boolean(initialValues)
  const [fields, setFields] = useState(() => ({ ...initial, ...initialValues }))
  const [error, setError] = useState(null)

  function set(key, value) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  function setSymbol(value) {
    const upper = value.toUpperCase()
    setFields((f) => {
      const next = { ...f, symbol: upper }
      if (f.type === 'futures' && !f.pointValue) {
        const looked = lookupPointValue(upper)
        if (looked !== undefined) next.pointValue = looked
      }
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit(fields)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-label={isEdit ? 'Edit Trade' : 'Add Trade'}>
      <div className="modal">
        <div className="type-toggle">
          <button type="button" disabled={isEdit} aria-pressed={fields.type === 'stock'} onClick={() => set('type', 'stock')}>Stock</button>
          <button type="button" disabled={isEdit} aria-pressed={fields.type === 'option'} onClick={() => set('type', 'option')}>Option</button>
          <button type="button" disabled={isEdit} aria-pressed={fields.type === 'futures'} onClick={() => set('type', 'futures')}>Futures</button>
        </div>

        {fields.type && (
          <form onSubmit={handleSubmit}>
            <label htmlFor="symbol">Symbol</label>
            <input id="symbol" value={fields.symbol} onChange={(e) => setSymbol(e.target.value)} required />

            <label htmlFor="direction">Direction</label>
            <select id="direction" value={fields.direction} onChange={(e) => set('direction', e.target.value)}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>

            {fields.type === 'option' && (
              <>
                <label htmlFor="optionType">Option Type</label>
                <select id="optionType" value={fields.optionType} onChange={(e) => set('optionType', e.target.value)} required>
                  <option value="">Select…</option>
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>

                <label htmlFor="strike">Strike</label>
                <input id="strike" type="number" value={fields.strike} onChange={(e) => set('strike', e.target.value)} required />

                <label htmlFor="expiry">Expiry</label>
                <input id="expiry" type="date" value={fields.expiry} onChange={(e) => set('expiry', e.target.value)} required />
              </>
            )}

            {fields.type === 'futures' && (
              <>
                <label htmlFor="pointValue">$ per Point</label>
                <input id="pointValue" type="number" step="0.01" value={fields.pointValue} onChange={(e) => set('pointValue', e.target.value)} required />
              </>
            )}

            <label htmlFor="quantity">Quantity</label>
            <input id="quantity" type="number" value={fields.quantity} onChange={(e) => set('quantity', e.target.value)} required />

            <label htmlFor="entryPrice">Entry Price</label>
            <input id="entryPrice" type="number" step="0.01" value={fields.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} required />

            <label htmlFor="entryDate">Entry Date</label>
            <input id="entryDate" type="date" value={fields.entryDate} onChange={(e) => set('entryDate', e.target.value)} required />

            <label htmlFor="exitPrice">Exit Price</label>
            <input id="exitPrice" type="number" step="0.01" value={fields.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} required />

            <label htmlFor="exitDate">Exit Date</label>
            <input id="exitDate" type="date" value={fields.exitDate} onChange={(e) => set('exitDate', e.target.value)} required />

            <label htmlFor="fees">Fees</label>
            <input id="fees" type="number" step="0.01" value={fields.fees} onChange={(e) => set('fees', e.target.value)} />

            <label htmlFor="notes">Notes</label>
            <textarea id="notes" value={fields.notes} onChange={(e) => set('notes', e.target.value)} />

            <label htmlFor="chartLink">Chart Link</label>
            <input id="chartLink" value={fields.chartLink} onChange={(e) => set('chartLink', e.target.value)} />

            {error && <p role="alert">{error}</p>}

            <div className="modal-actions">
              <button type="button" onClick={onClose}>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        )}

        {!fields.type && (
          <button type="button" onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run AddTradeModal.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/AddTradeModal.jsx src/components/AddTradeModal.test.jsx
git commit -m "feat: add Stock type, exit fields, and edit mode to AddTradeModal"
```

---

### Task 8: `TradeRow` redesign + delete `TradeDetailModal`

**Files:**
- Modify: `src/components/TradeRow.jsx`
- Modify: `src/components/TradeRow.css`
- Modify: `src/components/TradeRow.test.jsx`
- Delete: `src/components/TradeDetailModal.jsx`
- Delete: `src/components/TradeDetailModal.test.jsx`

**Interfaces:**
- Consumes: `pnlFor`, `tradeTypeLabel` from `src/lib/tradeStats.js` (Task 3); `abbreviateUrl`, `normalizeUrl` from `src/lib/url.js` (already exists — built for `InvestmentRow`); `formatCurrency` from `src/lib/format.js`.
- Produces: `TradeRow({ trade, onEdit, onDelete })` — `onClick`/`onCloseTrade` props are removed. Consumed by `TradesPage.jsx` (Task 11).

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/components/TradeRow.test.jsx`:

```jsx
// src/components/TradeRow.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TradeRow from './TradeRow'

function renderRow(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

const closedTrade = {
  id: 't1', symbol: 'AAPL', type: 'stock', direction: 'long',
  quantity: 10, entryPrice: 100, exitPrice: 110, exitDate: '2026-01-02', fees: 0,
}

const openTrade = {
  id: 't2', symbol: 'MSFT', type: 'stock', direction: 'long',
  quantity: 5, entryPrice: 200, exitPrice: '', exitDate: '', fees: 0,
}

describe('TradeRow', () => {
  it('renders symbol, type badge, direction, and P&L for a closed trade', () => {
    renderRow(<TradeRow trade={closedTrade} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Stock')).toBeInTheDocument()
    expect(screen.getByText(/long/i)).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument() // (110-100)*10
  })

  it('shows Call/Put badges derived from optionType', () => {
    const call = { ...closedTrade, type: 'option', optionType: 'call' }
    const { rerender } = renderRow(<TradeRow trade={call} />)
    expect(screen.getByText('Call')).toBeInTheDocument()

    const put = { ...closedTrade, type: 'option', optionType: 'put' }
    rerender(<MemoryRouter><TradeRow trade={put} /></MemoryRouter>)
    expect(screen.getByText('Put')).toBeInTheDocument()
  })

  it('shows an Open badge and no P&L for a legacy open trade', () => {
    renderRow(<TradeRow trade={openTrade} />)
    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('shows a Chart button linking to the Charts tab for this symbol', () => {
    renderRow(<TradeRow trade={closedTrade} />)
    const link = screen.getByRole('link', { name: /^chart$/i })
    expect(link).toHaveAttribute('href', '/charts?symbol=AAPL')
  })

  it('calls onEdit with the trade when Edit is clicked', async () => {
    const onEdit = vi.fn()
    renderRow(<TradeRow trade={closedTrade} onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(onEdit).toHaveBeenCalledWith(closedTrade)
  })

  it('hides Edit when no onEdit handler is provided', () => {
    renderRow(<TradeRow trade={closedTrade} />)
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
  })

  it('calls onDelete with the trade id when Delete is clicked, with no confirmation dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const onDelete = vi.fn()
    renderRow(<TradeRow trade={closedTrade} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(onDelete).toHaveBeenCalledWith('t1')
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('does not show the chart link/notes details panel until the row is clicked', () => {
    const trade = { ...closedTrade, chartLink: 'https://www.tradingview.com/chart/XYZ', notes: 'good setup' }
    renderRow(<TradeRow trade={trade} />)
    expect(screen.queryByText(/good setup/i)).not.toBeInTheDocument()
  })

  it('expands to show the chart link and notes when the row is clicked', async () => {
    const trade = { ...closedTrade, chartLink: 'https://www.tradingview.com/chart/XYZ', notes: 'good setup' }
    renderRow(<TradeRow trade={trade} />)
    await userEvent.click(screen.getByTestId('trade-row-clickable'))
    const link = screen.getByRole('link', { name: /tradingview\.com/i })
    expect(link).toHaveAttribute('href', 'https://www.tradingview.com/chart/XYZ')
    expect(screen.getByText('good setup')).toBeInTheDocument()
  })

  it('shows placeholder text in the details panel when there is no chart link or notes', async () => {
    renderRow(<TradeRow trade={closedTrade} />)
    await userEvent.click(screen.getByTestId('trade-row-clickable'))
    expect(screen.getByText(/no chart link/i)).toBeInTheDocument()
    expect(screen.getByText(/no notes/i)).toBeInTheDocument()
  })

  it('does not show a Close button', () => {
    renderRow(<TradeRow trade={closedTrade} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run TradeRow.test`
Expected: FAIL — old component has none of the new behavior (`onClick` prop, no P&L, no Chart/Edit buttons, no expand panel).

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/components/TradeRow.jsx`:

```jsx
// src/components/TradeRow.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import './TradeRow.css'
import { pnlFor, tradeTypeLabel } from '../lib/tradeStats'
import { formatCurrency } from '../lib/format'
import { abbreviateUrl, normalizeUrl } from '../lib/url'

export default function TradeRow({ trade, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const pnl = pnlFor(trade)
  const isOpen = pnl === null
  const pnlClass = pnl !== null ? (pnl >= 0 ? 'price-favorable' : 'price-unfavorable') : ''

  async function handleDelete() {
    try {
      await onDelete(trade.id)
    } catch (err) {
      window.alert(err.message)
    }
  }

  return (
    <li className="trade-row" data-testid="trade-row">
      <div
        className="trade-row-clickable"
        data-testid="trade-row-clickable"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
      >
        <div className="trade-row-top">
          <span className="mono trade-symbol">{trade.symbol}</span>
          <span className="trade-badge">{tradeTypeLabel(trade)}</span>
          <span className={`trade-direction trade-direction--${trade.direction}`}>{trade.direction}</span>
        </div>
        <div className="trade-row-meta mono">
          <span className="meta-item"><span className="meta-label">Qty:</span><span className="meta-value">{trade.quantity}</span></span>
          <span className="meta-item"><span className="meta-label">Entry:</span><span className="meta-value">{formatCurrency(trade.entryPrice)}</span></span>
          {isOpen ? (
            <span className="trade-open-badge">Open</span>
          ) : (
            <>
              <span className="meta-item"><span className="meta-label">Exit:</span><span className="meta-value">{formatCurrency(trade.exitPrice)}</span></span>
              <span className="meta-item"><span className="meta-label">P&L:</span><span className={`meta-value ${pnlClass}`}>{formatCurrency(pnl)}</span></span>
            </>
          )}
        </div>
      </div>

      <div className="trade-row-actions">
        <Link className="trade-chart-btn" to={`/charts?symbol=${encodeURIComponent(trade.symbol)}`}>Chart</Link>
        {onEdit && <button type="button" onClick={() => onEdit(trade)}>Edit</button>}
        {onDelete && <button type="button" className="danger" onClick={handleDelete}>Delete</button>}
      </div>

      {expanded && (
        <div className="trade-row-details">
          {trade.chartLink ? (
            <a className="trade-chart-link" href={normalizeUrl(trade.chartLink)} target="_blank" rel="noopener noreferrer">
              {abbreviateUrl(trade.chartLink)} ↗
            </a>
          ) : (
            <span className="trade-row-details-empty">No chart link added.</span>
          )}
          {trade.notes ? (
            <p className="trade-row-notes">{trade.notes}</p>
          ) : (
            <span className="trade-row-details-empty">No notes added.</span>
          )}
        </div>
      )}
    </li>
  )
}
```

Replace the full contents of `src/components/TradeRow.css`:

```css
/* src/components/TradeRow.css */
.trade-list {
  list-style: none;
  margin: 0;
  padding: 12px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trade-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 18px;
  transition: border-color 0.12s ease;
}

.trade-row:hover {
  border-color: var(--text-dim);
}

.trade-row-clickable {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 20px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.trade-row-top {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.trade-row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  font-size: 12.5px;
  color: var(--text);
  flex: 1;
}

.meta-item {
  display: inline-flex;
  gap: 4px;
}

.meta-label {
  color: var(--text-dim);
}

.trade-symbol {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.trade-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-dim);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 8px;
  width: fit-content;
}

.trade-direction {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.trade-direction--long { color: var(--green); }
.trade-direction--short { color: var(--red); }

.trade-open-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-dim);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 8px;
  width: fit-content;
}

.price-favorable { color: var(--green); }
.price-unfavorable { color: var(--red); }

.trade-row-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.trade-row-actions button,
.trade-chart-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.trade-row-actions button:hover,
.trade-chart-btn:hover {
  border-color: var(--green);
  color: var(--green);
}

.trade-row-actions button.danger:hover {
  border-color: var(--red);
  color: var(--red);
}

.trade-row-details {
  flex-basis: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  font-size: 12.5px;
}

.trade-row-details-empty {
  color: var(--text-dim);
  font-style: italic;
}

.trade-chart-link {
  font-size: 12px;
  color: var(--text-dim);
  text-decoration: none;
}

.trade-chart-link:hover {
  color: var(--green);
  text-decoration: underline;
}

.trade-row-notes {
  margin: 0;
  color: var(--text);
  white-space: pre-wrap;
}

@media (max-width: 640px) {
  .trade-row-actions {
    margin-left: 0;
  }
}
```

Delete the now-unused detail modal and its test:

```bash
git rm src/components/TradeDetailModal.jsx src/components/TradeDetailModal.test.jsx
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run TradeRow.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TradeRow.jsx src/components/TradeRow.css src/components/TradeRow.test.jsx
git commit -m "feat: redesign TradeRow with click-to-expand and Chart/Edit/Delete actions"
```

(The `git rm` from Step 3 stages the deletions — they're included in this same commit.)

---

### Task 9: `TradeCalendar` component

**Files:**
- Create: `src/components/TradeCalendar.jsx`
- Create: `src/components/TradeCalendar.css`
- Test: `src/components/TradeCalendar.test.jsx`

**Interfaces:**
- Consumes: `buildMonthGrid` from `src/lib/tradeCalendar.js` (Task 4); `formatCurrency` from `src/lib/format.js`.
- Produces: `TradeCalendar({ trades })`. Consumed by `TradesPage.jsx` (Task 11).

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/TradeCalendar.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TradeCalendar from './TradeCalendar'

function pad2(n) {
  return String(n).padStart(2, '0')
}

describe('TradeCalendar', () => {
  it('opens to the current month and renders 42 day cells', () => {
    render(<TradeCalendar trades={[]} />)
    expect(screen.getAllByTestId('trade-calendar-day')).toHaveLength(42)
  })

  it('shows the current month/year in the title', () => {
    const now = new Date()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    render(<TradeCalendar trades={[]} />)
    expect(screen.getByText(`${monthNames[now.getMonth()]} ${now.getFullYear()}`)).toBeInTheDocument()
  })

  it('shows the summed P&L for a day with trades, colored positive', () => {
    const now = new Date()
    const exitDate = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`
    const trades = [
      { type: 'stock', direction: 'long', quantity: 10, entryPrice: 100, exitPrice: 110, exitDate, fees: 0 },
    ]
    render(<TradeCalendar trades={trades} />)
    expect(screen.getByText('$100.00')).toBeInTheDocument()
  })

  it('shows no P&L line for a day with no trades', () => {
    render(<TradeCalendar trades={[]} />)
    const dayCells = screen.getAllByTestId('trade-calendar-day')
    for (const cell of dayCells) {
      expect(cell.querySelector('.trade-calendar-pnl')).toBeNull()
    }
  })

  it('navigates to the previous and next month', async () => {
    const now = new Date()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    render(<TradeCalendar trades={[]} />)

    await userEvent.click(screen.getByRole('button', { name: /previous month/i }))
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    expect(screen.getByText(`${monthNames[prevMonth.getMonth()]} ${prevMonth.getFullYear()}`)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(screen.getByText(`${monthNames[now.getMonth()]} ${now.getFullYear()}`)).toBeInTheDocument()
  })

  it('returns to the current month when Today is clicked', async () => {
    const now = new Date()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    render(<TradeCalendar trades={[]} />)

    await userEvent.click(screen.getByRole('button', { name: /previous month/i }))
    await userEvent.click(screen.getByRole('button', { name: /^today$/i }))
    expect(screen.getByText(`${monthNames[now.getMonth()]} ${now.getFullYear()}`)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run TradeCalendar.test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/TradeCalendar.jsx
import { useState } from 'react'
import './TradeCalendar.css'
import { buildMonthGrid } from '../lib/tradeCalendar'
import { formatCurrency } from '../lib/format'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function TradeCalendar({ trades }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const rows = buildMonthGrid(trades, year, month)

  function goToPrevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function goToNextMonth() {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  function goToToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  return (
    <div className="trade-calendar" data-testid="trade-calendar">
      <div className="trade-calendar-header">
        <button type="button" aria-label="Previous month" onClick={goToPrevMonth}>‹</button>
        <span className="trade-calendar-title">{MONTH_LABELS[month]} {year}</span>
        <button type="button" aria-label="Next month" onClick={goToNextMonth}>›</button>
        <button type="button" className="trade-calendar-today" onClick={goToToday}>Today</button>
      </div>

      <div className="trade-calendar-weekdays">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="trade-calendar-grid">
        {rows.map((row, i) => (
          <div key={i} className="trade-calendar-row">
            {row.map((cell, j) => (
              <div
                key={j}
                data-testid="trade-calendar-day"
                className={`trade-calendar-day${cell.inMonth ? '' : ' trade-calendar-day--outside'}${cell.pnl != null ? (cell.pnl >= 0 ? ' trade-calendar-day--positive' : ' trade-calendar-day--negative') : ''}`}
              >
                <span className="trade-calendar-daynum">{cell.dayNum}</span>
                {cell.pnl != null && (
                  <span className="trade-calendar-pnl">{formatCurrency(cell.pnl)}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

```css
/* src/components/TradeCalendar.css */
.trade-calendar {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  margin: 20px 32px;
}

.trade-calendar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.trade-calendar-header button {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
}

.trade-calendar-header button:hover {
  border-color: var(--green);
  color: var(--green);
}

.trade-calendar-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  flex: 1;
}

.trade-calendar-today {
  margin-left: auto;
}

.trade-calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-bottom: 6px;
}

.trade-calendar-weekdays span {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-dim);
  text-align: center;
}

.trade-calendar-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trade-calendar-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.trade-calendar-day {
  min-height: 64px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trade-calendar-day--outside {
  opacity: 0.35;
}

.trade-calendar-day--positive {
  border-color: var(--green);
  background: rgba(34, 197, 94, 0.08);
}

.trade-calendar-day--negative {
  border-color: var(--red);
  background: rgba(239, 68, 68, 0.08);
}

.trade-calendar-daynum {
  font-size: 12px;
  color: var(--text-dim);
}

.trade-calendar-pnl {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.trade-calendar-day--positive .trade-calendar-pnl {
  color: var(--green);
}

.trade-calendar-day--negative .trade-calendar-pnl {
  color: var(--red);
}

@media (max-width: 640px) {
  .trade-calendar {
    margin: 20px 16px;
  }
  .trade-calendar-day {
    min-height: 48px;
    padding: 4px 6px;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run TradeCalendar.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TradeCalendar.jsx src/components/TradeCalendar.css src/components/TradeCalendar.test.jsx
git commit -m "feat: add TradeCalendar month-grid P&L view"
```

---

### Task 10: `TradeStatsCharts` component

**Files:**
- Create: `src/components/TradeStatsCharts.jsx`
- Test: `src/components/TradeStatsCharts.test.jsx`

**Interfaces:**
- Consumes: `formatCurrency` from `src/lib/format.js`; reuses the existing `src/components/StatsCharts.css` stylesheet (generic `chart-card`/`stats-charts`/`chart-empty` classes, no new CSS file needed).
- Produces: `TradeStatsCharts({ stats })` where `stats` matches `computeTradeStats`'s return shape (Task 5). Consumed by `TradesPage.jsx` (Task 11).

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/TradeStatsCharts.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TradeStatsCharts from './TradeStatsCharts'

const emptyStats = {
  totalRealizedPnl: 0, winRate: 0, totalClosed: 0, avgWin: 0, avgLoss: 0,
  bestTrade: null, worstTrade: null, byType: [], bySymbol: [], equityCurve: [],
}

const filledStats = {
  ...emptyStats,
  totalClosed: 2,
  winRate: 50,
  byType: [{ type: 'Stock', count: 1, totalPnl: 200, winRate: 100, avgWin: 200, avgLoss: 0 }],
  bySymbol: [
    { symbol: 'AAPL', count: 1, totalPnl: 500 },
    { symbol: 'MSFT', count: 1, totalPnl: -100 },
  ],
  equityCurve: [
    { date: '2026-01-10', cumulative: 500 },
    { date: '2026-01-15', cumulative: 400 },
  ],
}

describe('TradeStatsCharts', () => {
  it('renders a container with headings for all four charts', () => {
    render(<TradeStatsCharts stats={filledStats} />)
    expect(screen.getByTestId('trade-stats-charts')).toBeInTheDocument()
    expect(screen.getByText('Equity Curve')).toBeInTheDocument()
    expect(screen.getByText('P&L by Type')).toBeInTheDocument()
    expect(screen.getByText('Win / Loss')).toBeInTheDocument()
    expect(screen.getByText('P&L by Symbol')).toBeInTheDocument()
  })

  it('shows empty-state text for charts with no data', () => {
    render(<TradeStatsCharts stats={emptyStats} />)
    expect(screen.getAllByText(/no closed trades yet/i).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run TradeStatsCharts.test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/TradeStatsCharts.jsx
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts'
import './StatsCharts.css'
import { formatCurrency } from '../lib/format'

const GREEN = '#22c55e'
const RED = '#ef4444'
const GRID = '#262626'
const AXIS_TEXT = '#888'
const TOOLTIP_STYLE = {
  background: '#141414', border: '1px solid #262626', borderRadius: 6, color: '#e5e5e5', fontSize: 12,
}

function EmptyState() {
  return <div className="chart-empty">No closed trades yet — this chart will fill in once you log a trade.</div>
}

function ChartCard({ title, isEmpty, children }) {
  return (
    <div className="chart-card">
      <h3 className="chart-card-title">{title}</h3>
      {isEmpty ? <EmptyState /> : children}
    </div>
  )
}

function pnlColor(value) {
  return value >= 0 ? GREEN : RED
}

export default function TradeStatsCharts({ stats }) {
  const { equityCurve, byType, bySymbol, totalClosed } = stats
  const wins = { name: 'Wins', value: Math.round((stats.winRate / 100) * totalClosed) }
  const losses = { name: 'Losses', value: totalClosed - wins.value }
  const winLossData = [wins, losses].filter((d) => d.value > 0)
  const topSymbols = [...bySymbol].sort((a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl)).slice(0, 10)

  return (
    <div data-testid="trade-stats-charts" className="stats-charts">
      <ChartCard title="Equity Curve" isEmpty={equityCurve.length === 0}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={equityCurve} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} tickFormatter={(v) => formatCurrency(v)} width={80} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCurrency(v)} />
            <Line type="monotone" dataKey="cumulative" name="Cumulative P&L" stroke="#3987e5" strokeWidth={2} dot={{ r: 4, fill: '#3987e5', stroke: '#141414', strokeWidth: 2 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="P&L by Type" isEmpty={byType.length === 0}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byType} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
            <XAxis dataKey="type" tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} tickFormatter={(v) => formatCurrency(v)} width={80} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCurrency(v)} />
            <Bar dataKey="totalPnl" name="Total P&L" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {byType.map((row) => (
                <Cell key={row.type} fill={pnlColor(row.totalPnl)} />
              ))}
              <LabelList dataKey="totalPnl" position="top" formatter={(v) => formatCurrency(v)} fill={AXIS_TEXT} fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Win / Loss" isEmpty={winLossData.length === 0}>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12, color: AXIS_TEXT }} />
            <Pie data={winLossData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2} label={({ name, value }) => `${name}: ${value}`}>
              {winLossData.map((entry) => (
                <Cell key={entry.name} fill={entry.name === 'Wins' ? GREEN : RED} stroke="#141414" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="P&L by Symbol" isEmpty={topSymbols.length === 0}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={topSymbols} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="0" horizontal={false} />
            <XAxis type="number" tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
            <YAxis type="category" dataKey="symbol" tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} width={60} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCurrency(v)} />
            <Bar dataKey="totalPnl" name="Total P&L" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {topSymbols.map((row) => (
                <Cell key={row.symbol} fill={pnlColor(row.totalPnl)} />
              ))}
              <LabelList dataKey="totalPnl" position="right" formatter={(v) => formatCurrency(v)} fill={AXIS_TEXT} fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run TradeStatsCharts.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TradeStatsCharts.jsx src/components/TradeStatsCharts.test.jsx
git commit -m "feat: add TradeStatsCharts for the Day Trading Stats tab"
```

---

### Task 11: `TradesPage` — tabs, calendar, list, stats

**Files:**
- Modify: `src/pages/TradesPage.jsx`
- Modify: `src/pages/TradesPage.css`
- Modify: `src/pages/TradesPage.test.jsx`

**Interfaces:**
- Consumes: `useTrades` (Task 6), `computeTradeStats` (Task 5), `isWithinDateRange` from `src/lib/dateRange.js` (existing), `formatCurrency` (existing), `TradeRow` (Task 8), `AddTradeModal` (Task 7), `TradeCalendar` (Task 9), `TradeStatsCharts` (Task 10). Reuses `src/pages/StatsPage.css` for stat-tile/date-range-filter classes (already generic, no changes needed there).

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/pages/TradesPage.test.jsx`:

```jsx
// src/pages/TradesPage.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TradesPage from './TradesPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useTrades } from '../hooks/useTrades'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useTrades')

function mockCommon({ trades = [] } = {}) {
  useAuth.mockReturnValue({ user: { id: 'u1' } })
  useAccounts.mockReturnValue({
    accounts: [{ id: 'a1', name: 'Main Account' }],
    activeAccount: { id: 'a1', name: 'Main Account' },
    activeAccountId: 'a1',
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
    loading: false,
  })
  useTrades.mockReturnValue({
    trades, loading: false, error: null, reload: vi.fn(),
    addTrade: vi.fn(), updateTrade: vi.fn(), deleteTrade: vi.fn(),
  })
}

const closedTrade = {
  id: 't1', symbol: 'AAPL', type: 'stock', direction: 'long',
  quantity: 10, entryPrice: 100, exitPrice: 110, exitDate: '2026-01-02',
  entryDate: '2026-01-02', fees: 0,
}

describe('TradesPage', () => {
  it('defaults to the Calendar tab, showing the calendar and the trade list', () => {
    mockCommon({ trades: [closedTrade] })
    render(<MemoryRouter><TradesPage /></MemoryRouter>)

    expect(screen.getByRole('button', { name: /^calendar$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('trade-calendar')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
  })

  it('shows the empty state on the Calendar tab when there are no trades', () => {
    mockCommon({ trades: [] })
    render(<MemoryRouter><TradesPage /></MemoryRouter>)
    expect(screen.getByText(/no trades yet/i)).toBeInTheDocument()
  })

  it('shows an error banner with a retry button when trades fail to load', async () => {
    mockCommon()
    const reload = vi.fn()
    useTrades.mockReturnValue({ trades: [], loading: false, error: { message: 'Network error' }, reload, addTrade: vi.fn(), updateTrade: vi.fn(), deleteTrade: vi.fn() })

    render(<MemoryRouter><TradesPage /></MemoryRouter>)
    expect(screen.getByText(/couldn.t load trades/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(reload).toHaveBeenCalled()
  })

  it('switches to the Stats tab and shows stat tiles and charts', async () => {
    mockCommon({ trades: [closedTrade] })
    render(<MemoryRouter><TradesPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^stats$/i }))

    expect(screen.getByText('Total Realized P&L')).toBeInTheDocument()
    expect(screen.getByText('Win Rate')).toBeInTheDocument()
    expect(screen.getByTestId('trade-stats-charts')).toBeInTheDocument()
    expect(screen.queryByTestId('trade-calendar')).not.toBeInTheDocument()
  })

  it('filters stats by the date range on the Stats tab', async () => {
    const olderTrade = { ...closedTrade, id: 't2', exitDate: '2025-01-01' }
    mockCommon({ trades: [closedTrade, olderTrade] })
    render(<MemoryRouter><TradesPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^stats$/i }))
    await userEvent.type(screen.getByLabelText(/from/i), '2026-01-01')

    expect(screen.getByText('Total Trades')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('opens Add Trade and calls addTrade on submit', async () => {
    const addTrade = vi.fn()
    mockCommon()
    useTrades.mockReturnValue({ trades: [], loading: false, error: null, reload: vi.fn(), addTrade, updateTrade: vi.fn(), deleteTrade: vi.fn() })

    render(<MemoryRouter><TradesPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /add trade/i }))
    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'AAPL')
    await userEvent.type(screen.getByLabelText(/quantity/i), '10')
    await userEvent.type(screen.getByLabelText(/entry price/i), '100')
    await userEvent.type(screen.getByLabelText(/entry date/i), '2026-01-01')
    await userEvent.type(screen.getByLabelText(/exit price/i), '110')
    await userEvent.type(screen.getByLabelText(/exit date/i), '2026-01-02')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(addTrade).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'AAPL' }), 'u1')
  })

  it('opens the edit modal pre-filled and calls updateTrade on save', async () => {
    const updateTrade = vi.fn()
    mockCommon({ trades: [closedTrade] })
    useTrades.mockReturnValue({ trades: [closedTrade], loading: false, error: null, reload: vi.fn(), addTrade: vi.fn(), updateTrade, deleteTrade: vi.fn() })

    render(<MemoryRouter><TradesPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByLabelText(/symbol/i)).toHaveValue('AAPL')

    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(updateTrade).toHaveBeenCalledWith('t1', expect.objectContaining({ symbol: 'AAPL' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run TradesPage.test`
Expected: FAIL — no tab bar, no calendar, no stats tab, `closeTrade` no longer exists on the mocked hook (old page still references it).

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/pages/TradesPage.jsx`:

```jsx
// src/pages/TradesPage.jsx
import { useState } from 'react'
import './TradesPage.css'
import '../pages/StatsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useTrades } from '../hooks/useTrades'
import { computeTradeStats } from '../lib/tradeStatsSummary'
import { isWithinDateRange } from '../lib/dateRange'
import { formatCurrency } from '../lib/format'
import Header from '../components/Header'
import TradeRow from '../components/TradeRow'
import AddTradeModal from '../components/AddTradeModal'
import TradeCalendar from '../components/TradeCalendar'
import TradeStatsCharts from '../components/TradeStatsCharts'

const TABS = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'stats', label: 'Stats' },
]

function StatTile({ label, value, tone }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-label">{label}</span>
      <span className={`stat-tile-value mono ${tone ? `stat-tile-value--${tone}` : ''}`}>{value}</span>
    </div>
  )
}

export default function TradesPage() {
  const { user, signOut } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount, deleteAccount, renameAccount } = useAccounts(user?.id)
  const { trades, error, reload, addTrade, updateTrade, deleteTrade } = useTrades(activeAccountId)
  const [tab, setTab] = useState('calendar')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const filteredTrades = trades.filter((t) => isWithinDateRange(t.exitDate, startDate, endDate))
  const stats = computeTradeStats(filteredTrades)

  return (
    <div data-testid="trades-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        deleteAccount={deleteAccount}
        renameAccount={renameAccount}
        onSignOut={signOut}
        onAddTrade={() => setAddOpen(true)}
      />

      <div className="trades-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="error-banner">
          <span>Couldn't load trades.</span>
          <button type="button" onClick={reload}>Retry</button>
        </div>
      )}

      {tab === 'calendar' && (
        <>
          <TradeCalendar trades={trades} />

          {trades.length === 0 ? (
            <p className="empty-state">No trades yet — add one to get started</p>
          ) : (
            <ul className="trade-list">
              {trades.map((trade) => (
                <TradeRow key={trade.id} trade={trade} onEdit={setEditing} onDelete={deleteTrade} />
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'stats' && (
        <div className="stats-numbers">
          <div className="stats-toolbar">
            <div className="date-range-filter">
              <label htmlFor="tradesStartDate">From</label>
              <input id="tradesStartDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <label htmlFor="tradesEndDate">To</label>
              <input id="tradesEndDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              {(startDate || endDate) && (
                <button type="button" onClick={() => { setStartDate(''); setEndDate('') }}>Clear</button>
              )}
            </div>
          </div>

          <section className="stats-section">
            <h2 className="stats-section-title">Overview</h2>
            <div className="stat-tile-grid">
              <StatTile label="Total Realized P&L" value={formatCurrency(stats.totalRealizedPnl)} tone={stats.totalRealizedPnl >= 0 ? 'positive' : 'negative'} />
              <StatTile label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
              <StatTile label="Total Trades" value={stats.totalClosed} />
              <StatTile label="Avg Win" value={formatCurrency(stats.avgWin)} tone="positive" />
              <StatTile label="Avg Loss" value={formatCurrency(stats.avgLoss)} tone="negative" />
              <StatTile label="Best Trade" value={stats.bestTrade ? stats.bestTrade.symbol : '—'} tone="positive" />
              <StatTile label="Worst Trade" value={stats.worstTrade ? stats.worstTrade.symbol : '—'} tone="negative" />
            </div>
          </section>

          <TradeStatsCharts stats={stats} />
        </div>
      )}

      {addOpen && (
        <AddTradeModal
          onClose={() => setAddOpen(false)}
          onSubmit={async (trade) => {
            await addTrade(trade, user.id)
            setAddOpen(false)
          }}
        />
      )}

      {editing && (
        <AddTradeModal
          initialValues={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (fields) => {
            await updateTrade(editing.id, fields)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
```

Add to `src/pages/TradesPage.css` (append; keep the existing `.empty-state`/`.error-banner` rules already in the file):

```css
.trades-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 16px 32px 0;
}

.trades-tabs button {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.trades-tabs button[aria-pressed="true"] {
  border-color: var(--green);
  color: var(--green);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run TradesPage.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/TradesPage.jsx src/pages/TradesPage.css src/pages/TradesPage.test.jsx
git commit -m "feat: add Calendar/Stats tabs to the Day Trading page"
```

---

### Task 12: Full suite and manual smoke test

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all pre-existing tests plus every new/updated test from Tasks 1–11.

- [ ] **Step 2: Restart the dev server**

```bash
taskkill //F //IM node.exe //T
(npm run dev > /tmp/day_trading_smoke.log 2>&1 &)
sleep 8
cat /tmp/day_trading_smoke.log
```

Expected: log shows "Loaded function yahoo-proxy" and the local dev server ready banner, no errors.

- [ ] **Step 3: Confirm the route responds**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8888/daytrading
```

Expected: `200`

- [ ] **Step 4: Report to the user**

Tell the user the Day Trading tab now has Calendar (default, with the monthly P&L calendar and full trade list) and Stats sub-tabs, Add Trade supports Stock/Option/Futures with entry+exit collected together, and ask them to confirm they've run the `alter table trades add column point_value numeric;` migration before trying to log a futures trade (needed for the P&L calculation to work). Ask them to try it in a browser to confirm the calendar and charts render correctly — that can't be fully verified by automated tests.
