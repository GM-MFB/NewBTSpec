# Trades Journal Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Vite + React app with Supabase auth, multi-account support, and an open-trades journal (add/edit/close), per `docs/superpowers/specs/2026-07-25-trades-journal-phase1-design.md`.

**Architecture:** SPA with React Router. Three custom hooks (`useAuth`, `useAccounts`, `useTrades`) wrap the shared Supabase client and own all data access; components are presentation-only and consume the hooks. Pure mapper functions handle snake_case ↔ camelCase conversion so they're unit-testable without a live database.

**Tech Stack:** Vite, React 18, react-router-dom, @supabase/supabase-js v2, Vitest, @testing-library/react, jsdom.

## Global Constraints

- Do not change table/column names, RLS assumptions, or the Supabase client setup pattern — copy `utils/supabase.js` and `hooks/useAuth.js` verbatim from `database-reference.md`.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (Vite convention per the reference doc).
- Row↔JS convention: DB is snake_case, JS is camelCase, blank strings ↔ `null` at the mapper boundary.
- Dark theme, monospace numerals, minimal chrome — no UI component framework.
- No schema changes. No P&L calculation in Phase 1 (closed trades don't appear on Home).

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`
- Create: `src/main.jsx`, `src/App.jsx`, `src/index.css`
- Create: `.env.example`, `.gitignore`
- Create: `src/test/setup.js`

**Interfaces:**
- Produces: a running `npm run dev` app and a working `npm test` command for all later tasks.

- [ ] **Step 1: Scaffold the Vite React app**

Run:
```bash
npm create vite@latest . -- --template react
```
When prompted about the non-empty directory (it contains `database-reference.md` and `docs/`), choose to continue/ignore — do not let it delete existing files.

- [ ] **Step 2: Install runtime and test dependencies**

```bash
npm install @supabase/supabase-js react-router-dom
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 3: Configure Vitest in `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
```

- [ ] **Step 4: Add test setup file**

`src/test/setup.js`:
```js
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to `package.json`**

Add under `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 6: Add `.env.example` and confirm `.gitignore` excludes `.env`**

`.env.example`:
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
```

Confirm the Vite-generated `.gitignore` already contains `.env` / `.env.local`; if not, add `.env` and `.env.local` to it.

- [ ] **Step 7: Base dark theme in `src/index.css`**

```css
:root {
  color-scheme: dark;
  --bg: #0a0a0a;
  --bg-elevated: #141414;
  --border: #262626;
  --text: #e5e5e5;
  --text-dim: #888;
  --accent: #3b82f6;
  --green: #22c55e;
  --red: #ef4444;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.mono {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

button {
  font-family: inherit;
  cursor: pointer;
}
```

- [ ] **Step 8: Verify dev server and test runner both work**

Run: `npm test` — expect: no test files found, passes with 0 tests (no failure).
Run: `npm run dev` — confirm it starts without errors, then stop it.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React app with Vitest"
```

---

## Task 2: Supabase client util

**Files:**
- Create: `src/utils/supabase.js`

**Interfaces:**
- Produces: `export const supabase` — the shared Supabase client instance, imported by every hook.

- [ ] **Step 1: Write `src/utils/supabase.js` verbatim per the reference doc**

```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = createClient(supabaseUrl, supabaseKey)
```

- [ ] **Step 2: Manually verify env wiring**

Copy `.env.example` to `.env` and fill in your real Supabase URL + key (these are yours to paste in, not committed). Run `npm run dev`, open the browser console, confirm no "supabaseUrl is required" error is thrown on load. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/utils/supabase.js
git commit -m "feat: add Supabase client util"
```

---

## Task 3: Trade row mappers (pure functions, TDD)

**Files:**
- Create: `src/lib/tradeMappers.js`
- Test: `src/lib/tradeMappers.test.js`

**Interfaces:**
- Produces: `fromRow(row) -> trade` (camelCase, nulls become `''`), `toRow(trade) -> row` (snake_case, blanks become `null`). Consumed by `useTrades` (Task 6).

- [ ] **Step 1: Write the failing tests**

`src/lib/tradeMappers.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { fromRow, toRow } from './tradeMappers'

describe('fromRow', () => {
  it('converts snake_case db row to camelCase trade object', () => {
    const row = {
      id: '1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      type: 'option', symbol: 'AAPL', option_type: 'call', strike: 200,
      expiry: '2026-02-01', direction: 'long', quantity: 1,
      entry_price: 5.5, exit_price: null, entry_date: '2026-01-01',
      exit_date: null, status: 'open', fees: 1.5, notes: null, chart_link: null,
    }
    expect(fromRow(row)).toEqual({
      id: '1', accountId: 'a1', userId: 'u1', createdAt: '2026-01-01',
      type: 'option', symbol: 'AAPL', optionType: 'call', strike: 200,
      expiry: '2026-02-01', direction: 'long', quantity: 1,
      entryPrice: 5.5, exitPrice: '', entryDate: '2026-01-01',
      exitDate: '', status: 'open', fees: 1.5, notes: '', chartLink: '',
    })
  })
})

describe('toRow', () => {
  it('converts camelCase trade object to snake_case db row, blanks to null', () => {
    const trade = {
      type: 'futures', symbol: 'ES', optionType: '', strike: '',
      expiry: '', direction: 'short', quantity: 2, entryPrice: 4500,
      exitPrice: '', entryDate: '2026-01-01', exitDate: '',
      status: 'open', fees: 2, notes: '', chartLink: '',
    }
    expect(toRow(trade)).toEqual({
      type: 'futures', symbol: 'ES', option_type: null, strike: null,
      expiry: null, direction: 'short', quantity: 2, entry_price: 4500,
      exit_price: null, entry_date: '2026-01-01', exit_date: null,
      status: 'open', fees: 2, notes: null, chart_link: null,
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tradeMappers`
Expected: FAIL — `tradeMappers.js` does not exist / exports missing.

- [ ] **Step 3: Implement the mappers**

`src/lib/tradeMappers.js`:
```js
export function fromRow(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    userId: row.user_id,
    createdAt: row.created_at,
    type: row.type ?? '',
    symbol: row.symbol ?? '',
    optionType: row.option_type ?? '',
    strike: row.strike ?? '',
    expiry: row.expiry ?? '',
    direction: row.direction ?? '',
    quantity: row.quantity ?? '',
    entryPrice: row.entry_price ?? '',
    exitPrice: row.exit_price ?? '',
    entryDate: row.entry_date ?? '',
    exitDate: row.exit_date ?? '',
    status: row.status ?? '',
    fees: row.fees ?? '',
    notes: row.notes ?? '',
    chartLink: row.chart_link ?? '',
  }
}

function blankToNull(value) {
  return value === '' || value === undefined ? null : value
}

export function toRow(trade) {
  return {
    type: blankToNull(trade.type),
    symbol: blankToNull(trade.symbol),
    option_type: blankToNull(trade.optionType),
    strike: blankToNull(trade.strike),
    expiry: blankToNull(trade.expiry),
    direction: blankToNull(trade.direction),
    quantity: blankToNull(trade.quantity),
    entry_price: blankToNull(trade.entryPrice),
    exit_price: blankToNull(trade.exitPrice),
    entry_date: blankToNull(trade.entryDate),
    exit_date: blankToNull(trade.exitDate),
    status: blankToNull(trade.status),
    fees: blankToNull(trade.fees),
    notes: blankToNull(trade.notes),
    chart_link: blankToNull(trade.chartLink),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tradeMappers`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tradeMappers.js src/lib/tradeMappers.test.js
git commit -m "feat: add trade row <-> object mappers"
```

---

## Task 4: `useAuth` hook

**Files:**
- Create: `src/hooks/useAuth.js`
- Test: `src/hooks/useAuth.test.js`

**Interfaces:**
- Consumes: `supabase` from `src/utils/supabase.js` (Task 2).
- Produces: `useAuth() -> { user, session, loading, signOut }`. Consumed by `App.jsx` (Task 7) and `LoginPage` (Task 8).

- [ ] **Step 1: Write the failing test**

`src/hooks/useAuth.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from './useAuth'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
  },
}))

describe('useAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the current session on mount', async () => {
    const fakeUser = { id: 'u1', email: 'a@b.com' }
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: fakeUser } } })

    const { result } = renderHook(() => useAuth())

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual(fakeUser)
  })

  it('returns null user when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useAuth`
Expected: FAIL — `useAuth.js` does not exist.

- [ ] **Step 3: Implement the hook**

`src/hooks/useAuth.js`:
```js
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  return {
    session,
    user: session?.user ?? null,
    loading,
    signOut: () => supabase.auth.signOut(),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useAuth`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.js src/hooks/useAuth.test.js
git commit -m "feat: add useAuth hook"
```

---

## Task 5: `useAccounts` hook

**Files:**
- Create: `src/hooks/useAccounts.js`
- Test: `src/hooks/useAccounts.test.js`

**Interfaces:**
- Consumes: `supabase` from `src/utils/supabase.js` (Task 2); a `userId` string.
- Produces: `useAccounts(userId) -> { accounts, activeAccountId, activeAccount, loading, switchAccount(id), createAccount(name) }`. Consumed by `Header` (Task 9) and `HomePage` (Task 10).

- [ ] **Step 1: Write the failing tests**

`src/hooks/useAccounts.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAccounts } from './useAccounts'
import { supabase } from '../utils/supabase'

function mockFrom(returnData) {
  const single = vi.fn().mockResolvedValue({ data: returnData.inserted, error: null })
  const select2 = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select: select2 }))
  const order = vi.fn().mockResolvedValue({ data: returnData.list, error: null })
  const eq = vi.fn(() => ({ order }))
  const select1 = vi.fn(() => ({ eq }))
  return { select: select1, insert }
}

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

describe('useAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('loads existing accounts and selects the first as active', async () => {
    const accounts = [{ id: 'a1', name: 'Main Account' }, { id: 'a2', name: 'Second' }]
    supabase.from.mockReturnValue(mockFrom({ list: accounts, inserted: null }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts).toEqual(accounts)
    expect(result.current.activeAccountId).toBe('a1')
  })

  it('auto-creates a Main Account when the user has zero accounts', async () => {
    const created = { id: 'a1', name: 'Main Account' }
    supabase.from.mockReturnValue(mockFrom({ list: [], inserted: created }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts).toEqual([created])
    expect(result.current.activeAccountId).toBe('a1')
  })

  it('switchAccount updates activeAccountId and localStorage', async () => {
    const accounts = [{ id: 'a1', name: 'Main' }, { id: 'a2', name: 'Second' }]
    supabase.from.mockReturnValue(mockFrom({ list: accounts, inserted: null }))

    const { result } = renderHook(() => useAccounts('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.switchAccount('a2'))

    expect(result.current.activeAccountId).toBe('a2')
    expect(localStorage.getItem('bt_active_account')).toBe('a2')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useAccounts`
Expected: FAIL — `useAccounts.js` does not exist.

- [ ] **Step 3: Implement the hook**

`src/hooks/useAccounts.js`:
```js
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase'

const STORAGE_KEY = 'bt_active_account'

export function useAccounts(userId) {
  const [accounts, setAccounts] = useState([])
  const [activeAccountId, setActiveAccountId] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      setLoading(false)
      return
    }

    let list = data
    if (list.length === 0) {
      const { data: created } = await supabase
        .from('accounts')
        .insert({ user_id: userId, name: 'Main Account', cash: 0 })
        .select()
        .single()
      list = [created]
    }

    setAccounts(list)
    const stored = localStorage.getItem(STORAGE_KEY)
    const valid = list.find((a) => a.id === stored)
    const active = valid ? valid.id : list[0].id
    setActiveAccountId(active)
    localStorage.setItem(STORAGE_KEY, active)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  function switchAccount(id) {
    setActiveAccountId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  async function createAccount(name) {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ user_id: userId, name, cash: 0 })
      .select()
      .single()
    if (error) throw error
    setAccounts((prev) => [...prev, data])
    switchAccount(data.id)
    return data
  }

  return {
    accounts,
    activeAccountId,
    activeAccount: accounts.find((a) => a.id === activeAccountId) ?? null,
    loading,
    switchAccount,
    createAccount,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useAccounts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAccounts.js src/hooks/useAccounts.test.js
git commit -m "feat: add useAccounts hook"
```

---

## Task 6: `useTrades` hook

**Files:**
- Create: `src/hooks/useTrades.js`
- Test: `src/hooks/useTrades.test.js`

**Interfaces:**
- Consumes: `supabase` (Task 2), `fromRow`/`toRow` from `src/lib/tradeMappers.js` (Task 3), an `accountId` string.
- Produces: `useTrades(accountId) -> { trades, loading, error, reload(), addTrade(trade), updateTrade(id, patch), closeTrade(id, { exitPrice, exitDate }), deleteTrade(id) }`. `trades` contains only `status: 'open'` rows. `error` and `reload` back the Home-load error banner (Task 10). Consumed by `HomePage` (Task 10), `AddTradeModal` (Task 11), `TradeDetailModal` (Task 12).

- [ ] **Step 1: Write the failing tests**

`src/hooks/useTrades.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTrades } from './useTrades'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockSelectChain(data) {
  const order = vi.fn().mockResolvedValue({ data, error: null })
  const eq2 = vi.fn(() => ({ order }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  return { select: vi.fn(() => ({ eq: eq1 })) }
}

describe('useTrades', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads only open trades for the account, mapped to camelCase', async () => {
    const rows = [{
      id: 't1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      type: 'futures', symbol: 'ES', option_type: null, strike: null,
      expiry: null, direction: 'long', quantity: 1, entry_price: 4500,
      exit_price: null, entry_date: '2026-01-01', exit_date: null,
      status: 'open', fees: 0, notes: null, chart_link: null,
    }]
    supabase.from.mockReturnValue(mockSelectChain(rows))

    const { result } = renderHook(() => useTrades('a1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.trades).toHaveLength(1)
    expect(result.current.trades[0].symbol).toBe('ES')
    expect(result.current.trades[0].entryPrice).toBe(4500)
    expect(supabase.from).toHaveBeenCalledWith('trades')
  })

  it('addTrade inserts a row with status open and refreshes the list', async () => {
    supabase.from.mockReturnValue(mockSelectChain([]))
    const { result } = renderHook(() => useTrades('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const insertedRow = {
      id: 't2', account_id: 'a1', user_id: 'u1', created_at: '2026-01-02',
      type: 'futures', symbol: 'NQ', option_type: null, strike: null,
      expiry: null, direction: 'long', quantity: 1, entry_price: 15000,
      exit_price: null, entry_date: '2026-01-02', exit_date: null,
      status: 'open', fees: 0, notes: null, chart_link: null,
    }
    const single = vi.fn().mockResolvedValue({ data: insertedRow, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    supabase.from.mockReturnValue({ ...mockSelectChain([insertedRow]), insert })

    await act(async () => {
      await result.current.addTrade({
        type: 'futures', symbol: 'NQ', direction: 'long', quantity: 1,
        entryPrice: 15000, entryDate: '2026-01-02', status: 'open',
      }, 'u1')
    })

    expect(insert).toHaveBeenCalled()
    const insertArg = insert.mock.calls[0][0]
    expect(insertArg.account_id).toBe('a1')
    expect(insertArg.user_id).toBe('u1')
    expect(insertArg.symbol).toBe('NQ')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useTrades`
Expected: FAIL — `useTrades.js` does not exist.

- [ ] **Step 3: Implement the hook**

`src/hooks/useTrades.js`:
```js
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
      .eq('status', 'open')
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
      .insert({ account_id: accountId, user_id: userId, ...toRow({ ...trade, status: 'open' }) })
      .select()
      .single()
    if (err) throw err
    await load()
    return fromRow(data)
  }

  async function updateTrade(id, patch) {
    const { error: err } = await supabase.from('trades').update(toRow(patch)).eq('id', id)
    if (err) throw err
    await load()
  }

  async function closeTrade(id, { exitPrice, exitDate }) {
    const { error: err } = await supabase
      .from('trades')
      .update(toRow({ status: 'closed', exitPrice, exitDate }))
      .eq('id', id)
    if (err) throw err
    await load()
  }

  async function deleteTrade(id) {
    const { error: err } = await supabase.from('trades').delete().eq('id', id)
    if (err) throw err
    await load()
  }

  return { trades, loading, error, reload: load, addTrade, updateTrade, closeTrade, deleteTrade }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useTrades`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTrades.js src/hooks/useTrades.test.js
git commit -m "feat: add useTrades hook"
```

---

## Task 7: App shell, routing, and protected routes

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/main.jsx`
- Test: `src/App.test.jsx`

**Interfaces:**
- Consumes: `useAuth` (Task 4).
- Produces: route structure `/login`, `/` (Home), `/stats`, `/analyze`, `/matt-cap`, with `/` and other app routes redirecting to `/login` when signed out. Consumed manually by later page tasks, which register themselves as route elements.

- [ ] **Step 1: Write the failing test**

`src/App.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { useAuth } from './hooks/useAuth'

vi.mock('./hooks/useAuth')

describe('App', () => {
  it('redirects to login when signed out', async () => {
    useAuth.mockReturnValue({ user: null, session: null, loading: false, signOut: vi.fn() })
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('login-page')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- App.test`
Expected: FAIL — `App.jsx` doesn't yet render routes/`data-testid="login-page"`.

- [ ] **Step 3: Implement `App.jsx` with a placeholder `LoginPage` stub**

This task only wires routing; `LoginPage`, `HomePage`, and the placeholder pages get their real implementations in Tasks 8–13. For now, stub minimal components inline so the routing test can pass — Task 8 will replace the login stub with the real file, and the import path stays the same.

`src/pages/LoginPage.jsx` (temporary minimal stub — Task 8 fills this in for real):
```jsx
export default function LoginPage() {
  return <div data-testid="login-page">Login</div>
}
```

`src/App.jsx`:
```jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth user={user}><HomePage /></RequireAuth>} />
      <Route path="/stats" element={<RequireAuth user={user}><PlaceholderPage title="Stats" /></RequireAuth>} />
      <Route path="/analyze" element={<RequireAuth user={user}><PlaceholderPage title="Analyze" /></RequireAuth>} />
      <Route path="/matt-cap" element={<RequireAuth user={user}><PlaceholderPage title="Matt Cap" /></RequireAuth>} />
    </Routes>
  )
}
```

`src/pages/HomePage.jsx` (temporary minimal stub — Task 10 fills this in for real):
```jsx
export default function HomePage() {
  return <div data-testid="home-page">Home</div>
}
```

`src/pages/PlaceholderPage.jsx` (temporary minimal stub — Task 13 fills this in for real):
```jsx
export default function PlaceholderPage({ title }) {
  return <div>{title} — Coming soon</div>
}
```

`src/main.jsx`:
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- App.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/main.jsx src/App.test.jsx src/pages/LoginPage.jsx src/pages/HomePage.jsx src/pages/PlaceholderPage.jsx
git commit -m "feat: add app shell with protected routing"
```

---

## Task 8: Login page

**Files:**
- Modify: `src/pages/LoginPage.jsx` (replacing the Task 7 stub)
- Test: `src/pages/LoginPage.test.jsx`

**Interfaces:**
- Consumes: `supabase.auth.signInWithPassword`, `supabase.auth.signUp` from `src/utils/supabase.js`.
- Produces: a form UI; on success, `useAuth`'s `onAuthStateChange` (Task 4) picks up the new session automatically, so this component does not need to navigate manually.

- [ ] **Step 1: Write the failing tests**

`src/pages/LoginPage.test.jsx`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './LoginPage'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({
  supabase: { auth: { signInWithPassword: vi.fn(), signUp: vi.fn() } },
}))

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('submits sign-in with email and password', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ error: null })
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret123' })
  })

  it('shows an inline error on failed sign-in', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/invalid login credentials/i)).toBeInTheDocument()
  })

  it('toggles to sign-up mode and calls signUp', async () => {
    supabase.auth.signUp.mockResolvedValue({ error: null })
    render(<LoginPage />)

    await userEvent.click(screen.getByRole('button', { name: /create an account/i }))
    await userEvent.type(screen.getByLabelText(/email/i), 'new@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))

    expect(supabase.auth.signUp).toHaveBeenCalledWith({ email: 'new@b.com', password: 'secret123' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- LoginPage`
Expected: FAIL — current stub has no form.

- [ ] **Step 3: Implement the page**

`src/pages/LoginPage.jsx`:
```jsx
import { useState } from 'react'
import { supabase } from '../utils/supabase'

export default function LoginPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const action = mode === 'signin' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { error: err } = await action({ email, password })
    if (err) setError(err.message)
  }

  return (
    <div data-testid="login-page" className="login-page">
      <h1>BT Speculation</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        {error && <p role="alert">{error}</p>}

        <button type="submit">{mode === 'signin' ? 'Sign In' : 'Sign Up'}</button>
      </form>
      <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? 'Create an account' : 'Back to sign in'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- LoginPage`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/LoginPage.jsx src/pages/LoginPage.test.jsx
git commit -m "feat: implement login/signup page"
```

---

## Task 9: Header component (account name + switcher + nav)

**Files:**
- Create: `src/components/Header.jsx`
- Test: `src/components/Header.test.jsx`

**Interfaces:**
- Consumes: `accounts`, `activeAccount`, `switchAccount`, `createAccount` (shape from Task 5's `useAccounts`), passed in as props (Header does not call the hook itself, to stay presentation-only and easily testable).
- Produces: renders account name + dropdown + nav links to `/stats`, `/analyze`, `/matt-cap`, and an `onAddTrade` button click callback prop. Consumed by `HomePage` (Task 10).

- [ ] **Step 1: Write the failing tests**

`src/components/Header.test.jsx`:
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

  it('renders Stats, Analyze, Matt Cap nav links and an Add Trade button', () => {
    setup()
    expect(screen.getByRole('link', { name: /stats/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /analyze/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /matt cap/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add trade/i })).toBeInTheDocument()
  })

  it('calls onAddTrade when the Add Trade button is clicked', async () => {
    const onAddTrade = vi.fn()
    setup({ onAddTrade })
    await userEvent.click(screen.getByRole('button', { name: /add trade/i }))
    expect(onAddTrade).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Header`
Expected: FAIL — `Header.jsx` does not exist.

- [ ] **Step 3: Implement the component**

`src/components/Header.jsx`:
```jsx
import { useState } from 'react'
import { NavLink } from 'react-router-dom'

export default function Header({ accounts, activeAccount, switchAccount, createAccount, onAddTrade }) {
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
        <NavLink to="/stats">Stats</NavLink>
        <NavLink to="/analyze">Analyze</NavLink>
        <NavLink to="/matt-cap">Matt Cap</NavLink>
      </nav>

      <button type="button" className="add-trade-btn" onClick={onAddTrade}>
        + Add Trade
      </button>
    </header>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Header`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.jsx src/components/Header.test.jsx
git commit -m "feat: add Header component with account switcher and nav"
```

---

## Task 10: HomePage — open trades list

**Files:**
- Modify: `src/pages/HomePage.jsx` (replacing the Task 7 stub)
- Create: `src/components/TradeRow.jsx`
- Test: `src/pages/HomePage.test.jsx`
- Test: `src/components/TradeRow.test.jsx`

**Interfaces:**
- Consumes: `useAuth` (Task 4), `useAccounts` (Task 5), `useTrades` (Task 6), `Header` (Task 9).
- Produces: the composed Home screen. `TradeRow` takes a single `trade` prop (shape from `fromRow`, Task 3) and an `onClick` prop; consumed here and reused nowhere else in Phase 1.

- [ ] **Step 1: Write the failing `TradeRow` test**

`src/components/TradeRow.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TradeRow from './TradeRow'

const trade = {
  id: 't1', symbol: 'AAPL', type: 'option', optionType: 'call',
  direction: 'long', quantity: 2, entryPrice: 5.5, entryDate: '2026-01-01',
}

describe('TradeRow', () => {
  it('renders symbol, type badge, direction, entry price, and quantity', () => {
    render(<TradeRow trade={trade} onClick={vi.fn()} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText(/call/i)).toBeInTheDocument()
    expect(screen.getByText(/long/i)).toBeInTheDocument()
    expect(screen.getByText('5.5')).toBeInTheDocument()
  })

  it('calls onClick with the trade id when clicked', async () => {
    const onClick = vi.fn()
    render(<TradeRow trade={trade} onClick={onClick} />)
    await userEvent.click(screen.getByTestId('trade-row'))
    expect(onClick).toHaveBeenCalledWith('t1')
  })
})
```

- [ ] **Step 2: Write the failing `HomePage` test**

`src/pages/HomePage.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from './HomePage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useTrades } from '../hooks/useTrades'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useTrades')

describe('HomePage', () => {
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

    render(<MemoryRouter><HomePage /></MemoryRouter>)

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
    render(<MemoryRouter><HomePage /></MemoryRouter>)

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

    render(<MemoryRouter><HomePage /></MemoryRouter>)

    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('ES')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- TradeRow HomePage`
Expected: FAIL — `TradeRow.jsx` doesn't exist; `HomePage.jsx` is still the Task 7 stub.

- [ ] **Step 4: Implement `TradeRow`**

`src/components/TradeRow.jsx`:
```jsx
export default function TradeRow({ trade, onClick }) {
  const badge = trade.type === 'option' ? trade.optionType : trade.type

  return (
    <li className="trade-row" data-testid="trade-row" onClick={() => onClick(trade.id)}>
      <span className="mono trade-symbol">{trade.symbol}</span>
      <span className="trade-badge">{badge}</span>
      <span className={`trade-direction trade-direction--${trade.direction}`}>{trade.direction}</span>
      <span className="mono">{trade.entryPrice}</span>
      <span className="mono">{trade.quantity}</span>
    </li>
  )
}
```

- [ ] **Step 5: Implement `HomePage`**

`src/pages/HomePage.jsx` (this also introduces the Add Trade / Trade Detail modals as open/close state — the modal *contents* are stubbed here and get their real implementation in Tasks 11–12, but the wiring is final):

```jsx
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useTrades } from '../hooks/useTrades'
import Header from '../components/Header'
import TradeRow from '../components/TradeRow'
import AddTradeModal from '../components/AddTradeModal'
import TradeDetailModal from '../components/TradeDetailModal'

export default function HomePage() {
  const { user } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount } = useAccounts(user?.id)
  const { trades, error, reload, addTrade, updateTrade, closeTrade, deleteTrade } = useTrades(activeAccountId)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedTradeId, setSelectedTradeId] = useState(null)

  const selectedTrade = trades.find((t) => t.id === selectedTradeId) ?? null

  return (
    <div data-testid="home-page">
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

Add temporary stubs so `HomePage`'s tests (which never open a modal) pass before Tasks 11–12 exist:

`src/components/AddTradeModal.jsx` (temporary — Task 11 replaces this):
```jsx
export default function AddTradeModal() {
  return null
}
```

`src/components/TradeDetailModal.jsx` (temporary — Task 12 replaces this):
```jsx
export default function TradeDetailModal() {
  return null
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- TradeRow HomePage`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add src/pages/HomePage.jsx src/pages/HomePage.test.jsx src/components/TradeRow.jsx src/components/TradeRow.test.jsx src/components/AddTradeModal.jsx src/components/TradeDetailModal.jsx
git commit -m "feat: implement HomePage with open trades list"
```

---

## Task 11: Add Trade modal

**Files:**
- Modify: `src/components/AddTradeModal.jsx` (replacing the Task 10 stub)
- Test: `src/components/AddTradeModal.test.jsx`

**Interfaces:**
- Consumes: none directly (pure form component).
- Produces: `<AddTradeModal onClose={fn} onSubmit={fn(tradeObject)} />`. `tradeObject` matches the camelCase shape `toRow` (Task 3) expects, so it can be passed straight to `addTrade` (Task 6).

- [ ] **Step 1: Write the failing tests**

`src/components/AddTradeModal.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddTradeModal from './AddTradeModal'

describe('AddTradeModal', () => {
  it('shows option-only fields only when Option is selected', async () => {
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.queryByLabelText(/strike/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^option$/i }))
    expect(screen.getByLabelText(/strike/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/expiry/i)).toBeInTheDocument()
  })

  it('submits a futures trade with only common fields', async () => {
    const onSubmit = vi.fn()
    render(<AddTradeModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^futures$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'ES')
    await userEvent.selectOptions(screen.getByLabelText(/direction/i), 'long')
    await userEvent.type(screen.getByLabelText(/quantity/i), '1')
    await userEvent.type(screen.getByLabelText(/entry price/i), '4500')
    await userEvent.type(screen.getByLabelText(/entry date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'futures', symbol: 'ES', direction: 'long', quantity: '1',
      entryPrice: '4500', entryDate: '2026-01-01',
    }))
  })

  it('submits an option trade including option fields', async () => {
    const onSubmit = vi.fn()
    render(<AddTradeModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^option$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'AAPL')
    await userEvent.selectOptions(screen.getByLabelText(/direction/i), 'long')
    await userEvent.selectOptions(screen.getByLabelText(/option type/i), 'call')
    await userEvent.type(screen.getByLabelText(/strike/i), '200')
    await userEvent.type(screen.getByLabelText(/expiry/i), '2026-02-01')
    await userEvent.type(screen.getByLabelText(/quantity/i), '1')
    await userEvent.type(screen.getByLabelText(/entry price/i), '5.5')
    await userEvent.type(screen.getByLabelText(/entry date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'option', symbol: 'AAPL', optionType: 'call', strike: '200', expiry: '2026-02-01',
    }))
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(<AddTradeModal onClose={onClose} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /close|cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an inline error and keeps entered values when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('insert failed'))
    render(<AddTradeModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^futures$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'ES')
    await userEvent.type(screen.getByLabelText(/quantity/i), '1')
    await userEvent.type(screen.getByLabelText(/entry price/i), '4500')
    await userEvent.type(screen.getByLabelText(/entry date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText(/insert failed/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/symbol/i)).toHaveValue('ES')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- AddTradeModal`
Expected: FAIL — stub returns `null`.

- [ ] **Step 3: Implement the component**

`src/components/AddTradeModal.jsx`:
```jsx
import { useState } from 'react'

const initial = {
  type: '', symbol: '', direction: 'long', quantity: '', entryPrice: '',
  entryDate: '', fees: '', notes: '', chartLink: '',
  optionType: '', strike: '', expiry: '',
}

export default function AddTradeModal({ onClose, onSubmit }) {
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

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Add Trade">
      <div className="modal">
        <div className="type-toggle">
          <button type="button" aria-pressed={fields.type === 'option'} onClick={() => set('type', 'option')}>Option</button>
          <button type="button" aria-pressed={fields.type === 'futures'} onClick={() => set('type', 'futures')}>Futures</button>
        </div>

        {fields.type && (
          <form onSubmit={handleSubmit}>
            <label htmlFor="symbol">Symbol</label>
            <input id="symbol" value={fields.symbol} onChange={(e) => set('symbol', e.target.value)} required />

            <label htmlFor="direction">Direction</label>
            <select id="direction" value={fields.direction} onChange={(e) => set('direction', e.target.value)}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>

            {fields.type === 'option' && (
              <>
                <label htmlFor="optionType">Option Type</label>
                <select id="optionType" value={fields.optionType} onChange={(e) => set('optionType', e.target.value)}>
                  <option value="">Select…</option>
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>

                <label htmlFor="strike">Strike</label>
                <input id="strike" type="number" value={fields.strike} onChange={(e) => set('strike', e.target.value)} />

                <label htmlFor="expiry">Expiry</label>
                <input id="expiry" type="date" value={fields.expiry} onChange={(e) => set('expiry', e.target.value)} />
              </>
            )}

            <label htmlFor="quantity">Quantity</label>
            <input id="quantity" type="number" value={fields.quantity} onChange={(e) => set('quantity', e.target.value)} required />

            <label htmlFor="entryPrice">Entry Price</label>
            <input id="entryPrice" type="number" step="0.01" value={fields.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} required />

            <label htmlFor="entryDate">Entry Date</label>
            <input id="entryDate" type="date" value={fields.entryDate} onChange={(e) => set('entryDate', e.target.value)} required />

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- AddTradeModal`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AddTradeModal.jsx src/components/AddTradeModal.test.jsx
git commit -m "feat: implement Add Trade modal with option/futures toggle"
```

---

## Task 12: Trade Detail / Close modal

**Files:**
- Modify: `src/components/TradeDetailModal.jsx` (replacing the Task 10 stub)
- Test: `src/components/TradeDetailModal.test.jsx`

**Interfaces:**
- Consumes: a `trade` prop (shape from `fromRow`, Task 3).
- Produces: `<TradeDetailModal trade={trade} onClose={fn} onUpdate={fn(patch)} onCloseTrade={fn({exitPrice, exitDate})} onDelete={fn} />`. Consumed by `HomePage` (Task 10, already wired).

- [ ] **Step 1: Write the failing tests**

`src/components/TradeDetailModal.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TradeDetailModal from './TradeDetailModal'

const trade = {
  id: 't1', type: 'futures', symbol: 'ES', direction: 'long', quantity: 1,
  entryPrice: 4500, entryDate: '2026-01-01', exitPrice: '', exitDate: '',
  fees: '', notes: '', chartLink: '', status: 'open',
  optionType: '', strike: '', expiry: '',
}

describe('TradeDetailModal', () => {
  it('shows the trade fields', () => {
    render(<TradeDetailModal trade={trade} onClose={vi.fn()} onUpdate={vi.fn()} onCloseTrade={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByDisplayValue('ES')).toBeInTheDocument()
  })

  it('calls onCloseTrade with exit price and date when closing', async () => {
    const onCloseTrade = vi.fn()
    render(<TradeDetailModal trade={trade} onClose={vi.fn()} onUpdate={vi.fn()} onCloseTrade={onCloseTrade} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /close trade/i }))
    await userEvent.type(screen.getByLabelText(/exit price/i), '4600')
    await userEvent.type(screen.getByLabelText(/exit date/i), '2026-01-05')
    await userEvent.click(screen.getByRole('button', { name: /confirm close/i }))

    expect(onCloseTrade).toHaveBeenCalledWith({ exitPrice: '4600', exitDate: '2026-01-05' })
  })

  it('calls onUpdate with edited fields when saving', async () => {
    const onUpdate = vi.fn()
    render(<TradeDetailModal trade={trade} onClose={vi.fn()} onUpdate={onUpdate} onCloseTrade={vi.fn()} onDelete={vi.fn()} />)

    const notes = screen.getByLabelText(/notes/i)
    await userEvent.type(notes, 'good setup')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ notes: 'good setup' }))
  })

  it('calls onDelete when delete is clicked', async () => {
    const onDelete = vi.fn()
    render(<TradeDetailModal trade={trade} onClose={vi.fn()} onUpdate={vi.fn()} onCloseTrade={vi.fn()} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalled()
  })

  it('shows an inline error and keeps the form open when onUpdate rejects', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('update failed'))
    render(<TradeDetailModal trade={trade} onClose={vi.fn()} onUpdate={onUpdate} onCloseTrade={vi.fn()} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/update failed/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('ES')).toBeInTheDocument()
  })

  it('shows an inline error when onCloseTrade rejects', async () => {
    const onCloseTrade = vi.fn().mockRejectedValue(new Error('close failed'))
    render(<TradeDetailModal trade={trade} onClose={vi.fn()} onUpdate={vi.fn()} onCloseTrade={onCloseTrade} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /close trade/i }))
    await userEvent.type(screen.getByLabelText(/exit price/i), '4600')
    await userEvent.type(screen.getByLabelText(/exit date/i), '2026-01-05')
    await userEvent.click(screen.getByRole('button', { name: /confirm close/i }))

    expect(await screen.findByText(/close failed/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- TradeDetailModal`
Expected: FAIL — stub returns `null`.

- [ ] **Step 3: Implement the component**

`src/components/TradeDetailModal.jsx`:
```jsx
import { useState } from 'react'

export default function TradeDetailModal({ trade, onClose, onUpdate, onCloseTrade, onDelete }) {
  const [fields, setFields] = useState(trade)
  const [closing, setClosing] = useState(false)
  const [exitPrice, setExitPrice] = useState('')
  const [exitDate, setExitDate] = useState('')
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
      await onCloseTrade({ exitPrice, exitDate })
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
    <div className="modal-backdrop" role="dialog" aria-label="Trade Detail">
      <div className="modal">
        <form onSubmit={handleSave}>
          <label htmlFor="detail-symbol">Symbol</label>
          <input id="detail-symbol" value={fields.symbol} onChange={(e) => set('symbol', e.target.value)} />

          {fields.type === 'option' && (
            <>
              <label htmlFor="detail-strike">Strike</label>
              <input id="detail-strike" value={fields.strike} onChange={(e) => set('strike', e.target.value)} />

              <label htmlFor="detail-expiry">Expiry</label>
              <input id="detail-expiry" value={fields.expiry} onChange={(e) => set('expiry', e.target.value)} />
            </>
          )}

          <label htmlFor="detail-quantity">Quantity</label>
          <input id="detail-quantity" value={fields.quantity} onChange={(e) => set('quantity', e.target.value)} />

          <label htmlFor="detail-entryPrice">Entry Price</label>
          <input id="detail-entryPrice" value={fields.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} />

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
          <button type="button" onClick={() => setClosing(true)}>Close Trade</button>
        ) : (
          <form onSubmit={handleConfirmClose}>
            <label htmlFor="exitPrice">Exit Price</label>
            <input id="exitPrice" type="number" step="0.01" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} required />

            <label htmlFor="exitDate">Exit Date</label>
            <input id="exitDate" type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} required />

            <button type="submit">Confirm Close</button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- TradeDetailModal`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TradeDetailModal.jsx src/components/TradeDetailModal.test.jsx
git commit -m "feat: implement Trade Detail modal with close/edit/delete"
```

---

## Task 13: Placeholder pages (Stats, Analyze, Matt Cap)

**Files:**
- Modify: `src/pages/PlaceholderPage.jsx` (replacing the Task 7 stub)
- Test: `src/pages/PlaceholderPage.test.jsx`

**Interfaces:**
- Consumes: a `title` prop.
- Produces: the placeholder screen used by the `/stats`, `/analyze`, `/matt-cap` routes registered in `App.jsx` (Task 7, already wired).

- [ ] **Step 1: Write the failing test**

`src/pages/PlaceholderPage.test.jsx`:
```js
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PlaceholderPage from './PlaceholderPage'

describe('PlaceholderPage', () => {
  it('shows the given title and a coming soon message', () => {
    render(<MemoryRouter><PlaceholderPage title="Stats" /></MemoryRouter>)
    expect(screen.getByText('Stats')).toBeInTheDocument()
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  it('links back to Home', () => {
    render(<MemoryRouter><PlaceholderPage title="Analyze" /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PlaceholderPage`
Expected: FAIL — current stub has no "Home" link.

- [ ] **Step 3: Implement the component**

`src/pages/PlaceholderPage.jsx`:
```jsx
import { Link } from 'react-router-dom'

export default function PlaceholderPage({ title }) {
  return (
    <div className="placeholder-page">
      <Link to="/">← Home</Link>
      <h1>{title}</h1>
      <p>Coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PlaceholderPage`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/PlaceholderPage.jsx src/pages/PlaceholderPage.test.jsx
git commit -m "feat: implement placeholder pages for Stats, Analyze, Matt Cap"
```

---

## Task 14: Full test suite pass and manual smoke test

**Files:** none (verification-only task).

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all tests across all files pass.

- [ ] **Step 2: Manual smoke test against the live Supabase project**

With a real `.env` populated (per Task 2, Step 2), run `npm run dev` and manually walk through the design spec's test checklist:
1. Sign up / sign in.
2. First-login auto-creates "Main Account"; confirm it appears as the title.
3. Create a second account, switch between them, confirm trade lists filter correctly per account.
4. Add an option trade — confirm option-only fields appear and save correctly.
5. Add a futures trade — confirm option-only fields are absent.
6. Click a row, edit a field, save — confirm it persists.
7. Close a trade — confirm it disappears from the open trades list.
8. Delete a trade — confirm removal.
9. Confirm Stats/Analyze/Matt Cap nav buttons route to placeholder pages.

- [ ] **Step 3: Fix any issues found, re-run affected unit tests, and commit fixes**

If manual testing surfaces a bug, fix it in the relevant file from Tasks 1–13, re-run that file's test suite, and commit with a `fix:` message describing the bug.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 complete — trades journal MVP"
```
