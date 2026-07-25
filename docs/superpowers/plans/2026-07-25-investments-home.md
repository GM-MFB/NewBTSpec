# Investments Home + Trades Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Investments (Stock/Option positions) the app's home screen, move the existing Trades journal to `/trades`, and support 6 option strategies (including 2-leg credit spreads) per `docs/superpowers/specs/2026-07-25-investments-home-design.md`.

**Architecture:** Mirrors the existing Trades architecture exactly: a mapper module, a `useInvestments` hook, and three presentation components (row, add modal, detail modal), composed in `InvestmentsPage`. A new `optionStrategies.js` module is the single source of truth for the 6 strategies and their underlying `option_type`/`option_direction` values.

**Tech Stack:** Same as Phase 1 — Vite, React, react-router-dom, @supabase/supabase-js, Vitest, @testing-library/react.

## Global Constraints

- **Prerequisite (not part of this plan's tasks):** the user must have already run `docs/superpowers/specs/2026-07-25-investments-strategy-migration.sql` in the Supabase SQL Editor, adding nullable `strategy` and `strike_2` columns to `investments`. Do not attempt to run this migration from application code — the app only holds the anon key.
- Do not change any existing table/column names — `strategy` and `strike_2` are additive only.
- Row↔JS convention: DB is snake_case, JS is camelCase, blank strings ↔ `null` at the mapper boundary (same as `tradeMappers.js`).
- Asset type in the Add Investment form is restricted to `'Stock'` / `'Option'` only (the column itself still allows other values per the schema, but this app's form doesn't offer them).
- Dark theme, monospace numerals, minimal chrome — reuse the existing `src/styles/modal.css` for both new modals; no new UI framework.
- No P&L calculation. No schema-level enforcement of the 6 strategies — validation lives in the app form only.

---

## Task 1: Option strategy definitions + investment row mappers (TDD)

**Files:**
- Create: `src/lib/optionStrategies.js`
- Create: `src/lib/investmentMappers.js`
- Test: `src/lib/optionStrategies.test.js`
- Test: `src/lib/investmentMappers.test.js`

**Interfaces:**
- Produces: `STRATEGIES` (array of `{ value, label, optionType, optionDirection, isSpread }`), `strategyByValue(value)`. Produces `fromRow(row) -> investment`, `toRow(investment) -> row`. Consumed by `useInvestments` (Task 2), `AddInvestmentModal` (Task 4), `InvestmentRow` (Task 3).

- [ ] **Step 1: Write the failing tests**

`src/lib/optionStrategies.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { STRATEGIES, strategyByValue } from './optionStrategies'

describe('STRATEGIES', () => {
  it('defines exactly the 6 supported strategies', () => {
    expect(STRATEGIES.map((s) => s.value)).toEqual([
      'call', 'put', 'cash_secured_put', 'covered_call',
      'put_credit_spread', 'call_credit_spread',
    ])
  })

  it('marks only the two credit spreads as spreads', () => {
    const spreads = STRATEGIES.filter((s) => s.isSpread).map((s) => s.value)
    expect(spreads).toEqual(['put_credit_spread', 'call_credit_spread'])
  })
})

describe('strategyByValue', () => {
  it('returns the matching strategy definition', () => {
    expect(strategyByValue('covered_call')).toEqual({
      value: 'covered_call', label: 'Covered Call',
      optionType: 'call', optionDirection: 'short', isSpread: false,
    })
  })

  it('returns undefined for an unknown value', () => {
    expect(strategyByValue('nonsense')).toBeUndefined()
  })
})
```

`src/lib/investmentMappers.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { fromRow, toRow } from './investmentMappers'

describe('fromRow', () => {
  it('converts a stock row to camelCase, nulls to blank', () => {
    const row = {
      id: '1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      symbol: 'AAPL', name: 'Apple', asset_type: 'Stock', sector: 'Tech',
      shares: 10, avg_cost: 150, current_price: null, buy_date: '2026-01-01',
      status: 'open', sell_price: null, sell_date: null, stop_loss: 140,
      target_price: 200, chart_link: null, notes: null,
      option_type: null, option_direction: null, strike: null, expiry: null,
      strategy: null, strike_2: null,
    }
    expect(fromRow(row)).toEqual({
      id: '1', accountId: 'a1', userId: 'u1', createdAt: '2026-01-01',
      symbol: 'AAPL', name: 'Apple', assetType: 'Stock', sector: 'Tech',
      shares: 10, avgCost: 150, currentPrice: '', buyDate: '2026-01-01',
      status: 'open', sellPrice: '', sellDate: '', stopLoss: 140,
      targetPrice: 200, chartLink: '', notes: '',
      optionType: '', optionDirection: '', strike: '', expiry: '',
      strategy: '', strike2: '',
    })
  })
})

describe('toRow', () => {
  it('derives option_type/option_direction from a non-spread strategy', () => {
    const investment = {
      symbol: 'TSLA', name: '', assetType: 'Option', sector: '',
      shares: '', avgCost: '', buyDate: '2026-01-01', stopLoss: '',
      targetPrice: '', chartLink: '', notes: '', status: 'open',
      strategy: 'cash_secured_put', strike: '200', expiry: '2026-02-01', strike2: '',
    }
    const row = toRow(investment)
    expect(row.option_type).toBe('put')
    expect(row.option_direction).toBe('short')
    expect(row.strategy).toBe('cash_secured_put')
    expect(row.strike).toBe('200')
    expect(row.strike_2).toBeNull()
  })

  it('includes strike_2 for a credit spread strategy', () => {
    const investment = {
      symbol: 'SPY', name: '', assetType: 'Option', sector: '',
      shares: '', avgCost: '', buyDate: '2026-01-01', stopLoss: '',
      targetPrice: '', chartLink: '', notes: '', status: 'open',
      strategy: 'put_credit_spread', strike: '400', expiry: '2026-02-01', strike2: '395',
    }
    const row = toRow(investment)
    expect(row.option_type).toBe('put')
    expect(row.option_direction).toBe('short')
    expect(row.strike_2).toBe('395')
  })

  it('leaves option fields null for a stock investment', () => {
    const investment = {
      symbol: 'AAPL', name: 'Apple', assetType: 'Stock', sector: 'Tech',
      shares: '10', avgCost: '150', buyDate: '2026-01-01', stopLoss: '',
      targetPrice: '', chartLink: '', notes: '', status: 'open',
      strategy: '', strike: '', expiry: '', strike2: '',
    }
    const row = toRow(investment)
    expect(row.option_type).toBeNull()
    expect(row.option_direction).toBeNull()
    expect(row.strategy).toBeNull()
    expect(row.strike_2).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- optionStrategies investmentMappers`
Expected: FAIL — neither module exists yet.

- [ ] **Step 3: Implement `optionStrategies.js`**

`src/lib/optionStrategies.js`:
```js
export const STRATEGIES = [
  { value: 'call', label: 'Call', optionType: 'call', optionDirection: 'long', isSpread: false },
  { value: 'put', label: 'Put', optionType: 'put', optionDirection: 'long', isSpread: false },
  { value: 'cash_secured_put', label: 'Cash Secured Put', optionType: 'put', optionDirection: 'short', isSpread: false },
  { value: 'covered_call', label: 'Covered Call', optionType: 'call', optionDirection: 'short', isSpread: false },
  { value: 'put_credit_spread', label: 'Put Credit Spread', optionType: 'put', optionDirection: 'short', isSpread: true },
  { value: 'call_credit_spread', label: 'Call Credit Spread', optionType: 'call', optionDirection: 'short', isSpread: true },
]

export function strategyByValue(value) {
  return STRATEGIES.find((s) => s.value === value)
}
```

- [ ] **Step 4: Implement `investmentMappers.js`**

`src/lib/investmentMappers.js`:
```js
import { strategyByValue } from './optionStrategies'

export function fromRow(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    userId: row.user_id,
    createdAt: row.created_at,
    symbol: row.symbol ?? '',
    name: row.name ?? '',
    assetType: row.asset_type ?? '',
    sector: row.sector ?? '',
    shares: row.shares ?? '',
    avgCost: row.avg_cost ?? '',
    currentPrice: row.current_price ?? '',
    buyDate: row.buy_date ?? '',
    status: row.status ?? '',
    sellPrice: row.sell_price ?? '',
    sellDate: row.sell_date ?? '',
    stopLoss: row.stop_loss ?? '',
    targetPrice: row.target_price ?? '',
    chartLink: row.chart_link ?? '',
    notes: row.notes ?? '',
    optionType: row.option_type ?? '',
    optionDirection: row.option_direction ?? '',
    strike: row.strike ?? '',
    expiry: row.expiry ?? '',
    strategy: row.strategy ?? '',
    strike2: row.strike_2 ?? '',
  }
}

function blankToNull(value) {
  return value === '' || value === undefined ? null : value
}

export function toRow(investment) {
  const strategyDef = strategyByValue(investment.strategy)

  return {
    symbol: blankToNull(investment.symbol),
    name: blankToNull(investment.name),
    asset_type: blankToNull(investment.assetType),
    sector: blankToNull(investment.sector),
    shares: blankToNull(investment.shares),
    avg_cost: blankToNull(investment.avgCost),
    current_price: blankToNull(investment.currentPrice),
    buy_date: blankToNull(investment.buyDate),
    status: blankToNull(investment.status),
    sell_price: blankToNull(investment.sellPrice),
    sell_date: blankToNull(investment.sellDate),
    stop_loss: blankToNull(investment.stopLoss),
    target_price: blankToNull(investment.targetPrice),
    chart_link: blankToNull(investment.chartLink),
    notes: blankToNull(investment.notes),
    option_type: strategyDef ? strategyDef.optionType : blankToNull(investment.optionType),
    option_direction: strategyDef ? strategyDef.optionDirection : blankToNull(investment.optionDirection),
    strike: blankToNull(investment.strike),
    expiry: blankToNull(investment.expiry),
    strategy: blankToNull(investment.strategy),
    strike_2: strategyDef?.isSpread ? blankToNull(investment.strike2) : null,
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- optionStrategies investmentMappers`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/optionStrategies.js src/lib/optionStrategies.test.js src/lib/investmentMappers.js src/lib/investmentMappers.test.js
git commit -m "feat: add option strategy definitions and investment mappers"
```

---

## Task 2: `useInvestments` hook (TDD)

**Files:**
- Create: `src/hooks/useInvestments.js`
- Test: `src/hooks/useInvestments.test.js`

**Interfaces:**
- Consumes: `supabase` (`src/utils/supabase.js`), `fromRow`/`toRow` from `src/lib/investmentMappers.js` (Task 1), an `accountId` string.
- Produces: `useInvestments(accountId) -> { investments, loading, error, reload(), addInvestment(investment, userId), updateInvestment(id, patch), closeInvestment(id, { sellPrice, sellDate }), deleteInvestment(id) }`. `investments` contains only `status: 'open'` rows. Consumed by `InvestmentsPage` (Task 6), `AddInvestmentModal` (Task 4), `InvestmentDetailModal` (Task 5).

- [ ] **Step 1: Write the failing tests**

`src/hooks/useInvestments.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useInvestments } from './useInvestments'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockSelectChain(data) {
  const order = vi.fn().mockResolvedValue({ data, error: null })
  const eq2 = vi.fn(() => ({ order }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  return { select: vi.fn(() => ({ eq: eq1 })) }
}

describe('useInvestments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads only open investments for the account, mapped to camelCase', async () => {
    const rows = [{
      id: 'i1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      symbol: 'AAPL', name: 'Apple', asset_type: 'Stock', sector: 'Tech',
      shares: 10, avg_cost: 150, current_price: null, buy_date: '2026-01-01',
      status: 'open', sell_price: null, sell_date: null, stop_loss: null,
      target_price: null, chart_link: null, notes: null,
      option_type: null, option_direction: null, strike: null, expiry: null,
      strategy: null, strike_2: null,
    }]
    supabase.from.mockReturnValue(mockSelectChain(rows))

    const { result } = renderHook(() => useInvestments('a1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.investments).toHaveLength(1)
    expect(result.current.investments[0].symbol).toBe('AAPL')
    expect(supabase.from).toHaveBeenCalledWith('investments')
  })

  it('addInvestment inserts a row with status open and refreshes the list', async () => {
    supabase.from.mockReturnValue(mockSelectChain([]))
    const { result } = renderHook(() => useInvestments('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const insertedRow = {
      id: 'i2', account_id: 'a1', user_id: 'u1', created_at: '2026-01-02',
      symbol: 'TSLA', name: '', asset_type: 'Stock', sector: '',
      shares: 5, avg_cost: 200, current_price: null, buy_date: '2026-01-02',
      status: 'open', sell_price: null, sell_date: null, stop_loss: null,
      target_price: null, chart_link: null, notes: null,
      option_type: null, option_direction: null, strike: null, expiry: null,
      strategy: null, strike_2: null,
    }
    const single = vi.fn().mockResolvedValue({ data: insertedRow, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    supabase.from.mockReturnValue({ ...mockSelectChain([insertedRow]), insert })

    await act(async () => {
      await result.current.addInvestment({
        symbol: 'TSLA', assetType: 'Stock', shares: 5, avgCost: 200,
        buyDate: '2026-01-02', status: 'open',
      }, 'u1')
    })

    expect(insert).toHaveBeenCalled()
    const insertArg = insert.mock.calls[0][0]
    expect(insertArg.account_id).toBe('a1')
    expect(insertArg.user_id).toBe('u1')
    expect(insertArg.symbol).toBe('TSLA')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useInvestments`
Expected: FAIL — `useInvestments.js` does not exist.

- [ ] **Step 3: Implement the hook**

`src/hooks/useInvestments.js`:
```js
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { fromRow, toRow } from '../lib/investmentMappers'

export function useInvestments(accountId) {
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
      .eq('status', 'open')
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

  async function addInvestment(investment, userId) {
    const { data, error: err } = await supabase
      .from('investments')
      .insert({ account_id: accountId, user_id: userId, ...toRow({ ...investment, status: 'open' }) })
      .select()
      .single()
    if (err) throw err
    await load()
    return fromRow(data)
  }

  async function updateInvestment(id, patch) {
    const { error: err } = await supabase.from('investments').update(toRow(patch)).eq('id', id)
    if (err) throw err
    await load()
  }

  async function closeInvestment(id, { sellPrice, sellDate }) {
    const { error: err } = await supabase
      .from('investments')
      .update(toRow({ status: 'closed', sellPrice, sellDate }))
      .eq('id', id)
    if (err) throw err
    await load()
  }

  async function deleteInvestment(id) {
    const { error: err } = await supabase.from('investments').delete().eq('id', id)
    if (err) throw err
    await load()
  }

  return { investments, loading, error, reload: load, addInvestment, updateInvestment, closeInvestment, deleteInvestment }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useInvestments`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useInvestments.js src/hooks/useInvestments.test.js
git commit -m "feat: add useInvestments hook"
```

---

## Task 3: `InvestmentRow` component (TDD)

**Files:**
- Create: `src/components/InvestmentRow.jsx`
- Create: `src/components/InvestmentRow.css`
- Test: `src/components/InvestmentRow.test.jsx`

**Interfaces:**
- Consumes: `strategyByValue` from `src/lib/optionStrategies.js` (Task 1); a single `investment` prop (shape from `fromRow`, Task 1); an `onClick` prop.
- Produces: `<InvestmentRow investment={investment} onClick={fn} />`. Consumed by `InvestmentsPage` (Task 6).

- [ ] **Step 1: Write the failing tests**

`src/components/InvestmentRow.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvestmentRow from './InvestmentRow'

describe('InvestmentRow', () => {
  it('renders symbol, Stock badge, shares, and avg cost for a stock', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClick={vi.fn()} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Stock')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
  })

  it('renders the strategy label and strike/expiry for an option', () => {
    const investment = { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: '', avgCost: '', strategy: 'covered_call', strike: 450, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClick={vi.fn()} />)
    expect(screen.getByText('SPY')).toBeInTheDocument()
    expect(screen.getByText('Covered Call')).toBeInTheDocument()
    expect(screen.getByText('450')).toBeInTheDocument()
  })

  it('calls onClick with the investment id when clicked', async () => {
    const onClick = vi.fn()
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClick={onClick} />)
    await userEvent.click(screen.getByTestId('investment-row'))
    expect(onClick).toHaveBeenCalledWith('i1')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- InvestmentRow`
Expected: FAIL — `InvestmentRow.jsx` does not exist.

- [ ] **Step 3: Implement the component**

`src/components/InvestmentRow.jsx`:
```jsx
import './InvestmentRow.css'
import { strategyByValue } from '../lib/optionStrategies'

export default function InvestmentRow({ investment, onClick }) {
  const isOption = investment.assetType === 'Option'
  const badge = isOption ? (strategyByValue(investment.strategy)?.label ?? 'Option') : investment.assetType

  return (
    <li className="investment-row" data-testid="investment-row" onClick={() => onClick(investment.id)}>
      <span className="mono investment-symbol">{investment.symbol}</span>
      <span className="investment-badge">{badge}</span>
      {isOption ? (
        <>
          <span className="mono">{investment.strike}</span>
          <span className="mono">{investment.expiry}</span>
        </>
      ) : (
        <>
          <span className="mono">{investment.shares}</span>
          <span className="mono">{investment.avgCost}</span>
        </>
      )}
    </li>
  )
}
```

`src/components/InvestmentRow.css`:
```css
.investment-list {
  list-style: none;
  margin: 0;
  padding: 12px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.investment-row {
  display: grid;
  grid-template-columns: 90px 160px 1fr 1fr;
  align-items: center;
  gap: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 18px;
  cursor: pointer;
  transition: border-color 0.12s ease, transform 0.12s ease;
}

.investment-row:hover {
  border-color: var(--green);
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .investment-row {
    grid-template-columns: 1fr 1fr;
    row-gap: 8px;
  }
}

.investment-symbol {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.investment-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-dim);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 8px;
  text-align: center;
  width: fit-content;
}

.investment-row .mono:not(.investment-symbol) {
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--text);
  font-size: 14px;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- InvestmentRow`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/InvestmentRow.jsx src/components/InvestmentRow.css src/components/InvestmentRow.test.jsx
git commit -m "feat: add InvestmentRow component"
```

---

## Task 4: `AddInvestmentModal` component (TDD)

**Files:**
- Create: `src/components/AddInvestmentModal.jsx`
- Test: `src/components/AddInvestmentModal.test.jsx`

**Interfaces:**
- Consumes: `STRATEGIES` from `src/lib/optionStrategies.js` (Task 1); reuses `src/styles/modal.css` (existing).
- Produces: `<AddInvestmentModal onClose={fn} onSubmit={fn(investmentObject)} />`. `investmentObject` matches the camelCase shape `toRow` (Task 1) expects. Consumed by `InvestmentsPage` (Task 6).

- [ ] **Step 1: Write the failing tests**

`src/components/AddInvestmentModal.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddInvestmentModal from './AddInvestmentModal'

describe('AddInvestmentModal', () => {
  it('shows stock-only fields only when Stock is selected', async () => {
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    expect(screen.getByLabelText(/shares/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/avg cost/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/strategy/i)).not.toBeInTheDocument()
  })

  it('shows the strategy dropdown when Option is selected, no strike_2 for non-spreads', async () => {
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^option$/i }))
    expect(screen.getByLabelText(/strategy/i)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText(/strategy/i), 'covered_call')
    expect(screen.getByLabelText(/^strike$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/long leg strike/i)).not.toBeInTheDocument()
  })

  it('shows the long leg strike field only for credit spread strategies', async () => {
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^option$/i }))
    await userEvent.selectOptions(screen.getByLabelText(/strategy/i), 'put_credit_spread')
    expect(screen.getByLabelText(/long leg strike/i)).toBeInTheDocument()
  })

  it('submits a stock investment with the expected fields', async () => {
    const onSubmit = vi.fn()
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'AAPL')
    await userEvent.type(screen.getByLabelText(/shares/i), '10')
    await userEvent.type(screen.getByLabelText(/avg cost/i), '150')
    await userEvent.type(screen.getByLabelText(/buy date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      assetType: 'Stock', symbol: 'AAPL', shares: '10', avgCost: '150', buyDate: '2026-01-01',
    }))
  })

  it('submits a put credit spread with both strikes', async () => {
    const onSubmit = vi.fn()
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^option$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'SPY')
    await userEvent.selectOptions(screen.getByLabelText(/strategy/i), 'put_credit_spread')
    await userEvent.type(screen.getByLabelText(/^strike$/i), '400')
    await userEvent.type(screen.getByLabelText(/long leg strike/i), '395')
    await userEvent.type(screen.getByLabelText(/expiry/i), '2026-02-01')
    await userEvent.type(screen.getByLabelText(/buy date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      assetType: 'Option', symbol: 'SPY', strategy: 'put_credit_spread',
      strike: '400', strike2: '395', expiry: '2026-02-01',
    }))
  })

  it('shows an inline error and keeps entered values when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('insert failed'))
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'AAPL')
    await userEvent.type(screen.getByLabelText(/shares/i), '10')
    await userEvent.type(screen.getByLabelText(/avg cost/i), '150')
    await userEvent.type(screen.getByLabelText(/buy date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText(/insert failed/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/symbol/i)).toHaveValue('AAPL')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- AddInvestmentModal`
Expected: FAIL — `AddInvestmentModal.jsx` does not exist.

- [ ] **Step 3: Implement the component**

`src/components/AddInvestmentModal.jsx`:
```jsx
import { useState } from 'react'
import '../styles/modal.css'
import { STRATEGIES, strategyByValue } from '../lib/optionStrategies'

const initial = {
  assetType: '', symbol: '', name: '', sector: '', buyDate: '', notes: '', chartLink: '',
  shares: '', avgCost: '', stopLoss: '', targetPrice: '',
  strategy: '', strike: '', expiry: '', strike2: '',
}

export default function AddInvestmentModal({ onClose, onSubmit }) {
  const [fields, setFields] = useState(initial)
  const [error, setError] = useState(null)

  function set(key, value) {
    setFields((f) => ({ ...f, [key]: value }))
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

  const isSpread = strategyByValue(fields.strategy)?.isSpread ?? false

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Add Investment">
      <div className="modal">
        <div className="type-toggle">
          <button type="button" aria-pressed={fields.assetType === 'Stock'} onClick={() => set('assetType', 'Stock')}>Stock</button>
          <button type="button" aria-pressed={fields.assetType === 'Option'} onClick={() => set('assetType', 'Option')}>Option</button>
        </div>

        {fields.assetType && (
          <form onSubmit={handleSubmit}>
            <label htmlFor="symbol">Symbol</label>
            <input id="symbol" value={fields.symbol} onChange={(e) => set('symbol', e.target.value)} required />

            <label htmlFor="name">Name</label>
            <input id="name" value={fields.name} onChange={(e) => set('name', e.target.value)} />

            <label htmlFor="sector">Sector</label>
            <input id="sector" value={fields.sector} onChange={(e) => set('sector', e.target.value)} />

            {fields.assetType === 'Stock' && (
              <>
                <label htmlFor="shares">Shares</label>
                <input id="shares" type="number" value={fields.shares} onChange={(e) => set('shares', e.target.value)} required />

                <label htmlFor="avgCost">Avg Cost</label>
                <input id="avgCost" type="number" step="0.01" value={fields.avgCost} onChange={(e) => set('avgCost', e.target.value)} required />

                <label htmlFor="stopLoss">Stop Loss</label>
                <input id="stopLoss" type="number" step="0.01" value={fields.stopLoss} onChange={(e) => set('stopLoss', e.target.value)} />

                <label htmlFor="targetPrice">Target Price</label>
                <input id="targetPrice" type="number" step="0.01" value={fields.targetPrice} onChange={(e) => set('targetPrice', e.target.value)} />
              </>
            )}

            {fields.assetType === 'Option' && (
              <>
                <label htmlFor="strategy">Strategy</label>
                <select id="strategy" value={fields.strategy} onChange={(e) => set('strategy', e.target.value)} required>
                  <option value="">Select…</option>
                  {STRATEGIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                <label htmlFor="strike">Strike</label>
                <input id="strike" type="number" value={fields.strike} onChange={(e) => set('strike', e.target.value)} required />

                {isSpread && (
                  <>
                    <label htmlFor="strike2">Long Leg Strike</label>
                    <input id="strike2" type="number" value={fields.strike2} onChange={(e) => set('strike2', e.target.value)} required />
                  </>
                )}

                <label htmlFor="expiry">Expiry</label>
                <input id="expiry" type="date" value={fields.expiry} onChange={(e) => set('expiry', e.target.value)} required />
              </>
            )}

            <label htmlFor="buyDate">Buy Date</label>
            <input id="buyDate" type="date" value={fields.buyDate} onChange={(e) => set('buyDate', e.target.value)} required />

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

        {!fields.assetType && (
          <button type="button" onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- AddInvestmentModal`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AddInvestmentModal.jsx src/components/AddInvestmentModal.test.jsx
git commit -m "feat: implement Add Investment modal with strategy support"
```

---

## Task 5: `InvestmentDetailModal` component (TDD)

**Files:**
- Create: `src/components/InvestmentDetailModal.jsx`
- Test: `src/components/InvestmentDetailModal.test.jsx`

**Interfaces:**
- Consumes: an `investment` prop (shape from `fromRow`, Task 1); reuses `src/styles/modal.css`.
- Produces: `<InvestmentDetailModal investment={investment} onClose={fn} onUpdate={fn(patch)} onCloseInvestment={fn({sellPrice, sellDate})} onDelete={fn} />`. Consumed by `InvestmentsPage` (Task 6).

- [ ] **Step 1: Write the failing tests**

`src/components/InvestmentDetailModal.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvestmentDetailModal from './InvestmentDetailModal'

const investment = {
  id: 'i1', assetType: 'Stock', symbol: 'AAPL', name: 'Apple', sector: 'Tech',
  shares: 10, avgCost: 150, buyDate: '2026-01-01', sellPrice: '', sellDate: '',
  stopLoss: '', targetPrice: '', chartLink: '', notes: '', status: 'open',
  strategy: '', strike: '', expiry: '', strike2: '',
}

describe('InvestmentDetailModal', () => {
  it('shows the investment fields', () => {
    render(<InvestmentDetailModal investment={investment} onClose={vi.fn()} onUpdate={vi.fn()} onCloseInvestment={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByDisplayValue('AAPL')).toBeInTheDocument()
  })

  it('calls onCloseInvestment with sell price and date when closing', async () => {
    const onCloseInvestment = vi.fn()
    render(<InvestmentDetailModal investment={investment} onClose={vi.fn()} onUpdate={vi.fn()} onCloseInvestment={onCloseInvestment} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /close position/i }))
    await userEvent.type(screen.getByLabelText(/sell price/i), '180')
    await userEvent.type(screen.getByLabelText(/sell date/i), '2026-02-01')
    await userEvent.click(screen.getByRole('button', { name: /confirm close/i }))

    expect(onCloseInvestment).toHaveBeenCalledWith({ sellPrice: '180', sellDate: '2026-02-01' })
  })

  it('calls onUpdate with edited fields when saving', async () => {
    const onUpdate = vi.fn()
    render(<InvestmentDetailModal investment={investment} onClose={vi.fn()} onUpdate={onUpdate} onCloseInvestment={vi.fn()} onDelete={vi.fn()} />)

    const notes = screen.getByLabelText(/notes/i)
    await userEvent.type(notes, 'long term hold')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ notes: 'long term hold' }))
  })

  it('calls onDelete when delete is clicked', async () => {
    const onDelete = vi.fn()
    render(<InvestmentDetailModal investment={investment} onClose={vi.fn()} onUpdate={vi.fn()} onCloseInvestment={vi.fn()} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalled()
  })

  it('shows an inline error and keeps the form open when onUpdate rejects', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('update failed'))
    render(<InvestmentDetailModal investment={investment} onClose={vi.fn()} onUpdate={onUpdate} onCloseInvestment={vi.fn()} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/update failed/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('AAPL')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- InvestmentDetailModal`
Expected: FAIL — `InvestmentDetailModal.jsx` does not exist.

- [ ] **Step 3: Implement the component**

`src/components/InvestmentDetailModal.jsx`:
```jsx
import { useState } from 'react'
import '../styles/modal.css'

export default function InvestmentDetailModal({ investment, onClose, onUpdate, onCloseInvestment, onDelete }) {
  const [fields, setFields] = useState(investment)
  const [closing, setClosing] = useState(false)
  const [sellPrice, setSellPrice] = useState('')
  const [sellDate, setSellDate] = useState('')
  const [error, setError] = useState(null)

  function set(key, value) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    try {
      await onUpdate(fields)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleConfirmClose(e) {
    e.preventDefault()
    setError(null)
    try {
      await onCloseInvestment({ sellPrice, sellDate })
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete() {
    setError(null)
    try {
      await onDelete()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Investment Detail">
      <div className="modal">
        <form onSubmit={handleSave}>
          <label htmlFor="detail-symbol">Symbol</label>
          <input id="detail-symbol" value={fields.symbol} onChange={(e) => set('symbol', e.target.value)} />

          {fields.assetType === 'Option' ? (
            <>
              <label htmlFor="detail-strike">Strike</label>
              <input id="detail-strike" value={fields.strike} onChange={(e) => set('strike', e.target.value)} />

              <label htmlFor="detail-expiry">Expiry</label>
              <input id="detail-expiry" value={fields.expiry} onChange={(e) => set('expiry', e.target.value)} />
            </>
          ) : (
            <>
              <label htmlFor="detail-shares">Shares</label>
              <input id="detail-shares" value={fields.shares} onChange={(e) => set('shares', e.target.value)} />

              <label htmlFor="detail-avgCost">Avg Cost</label>
              <input id="detail-avgCost" value={fields.avgCost} onChange={(e) => set('avgCost', e.target.value)} />
            </>
          )}

          <label htmlFor="detail-notes">Notes</label>
          <textarea id="detail-notes" value={fields.notes} onChange={(e) => set('notes', e.target.value)} />

          {error && <p role="alert">{error}</p>}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Close</button>
            <button type="button" onClick={handleDelete}>Delete</button>
            <button type="submit">Save</button>
          </div>
        </form>

        {!closing ? (
          <button type="button" onClick={() => setClosing(true)}>Close Position</button>
        ) : (
          <form onSubmit={handleConfirmClose}>
            <label htmlFor="sellPrice">Sell Price</label>
            <input id="sellPrice" type="number" step="0.01" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} required />

            <label htmlFor="sellDate">Sell Date</label>
            <input id="sellDate" type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} required />

            <button type="submit">Confirm Close</button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- InvestmentDetailModal`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/InvestmentDetailModal.jsx src/components/InvestmentDetailModal.test.jsx
git commit -m "feat: implement Investment Detail modal with close/edit/delete"
```

---

## Task 6: `InvestmentsPage` (new Home)

**Files:**
- Create: `src/pages/InvestmentsPage.jsx`
- Create: `src/pages/InvestmentsPage.css`
- Test: `src/pages/InvestmentsPage.test.jsx`

**Interfaces:**
- Consumes: `useAuth`, `useAccounts`, `useInvestments` (Task 2), `Header` (existing, gains a 4th nav link in Task 8), `InvestmentRow` (Task 3), `AddInvestmentModal` (Task 4), `InvestmentDetailModal` (Task 5).
- Produces: the screen rendered at `/` (wired in Task 9). `data-testid="investments-page"`.

- [ ] **Step 1: Write the failing tests**

`src/pages/InvestmentsPage.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InvestmentsPage from './InvestmentsPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useInvestments')

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

describe('InvestmentsPage', () => {
  it('shows the empty state when there are no open investments', () => {
    mockAccounts()
    useInvestments.mockReturnValue({ investments: [], loading: false, error: null, reload: vi.fn(), addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    expect(screen.getByText(/no open investments/i)).toBeInTheDocument()
  })

  it('renders one InvestmentRow per open investment', () => {
    mockAccounts()
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' },
        { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: '', avgCost: '', strategy: 'covered_call', strike: 450, expiry: '2026-03-01' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn(),
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('SPY')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- InvestmentsPage`
Expected: FAIL — `InvestmentsPage.jsx` does not exist.

- [ ] **Step 3: Implement the page**

`src/pages/InvestmentsPage.jsx`:
```jsx
import { useState } from 'react'
import './InvestmentsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'
import Header from '../components/Header'
import InvestmentRow from '../components/InvestmentRow'
import AddInvestmentModal from '../components/AddInvestmentModal'
import InvestmentDetailModal from '../components/InvestmentDetailModal'

export default function InvestmentsPage() {
  const { user } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount } = useAccounts(user?.id)
  const { investments, error, reload, addInvestment, updateInvestment, closeInvestment, deleteInvestment } = useInvestments(activeAccountId)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const selected = investments.find((i) => i.id === selectedId) ?? null

  return (
    <div data-testid="investments-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        onAddTrade={() => setAddOpen(true)}
        addLabel="+ Add Investment"
      />

      {error && (
        <div className="error-banner">
          <span>Couldn't load investments.</span>
          <button type="button" onClick={reload}>Retry</button>
        </div>
      )}

      {investments.length === 0 ? (
        <p className="empty-state">No open investments — add one to get started</p>
      ) : (
        <ul className="investment-list">
          {investments.map((investment) => (
            <InvestmentRow key={investment.id} investment={investment} onClick={setSelectedId} />
          ))}
        </ul>
      )}

      {addOpen && (
        <AddInvestmentModal
          onClose={() => setAddOpen(false)}
          onSubmit={async (investment) => {
            await addInvestment(investment, user.id)
            setAddOpen(false)
          }}
        />
      )}

      {selected && (
        <InvestmentDetailModal
          investment={selected}
          onClose={() => setSelectedId(null)}
          onUpdate={async (patch) => {
            await updateInvestment(selected.id, patch)
            setSelectedId(null)
          }}
          onCloseInvestment={async (closeFields) => {
            await closeInvestment(selected.id, closeFields)
            setSelectedId(null)
          }}
          onDelete={async () => {
            await deleteInvestment(selected.id)
            setSelectedId(null)
          }}
        />
      )}
    </div>
  )
}
```

`src/pages/InvestmentsPage.css`:
```css
.empty-state {
  text-align: center;
  color: var(--text-dim);
  font-size: 15px;
  padding: 80px 24px;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 16px 32px 0;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 8px;
  color: var(--red);
  font-size: 13px;
}

.error-banner button {
  background: transparent;
  border: 1px solid var(--red);
  color: var(--red);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.error-banner button:hover {
  background: rgba(239, 68, 68, 0.12);
}
```

**Note:** this task calls `<Header ... addLabel="+ Add Investment" />`, which requires `Header` to accept an `addLabel` prop. Task 8 updates `Header.jsx` to accept this prop (defaulting to the trades wording so `TradesPage`, Task 7, doesn't need changes). Until Task 8 runs, `InvestmentsPage`'s own tests (which don't assert the button's exact label) still pass — they only check row/empty-state text.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- InvestmentsPage`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/InvestmentsPage.jsx src/pages/InvestmentsPage.css src/pages/InvestmentsPage.test.jsx
git commit -m "feat: implement InvestmentsPage"
```

---

## Task 7: Move Trades screen to `TradesPage`

**Files:**
- Create: `src/pages/TradesPage.jsx` (content moved from `src/pages/HomePage.jsx`)
- Create: `src/pages/TradesPage.css` (moved from `src/pages/HomePage.css`)
- Create: `src/pages/TradesPage.test.jsx` (moved from `src/pages/HomePage.test.jsx`)
- Delete: `src/pages/HomePage.jsx`, `src/pages/HomePage.css`, `src/pages/HomePage.test.jsx`

**Interfaces:**
- No behavior change — same component, same hooks (`useAuth`, `useAccounts`, `useTrades`, `Header`, `TradeRow`, `AddTradeModal`, `TradeDetailModal`). Only the file name, CSS import path, and root `data-testid` change (`home-page` → `trades-page`).
- Produces: the screen wired to `/trades` in Task 9.

- [ ] **Step 1: Copy `HomePage.jsx` to `TradesPage.jsx`, updating the testid and CSS import**

`src/pages/TradesPage.jsx`:
```jsx
import { useState } from 'react'
import './TradesPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useTrades } from '../hooks/useTrades'
import Header from '../components/Header'
import TradeRow from '../components/TradeRow'
import AddTradeModal from '../components/AddTradeModal'
import TradeDetailModal from '../components/TradeDetailModal'

export default function TradesPage() {
  const { user } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount } = useAccounts(user?.id)
  const { trades, error, reload, addTrade, updateTrade, closeTrade, deleteTrade } = useTrades(activeAccountId)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedTradeId, setSelectedTradeId] = useState(null)

  const selectedTrade = trades.find((t) => t.id === selectedTradeId) ?? null

  return (
    <div data-testid="trades-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        onAddTrade={() => setAddOpen(true)}
      />

      {error && (
        <div className="error-banner">
          <span>Couldn't load trades.</span>
          <button type="button" onClick={reload}>Retry</button>
        </div>
      )}

      {trades.length === 0 ? (
        <p className="empty-state">No open trades — add one to get started</p>
      ) : (
        <ul className="trade-list">
          {trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} onClick={setSelectedTradeId} />
          ))}
        </ul>
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

      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTradeId(null)}
          onUpdate={async (patch) => {
            await updateTrade(selectedTrade.id, patch)
            setSelectedTradeId(null)
          }}
          onCloseTrade={async (closeFields) => {
            await closeTrade(selectedTrade.id, closeFields)
            setSelectedTradeId(null)
          }}
          onDelete={async () => {
            await deleteTrade(selectedTrade.id)
            setSelectedTradeId(null)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Copy `HomePage.css` to `TradesPage.css` (identical content)**

Read the existing `src/pages/HomePage.css` and write its exact contents to `src/pages/TradesPage.css`.

- [ ] **Step 3: Copy `HomePage.test.jsx` to `TradesPage.test.jsx`, updating imports and testid**

`src/pages/TradesPage.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TradesPage from './TradesPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useTrades } from '../hooks/useTrades'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useTrades')

describe('TradesPage', () => {
  it('shows the empty state when there are no open trades', () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    useAccounts.mockReturnValue({
      accounts: [{ id: 'a1', name: 'Main Account' }],
      activeAccount: { id: 'a1', name: 'Main Account' },
      activeAccountId: 'a1',
      switchAccount: vi.fn(),
      createAccount: vi.fn(),
      loading: false,
    })
    useTrades.mockReturnValue({ trades: [], loading: false, error: null, reload: vi.fn(), addTrade: vi.fn(), closeTrade: vi.fn(), updateTrade: vi.fn(), deleteTrade: vi.fn() })

    render(<MemoryRouter><TradesPage /></MemoryRouter>)

    expect(screen.getByText(/no open trades/i)).toBeInTheDocument()
  })

  it('shows an error banner with a retry button when trades fail to load', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    useAccounts.mockReturnValue({
      accounts: [{ id: 'a1', name: 'Main Account' }],
      activeAccount: { id: 'a1', name: 'Main Account' },
      activeAccountId: 'a1',
      switchAccount: vi.fn(),
      createAccount: vi.fn(),
      loading: false,
    })
    const reload = vi.fn()
    useTrades.mockReturnValue({ trades: [], loading: false, error: { message: 'Network error' }, reload, addTrade: vi.fn(), closeTrade: vi.fn(), updateTrade: vi.fn(), deleteTrade: vi.fn() })

    const { default: userEvent } = await import('@testing-library/user-event')
    render(<MemoryRouter><TradesPage /></MemoryRouter>)

    expect(screen.getByText(/couldn.t load trades/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(reload).toHaveBeenCalled()
  })

  it('renders one TradeRow per open trade', () => {
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
      trades: [
        { id: 't1', symbol: 'AAPL', type: 'option', optionType: 'call', direction: 'long', quantity: 1, entryPrice: 5, entryDate: '2026-01-01' },
        { id: 't2', symbol: 'ES', type: 'futures', direction: 'short', quantity: 1, entryPrice: 4500, entryDate: '2026-01-02' },
      ],
      loading: false,
      error: null, reload: vi.fn(),
      addTrade: vi.fn(), closeTrade: vi.fn(), updateTrade: vi.fn(), deleteTrade: vi.fn(),
    })

    render(<MemoryRouter><TradesPage /></MemoryRouter>)

    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('ES')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Delete the old files**

```bash
rm src/pages/HomePage.jsx src/pages/HomePage.css src/pages/HomePage.test.jsx
```

- [ ] **Step 5: Run tests to verify the moved suite passes and the old one is gone**

Run: `npm test -- TradesPage`
Expected: PASS (3 tests).
Run: `npm test -- HomePage`
Expected: no test files found (the file no longer exists) — this is fine, do not treat as a failure.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move Trades screen from HomePage to TradesPage"
```

---

## Task 8: Header gains a 4th nav button and configurable Add label

**Files:**
- Modify: `src/components/Header.jsx`
- Modify: `src/components/Header.test.jsx`

**Interfaces:**
- Produces: `Header` now accepts an optional `addLabel` prop (defaults to `'+ Add Trade'`), and renders a **Trades** `NavLink` as the first nav item (pointing at `/trades`), before Stats/Analyze/Matt Cap.

- [ ] **Step 1: Update the failing/changed tests**

Modify `src/components/Header.test.jsx`: update the nav-links test to also expect the Trades link, and add a test for the configurable add-button label.

```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Header from './Header'

const accounts = [{ id: 'a1', name: 'Main Account' }, { id: 'a2', name: 'Swing' }]

function setup(props = {}) {
  const defaults = {
    accounts,
    activeAccount: accounts[0],
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
    onAddTrade: vi.fn(),
  }
  return render(<MemoryRouter><Header {...defaults} {...props} /></MemoryRouter>)
}

describe('Header', () => {
  it('shows the active account name as the title', () => {
    setup()
    expect(screen.getByText('Main Account')).toBeInTheDocument()
  })

  it('opens a dropdown listing other accounts and switches on click', async () => {
    const switchAccount = vi.fn()
    setup({ switchAccount })
    await userEvent.click(screen.getByText('Main Account'))
    await userEvent.click(screen.getByText('Swing'))
    expect(switchAccount).toHaveBeenCalledWith('a2')
  })

  it('renders Trades, Stats, Analyze, Matt Cap nav links and an Add button', () => {
    setup()
    expect(screen.getByRole('link', { name: /trades/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /stats/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /analyze/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /matt cap/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add trade/i })).toBeInTheDocument()
  })

  it('calls onAddTrade when the Add button is clicked', async () => {
    const onAddTrade = vi.fn()
    setup({ onAddTrade })
    await userEvent.click(screen.getByRole('button', { name: /add trade/i }))
    expect(onAddTrade).toHaveBeenCalled()
  })

  it('uses a custom addLabel when provided', () => {
    setup({ addLabel: '+ Add Investment' })
    expect(screen.getByRole('button', { name: /add investment/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify the new/changed ones fail**

Run: `npm test -- Header`
Expected: FAIL — no Trades link yet, no `addLabel` prop support.

- [ ] **Step 3: Update the component**

`src/components/Header.jsx`:
```jsx
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import './Header.css'

export default function Header({ accounts, activeAccount, switchAccount, createAccount, onAddTrade, addLabel = '+ Add Trade' }) {
  const [open, setOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="account-switcher">
        <button type="button" onClick={() => setOpen((o) => !o)} className="account-name">
          {activeAccount?.name ?? 'Account'}
        </button>
        {open && (
          <ul className="account-dropdown">
            {accounts.filter((a) => a.id !== activeAccount?.id).map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => { switchAccount(a.id); setOpen(false) }}>
                  {a.name}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt('New account name')
                  if (name) createAccount(name)
                  setOpen(false)
                }}
              >
                + New account
              </button>
            </li>
          </ul>
        )}
      </div>

      <nav className="app-nav">
        <NavLink to="/trades" className={({ isActive }) => (isActive ? 'active' : undefined)}>Trades</NavLink>
        <NavLink to="/stats" className={({ isActive }) => (isActive ? 'active' : undefined)}>Stats</NavLink>
        <NavLink to="/analyze" className={({ isActive }) => (isActive ? 'active' : undefined)}>Analyze</NavLink>
        <NavLink to="/matt-cap" className={({ isActive }) => (isActive ? 'active' : undefined)}>Matt Cap</NavLink>
      </nav>

      <button type="button" className="add-trade-btn" onClick={onAddTrade}>
        {addLabel}
      </button>
    </header>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Header`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.jsx src/components/Header.test.jsx
git commit -m "feat: add Trades nav link and configurable Add button label to Header"
```

---

## Task 9: Wire routing — `/` is Investments, `/trades` is Trades

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

**Interfaces:**
- Produces: final route table — `/login`, `/` (InvestmentsPage), `/trades` (TradesPage), `/stats`, `/analyze`, `/matt-cap`.

- [ ] **Step 1: Update the failing/changed tests**

`src/App.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { useAuth } from './hooks/useAuth'
import { useAccounts } from './hooks/useAccounts'
import { useInvestments } from './hooks/useInvestments'

vi.mock('./hooks/useAuth')
vi.mock('./hooks/useAccounts')
vi.mock('./hooks/useInvestments')

describe('App', () => {
  it('redirects to login when signed out', async () => {
    useAuth.mockReturnValue({ user: null, session: null, loading: false, signOut: vi.fn() })
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('login-page')).toBeInTheDocument())
  })

  it('redirects away from login to home (Investments) when already signed in', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' }, session: {}, loading: false, signOut: vi.fn() })
    useAccounts.mockReturnValue({
      accounts: [{ id: 'a1', name: 'Main Account' }],
      activeAccount: { id: 'a1', name: 'Main Account' },
      activeAccountId: 'a1',
      switchAccount: vi.fn(),
      createAccount: vi.fn(),
      loading: false,
    })
    useInvestments.mockReturnValue({ investments: [], loading: false, error: null, reload: vi.fn(), addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('investments-page')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests to verify the changed one fails**

Run: `npm test -- App.test`
Expected: FAIL — `/` still renders the old Trades-based home.

- [ ] **Step 3: Update `App.jsx`**

`src/App.jsx`:
```jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import InvestmentsPage from './pages/InvestmentsPage'
import TradesPage from './pages/TradesPage'
import PlaceholderPage from './pages/PlaceholderPage'

function RequireAuth({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<RequireAuth user={user}><InvestmentsPage /></RequireAuth>} />
      <Route path="/trades" element={<RequireAuth user={user}><TradesPage /></RequireAuth>} />
      <Route path="/stats" element={<RequireAuth user={user}><PlaceholderPage title="Stats" /></RequireAuth>} />
      <Route path="/analyze" element={<RequireAuth user={user}><PlaceholderPage title="Analyze" /></RequireAuth>} />
      <Route path="/matt-cap" element={<RequireAuth user={user}><PlaceholderPage title="Matt Cap" /></RequireAuth>} />
    </Routes>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- App.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat: make Investments the home route, Trades moves to /trades"
```

---

## Task 10: Full test suite pass and manual smoke test

**Files:** none (verification-only task).

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all tests across all files pass (existing Phase 1 tests plus all new ones from this plan).

- [ ] **Step 2: Confirm the user has run the SQL migration**

Ask the user to confirm `docs/superpowers/specs/2026-07-25-investments-strategy-migration.sql` has been run in their Supabase SQL Editor. Do not proceed to live testing until confirmed.

- [ ] **Step 3: Manual smoke test against the live Supabase project**

With `.env` populated, run `npm run dev` and walk through:
1. Sign in — land on `/` showing Investments (empty state if no investments yet, or existing rows if any already have `status='open'`).
2. Click **+ Add Investment** → add a Stock (AAPL, 10 shares, $150 avg cost).
3. Add an Option investment for each of the 6 strategies in turn — confirm the strike_2 field only appears for Put Credit Spread and Call Credit Spread, and confirm each saves without error.
4. Click a row, edit a field, save — confirm it persists.
5. Close a position — confirm it disappears from the open list.
6. Delete an investment — confirm removal.
7. Click the **Trades** nav button — confirm the existing Trades screen still works exactly as before (add/close/delete a trade).
8. Confirm Stats/Analyze/Matt Cap nav buttons still route to placeholder pages.

- [ ] **Step 4: Fix any issues found, re-run affected unit tests, and commit fixes**

If manual testing surfaces a bug, fix it in the relevant file, re-run that file's test suite, and commit with a `fix:` message.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: Investments home + Trades relocation complete"
```
