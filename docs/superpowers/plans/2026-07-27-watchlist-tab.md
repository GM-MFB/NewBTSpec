# Watchlist Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new top-level Watchlist tab — a social hub where any logged-in user adds stocks to a shared watchlist, sees everyone else's, and sees a "Most Watched" leaderboard ranking symbols by how many distinct people have them. Reuses the existing `fund_watchlist` table as-is; no schema changes.

**Architecture:** A pure `buildLeaderboard` function computes the ranking from raw entries. A small dedicated Finnhub caller (`fetchWatchlistQuote`) fetches price + day % change per unique symbol. `useWatchlist` handles load/add/remove against `fund_watchlist`, relying entirely on existing RLS for the "read everyone, write only your own" security model. `WatchlistPage` wires it all together as a new top-level page.

**Tech Stack:** React 19, Vitest + @testing-library/react, existing Finnhub integration (no new dependencies).

## Global Constraints

- No Supabase schema/RLS changes — `fund_watchlist` and its policies already exist exactly as needed.
- `rank` is always inserted as `0` — this phase's ranking is community popularity, not the per-row `rank` column.
- TDD throughout: failing test → implementation → passing test → commit.

---

### Task 1: `watchlistLeaderboard.js`

**Files:**
- Create: `src/lib/watchlistLeaderboard.js`
- Create: `src/lib/watchlistLeaderboard.test.js`

**Interfaces:**
- Produces: `buildLeaderboard(entries: Array<{ userId, displayName, symbol }>) -> Array<{ symbol, count, people: string[] }>`.
  Consumed by Task 5 (`WatchlistPage`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { buildLeaderboard } from './watchlistLeaderboard'

describe('buildLeaderboard', () => {
  it('groups entries by symbol and counts distinct users', () => {
    const entries = [
      { userId: 'u1', displayName: 'Alice', symbol: 'AAPL' },
      { userId: 'u2', displayName: 'Bob', symbol: 'AAPL' },
      { userId: 'u1', displayName: 'Alice', symbol: 'TSLA' },
    ]
    const result = buildLeaderboard(entries)
    expect(result[0]).toEqual({ symbol: 'AAPL', count: 2, people: ['Alice', 'Bob'] })
    expect(result[1]).toEqual({ symbol: 'TSLA', count: 1, people: ['Alice'] })
  })

  it('counts a user once per symbol even with duplicate rows', () => {
    const entries = [
      { userId: 'u1', displayName: 'Alice', symbol: 'AAPL' },
      { userId: 'u1', displayName: 'Alice', symbol: 'AAPL' },
    ]
    const result = buildLeaderboard(entries)
    expect(result).toEqual([{ symbol: 'AAPL', count: 1, people: ['Alice'] }])
  })

  it('sorts by count descending, then symbol alphabetically as a tiebreak', () => {
    const entries = [
      { userId: 'u1', displayName: 'Alice', symbol: 'TSLA' },
      { userId: 'u1', displayName: 'Alice', symbol: 'AAPL' },
      { userId: 'u2', displayName: 'Bob', symbol: 'MSFT' },
      { userId: 'u2', displayName: 'Bob', symbol: 'MSFT' },
    ]
    const result = buildLeaderboard(entries)
    expect(result.map((r) => r.symbol)).toEqual(['MSFT', 'AAPL', 'TSLA'])
  })

  it('returns an empty array for no entries', () => {
    expect(buildLeaderboard([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- watchlistLeaderboard`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement in `src/lib/watchlistLeaderboard.js`**

```js
export function buildLeaderboard(entries) {
  const bySymbol = new Map()

  for (const entry of entries) {
    if (!bySymbol.has(entry.symbol)) {
      bySymbol.set(entry.symbol, { symbol: entry.symbol, userIds: new Set(), people: [] })
    }
    const group = bySymbol.get(entry.symbol)
    if (!group.userIds.has(entry.userId)) {
      group.userIds.add(entry.userId)
      group.people.push(entry.displayName)
    }
  }

  return [...bySymbol.values()]
    .map((g) => ({ symbol: g.symbol, count: g.userIds.size, people: g.people }))
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- watchlistLeaderboard`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/watchlistLeaderboard.js src/lib/watchlistLeaderboard.test.js
git commit -m "feat: add buildLeaderboard to watchlistLeaderboard.js"
```

---

### Task 2: `fetchWatchlistQuote`

**Files:**
- Create: `src/lib/fetchWatchlistQuotes.js`
- Create: `src/lib/fetchWatchlistQuotes.test.js`

**Interfaces:**
- Produces: `fetchWatchlistQuote(symbol: string, apiKey: string) -> Promise<{ price: number, changePct: number }>`.
  Consumed by Task 5 (`WatchlistPage`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWatchlistQuote } from './fetchWatchlistQuotes'

describe('fetchWatchlistQuote', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('maps Finnhub c/dp to price/changePct', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ c: 150.25, d: 2.5, dp: 1.69, h: 152, l: 148, o: 149, pc: 147.75 }),
    })

    const result = await fetchWatchlistQuote('AAPL', 'key123')

    expect(result).toEqual({ price: 150.25, changePct: 1.69 })
  })

  it('throws when the Finnhub request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    await expect(fetchWatchlistQuote('AAPL', 'key123')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fetchWatchlistQuotes`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement in `src/lib/fetchWatchlistQuotes.js`**

```js
export async function fetchWatchlistQuote(symbol, apiKey) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Finnhub request failed for ${symbol}`)
  const data = await res.json()
  return { price: data.c, changePct: data.dp }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- fetchWatchlistQuotes`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchWatchlistQuotes.js src/lib/fetchWatchlistQuotes.test.js
git commit -m "feat: add fetchWatchlistQuote to fetchWatchlistQuotes.js"
```

---

### Task 3: `watchlistMappers.js`

**Files:**
- Create: `src/lib/watchlistMappers.js`
- Create: `src/lib/watchlistMappers.test.js`

**Interfaces:**
- Produces: `fromRow(row) -> { id, userId, displayName, symbol, note, createdAt }`,
  `toRow(entry) -> { user_id, display_name, symbol, note, rank }`. Consumed
  by Task 4 (`useWatchlist`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { fromRow, toRow } from './watchlistMappers'

describe('watchlistMappers', () => {
  it('fromRow maps snake_case DB columns to camelCase', () => {
    const row = {
      id: 'w1', user_id: 'u1', display_name: 'Alice', symbol: 'AAPL',
      rank: 0, note: 'strong earnings', created_at: '2026-01-01T00:00:00Z',
    }
    expect(fromRow(row)).toEqual({
      id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL',
      note: 'strong earnings', createdAt: '2026-01-01T00:00:00Z',
    })
  })

  it('toRow maps a new entry to snake_case columns with rank always 0', () => {
    expect(toRow({ userId: 'u1', displayName: 'Alice', symbol: 'aapl', note: 'watching' })).toEqual({
      user_id: 'u1', display_name: 'Alice', symbol: 'AAPL', note: 'watching', rank: 0,
    })
  })

  it('toRow defaults a blank note to null', () => {
    expect(toRow({ userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: '' })).toEqual({
      user_id: 'u1', display_name: 'Alice', symbol: 'AAPL', note: null, rank: 0,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- watchlistMappers`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement in `src/lib/watchlistMappers.js`**

```js
export function fromRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    symbol: row.symbol,
    note: row.note,
    createdAt: row.created_at,
  }
}

export function toRow(entry) {
  return {
    user_id: entry.userId,
    display_name: entry.displayName,
    symbol: entry.symbol.toUpperCase(),
    note: entry.note || null,
    rank: 0,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- watchlistMappers`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/watchlistMappers.js src/lib/watchlistMappers.test.js
git commit -m "feat: add watchlistMappers fromRow/toRow"
```

---

### Task 4: `useWatchlist` hook

**Files:**
- Create: `src/hooks/useWatchlist.js`
- Create: `src/hooks/useWatchlist.test.js`

**Interfaces:**
- Consumes: `fromRow`/`toRow` (Task 3).
- Produces: `useWatchlist(userId) -> { entries, loading, addEntry(symbol, note, displayName), removeEntry(id) }`.
  Consumed by Task 5 (`WatchlistPage`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useWatchlist } from './useWatchlist'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockFrom({ rows = [], inserted = null }) {
  return {
    select: () => ({
      order: () => Promise.resolve({ data: rows, error: null }),
    }),
    insert: () => ({
      select: () => ({ single: () => Promise.resolve({ data: inserted, error: null }) }),
    }),
    delete: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  }
}

describe('useWatchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads all entries, not filtered by user', async () => {
    const rows = [
      { id: 'w1', user_id: 'u1', display_name: 'Alice', symbol: 'AAPL', rank: 0, note: null, created_at: '2026-01-01' },
      { id: 'w2', user_id: 'u2', display_name: 'Bob', symbol: 'TSLA', rank: 0, note: null, created_at: '2026-01-02' },
    ]
    supabase.from.mockReturnValue(mockFrom({ rows }))

    const { result } = renderHook(() => useWatchlist('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.entries).toHaveLength(2)
    expect(result.current.entries[0].symbol).toBe('AAPL')
  })

  it('addEntry inserts and reloads', async () => {
    supabase.from.mockReturnValue(mockFrom({ rows: [], inserted: { id: 'w3', user_id: 'u1', display_name: 'Alice', symbol: 'MSFT', rank: 0, note: null, created_at: '2026-01-03' } }))

    const { result } = renderHook(() => useWatchlist('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.addEntry('msft', '', 'Alice')
    })

    expect(supabase.from).toHaveBeenCalledWith('fund_watchlist')
  })

  it('removeEntry deletes and reloads', async () => {
    const rows = [{ id: 'w1', user_id: 'u1', display_name: 'Alice', symbol: 'AAPL', rank: 0, note: null, created_at: '2026-01-01' }]
    supabase.from.mockReturnValue(mockFrom({ rows }))

    const { result } = renderHook(() => useWatchlist('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.removeEntry('w1')
    })

    expect(supabase.from).toHaveBeenCalledWith('fund_watchlist')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useWatchlist`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement in `src/hooks/useWatchlist.js`**

```js
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import { fromRow, toRow } from '../lib/watchlistMappers'

export function useWatchlist(userId) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('fund_watchlist')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setLoading(false)
      return
    }
    setEntries(data.map(fromRow))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addEntry(symbol, note, displayName) {
    const { error } = await supabase
      .from('fund_watchlist')
      .insert(toRow({ userId, displayName, symbol, note }))
      .select()
      .single()
    if (error) throw error
    await load()
  }

  async function removeEntry(id) {
    const { error } = await supabase.from('fund_watchlist').delete().eq('id', id)
    if (error) throw error
    await load()
  }

  return { entries, loading, addEntry, removeEntry }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useWatchlist`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useWatchlist.js src/hooks/useWatchlist.test.js
git commit -m "feat: add useWatchlist hook"
```

---

### Task 5: `WatchlistPage.jsx`

**Files:**
- Create: `src/pages/WatchlistPage.jsx`
- Create: `src/pages/WatchlistPage.css`
- Create: `src/pages/WatchlistPage.test.jsx`

**Interfaces:**
- Consumes: `useWatchlist` (Task 4), `buildLeaderboard` (Task 1),
  `fetchWatchlistQuote` (Task 2), `useAuth`, `useAccounts`,
  `useUserSettings` (all existing), `Header` (existing, already accepts
  `onSignOut`).

- [ ] **Step 1: Write the failing tests**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import WatchlistPage from './WatchlistPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useUserSettings } from '../hooks/useUserSettings'
import { useWatchlist } from '../hooks/useWatchlist'
import { fetchWatchlistQuote } from '../lib/fetchWatchlistQuotes'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useUserSettings')
vi.mock('../hooks/useWatchlist')
vi.mock('../lib/fetchWatchlistQuotes')

function mockCommon({ entries = [] } = {}) {
  useAuth.mockReturnValue({ user: { id: 'u1', email: 'alice@example.com' }, signOut: vi.fn() })
  useAccounts.mockReturnValue({
    accounts: [{ id: 'a1', name: 'Main Account' }],
    activeAccount: { id: 'a1', name: 'Main Account' },
    activeAccountId: 'a1',
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
  })
  useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', displayName: 'Alice', loading: false })
  useWatchlist.mockReturnValue({ entries, loading: false, addEntry: vi.fn(), removeEntry: vi.fn() })
  fetchWatchlistQuote.mockResolvedValue({ price: 150, changePct: 1.5 })
}

describe('WatchlistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the leaderboard sorted by most-watched first', async () => {
    mockCommon({
      entries: [
        { id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' },
        { id: 'w2', userId: 'u2', displayName: 'Bob', symbol: 'AAPL', note: null, createdAt: '2026-01-02' },
        { id: 'w3', userId: 'u1', displayName: 'Alice', symbol: 'TSLA', note: null, createdAt: '2026-01-03' },
      ],
    })
    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)

    const leaderboardRows = screen.getAllByTestId('leaderboard-row')
    expect(leaderboardRows[0]).toHaveTextContent('AAPL')
    expect(leaderboardRows[1]).toHaveTextContent('TSLA')
  })

  it('renders individual watchlists grouped by person', () => {
    mockCommon({
      entries: [
        { id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' },
        { id: 'w2', userId: 'u2', displayName: 'Bob', symbol: 'TSLA', note: null, createdAt: '2026-01-02' },
      ],
    })
    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('adds a new symbol via the form', async () => {
    const addEntry = vi.fn()
    mockCommon()
    useWatchlist.mockReturnValue({ entries: [], loading: false, addEntry, removeEntry: vi.fn() })

    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText(/symbol/i), 'nvda')
    await userEvent.click(screen.getByRole('button', { name: /add to watchlist/i }))

    expect(addEntry).toHaveBeenCalledWith('NVDA', '', 'Alice')
  })

  it('does not add a duplicate symbol the current user already has', async () => {
    const addEntry = vi.fn()
    mockCommon({ entries: [{ id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' }] })
    useWatchlist.mockReturnValue({
      entries: [{ id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' }],
      loading: false, addEntry, removeEntry: vi.fn(),
    })

    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText(/symbol/i), 'aapl')
    await userEvent.click(screen.getByRole('button', { name: /add to watchlist/i }))

    expect(addEntry).not.toHaveBeenCalled()
  })

  it('shows a delete button only on the current user\'s own entries', () => {
    mockCommon({
      entries: [
        { id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' },
        { id: 'w2', userId: 'u2', displayName: 'Bob', symbol: 'TSLA', note: null, createdAt: '2026-01-02' },
      ],
    })
    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)

    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(1)
  })

  it('shows live price and change % once fetched', async () => {
    mockCommon({
      entries: [{ id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' }],
    })
    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('$150.00')).toBeInTheDocument())
    expect(screen.getByText('+1.50%')).toBeInTheDocument()
  })

  it('shows placeholders instead of crashing when there is no Finnhub key', () => {
    mockCommon({
      entries: [{ id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' }],
    })
    useUserSettings.mockReturnValue({ finnhubKey: '', avKey: '', displayName: 'Alice', loading: false })

    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)

    expect(fetchWatchlistQuote).not.toHaveBeenCalled()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- WatchlistPage`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/pages/WatchlistPage.jsx`**

```jsx
import { useEffect, useState } from 'react'
import './WatchlistPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useUserSettings } from '../hooks/useUserSettings'
import { useWatchlist } from '../hooks/useWatchlist'
import { buildLeaderboard } from '../lib/watchlistLeaderboard'
import { fetchWatchlistQuote } from '../lib/fetchWatchlistQuotes'
import { formatCurrency } from '../lib/format'
import Header from '../components/Header'

export default function WatchlistPage() {
  const { user, signOut } = useAuth()
  const { accounts, activeAccount, switchAccount, createAccount } = useAccounts(user?.id)
  const { finnhubKey, displayName } = useUserSettings(user?.id)
  const { entries, addEntry, removeEntry } = useWatchlist(user?.id)
  const [symbolInput, setSymbolInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [quotes, setQuotes] = useState({})

  const leaderboard = buildLeaderboard(entries)
  const uniqueSymbols = [...new Set(entries.map((e) => e.symbol))]

  useEffect(() => {
    if (!finnhubKey) return
    for (const symbol of uniqueSymbols) {
      if (quotes[symbol]) continue
      fetchWatchlistQuote(symbol, finnhubKey)
        .then((q) => setQuotes((prev) => ({ ...prev, [symbol]: q })))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finnhubKey, uniqueSymbols.join(',')])

  const myEntry = (symbol) => entries.find((e) => e.userId === user?.id && e.symbol === symbol)

  async function handleAdd(e) {
    e.preventDefault()
    const symbol = symbolInput.trim().toUpperCase()
    if (!symbol) return
    if (myEntry(symbol)) return
    await addEntry(symbol, noteInput.trim(), displayName || user?.email || '')
    setSymbolInput('')
    setNoteInput('')
  }

  function renderQuote(symbol) {
    const q = quotes[symbol]
    if (!finnhubKey || !q) return <span className="watchlist-quote-empty">—</span>
    const sign = q.changePct >= 0 ? '+' : ''
    const cls = q.changePct >= 0 ? 'watchlist-change-up' : 'watchlist-change-down'
    return (
      <span className="watchlist-quote">
        <span className="mono">{formatCurrency(q.price)}</span>
        <span className={`mono ${cls}`}>{sign}{q.changePct.toFixed(2)}%</span>
      </span>
    )
  }

  const byPerson = new Map()
  for (const entry of entries) {
    if (!byPerson.has(entry.userId)) byPerson.set(entry.userId, { displayName: entry.displayName, items: [] })
    byPerson.get(entry.userId).items.push(entry)
  }

  return (
    <div data-testid="watchlist-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        onSignOut={signOut}
        showAddButton={false}
      />

      <div className="watchlist-page">
        <form className="watchlist-add-form" onSubmit={handleAdd}>
          <label htmlFor="watchlistSymbol">Symbol</label>
          <input id="watchlistSymbol" value={symbolInput} onChange={(e) => setSymbolInput(e.target.value)} />
          <label htmlFor="watchlistNote">Note (optional)</label>
          <input id="watchlistNote" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
          <button type="submit">Add to Watchlist</button>
        </form>

        <section className="watchlist-leaderboard">
          <h2>Most Watched</h2>
          <ol>
            {leaderboard.map((row, i) => (
              <li key={row.symbol} data-testid="leaderboard-row">
                <span className="watchlist-rank">#{i + 1}</span>
                <span className="watchlist-symbol">{row.symbol}</span>
                {renderQuote(row.symbol)}
                <span className="watchlist-count">{row.count} {row.count === 1 ? 'person' : 'people'} — {row.people.join(', ')}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="watchlist-by-person">
          <h2>Individual Watchlists</h2>
          {[...byPerson.entries()].map(([userId, group]) => (
            <div key={userId} className="watchlist-person-group">
              <h3>{group.displayName}</h3>
              <ul>
                {group.items.map((entry) => (
                  <li key={entry.id}>
                    <span className="watchlist-symbol">{entry.symbol}</span>
                    {renderQuote(entry.symbol)}
                    {entry.note && <span className="watchlist-note">{entry.note}</span>}
                    {entry.userId === user?.id && (
                      <button type="button" aria-label={`Remove ${entry.symbol}`} onClick={() => removeEntry(entry.id)}>
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add `src/pages/WatchlistPage.css`**

```css
.watchlist-page {
  padding: 20px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.watchlist-add-form {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.watchlist-add-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

.watchlist-add-form input {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 8px;
  font-size: 13px;
}

.watchlist-leaderboard h2, .watchlist-by-person h2 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.watchlist-leaderboard ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.watchlist-leaderboard li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.watchlist-rank {
  color: var(--text-dim);
  font-weight: 700;
  width: 28px;
}

.watchlist-symbol {
  font-weight: 700;
  color: var(--text);
  min-width: 60px;
}

.watchlist-quote {
  display: flex;
  gap: 8px;
  min-width: 120px;
}

.watchlist-change-up { color: var(--green); }
.watchlist-change-down { color: var(--red); }
.watchlist-quote-empty { color: var(--text-dim); min-width: 120px; }

.watchlist-count {
  color: var(--text-dim);
  font-size: 12px;
}

.watchlist-person-group {
  margin-bottom: 20px;
}

.watchlist-person-group h3 {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 8px;
}

.watchlist-person-group ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.watchlist-person-group li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}

.watchlist-note {
  color: var(--text-dim);
  font-size: 12px;
  flex: 1;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- WatchlistPage`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/pages/WatchlistPage.jsx src/pages/WatchlistPage.css src/pages/WatchlistPage.test.jsx
git commit -m "feat: implement WatchlistPage with leaderboard and individual lists"
```

---

### Task 6: Nav + route wiring

**Files:**
- Modify: `src/components/Header.jsx`
- Modify: `src/components/Header.test.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Write the failing test**

Add to `Header.test.jsx`:

```jsx
it('renders a Watchlist nav link', () => {
  setup()
  expect(screen.getByRole('link', { name: /watchlist/i })).toHaveAttribute('href', '/watchlist')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Header`
Expected: FAIL — no Watchlist link exists yet.

- [ ] **Step 3: Add the nav link in `src/components/Header.jsx`**

```jsx
<NavLink
    to="/watchlist"
    className={({ isActive }) =>
        isActive ? "active" : undefined
    }
>
    Watchlist
</NavLink>
```

Place it after the "Analyze" `NavLink`, before the closing `</nav>`.

- [ ] **Step 4: Wire the route in `src/App.jsx`**

```jsx
import WatchlistPage from "./pages/WatchlistPage";
```

```jsx
<Route
    path="/watchlist"
    element={
        <RequireAuth user={user}>
            <WatchlistPage />
        </RequireAuth>
    }
/>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- Header`
Expected: PASS (all existing tests plus the new one).

- [ ] **Step 6: Commit**

```bash
git add src/components/Header.jsx src/components/Header.test.jsx src/App.jsx
git commit -m "feat: wire Watchlist nav link and route"
```

---

### Task 7: Full suite + `netlify dev` smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (463 existing + new tests from this plan).

- [ ] **Step 2: Restart `netlify dev`, manual smoke test**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

Log in, go to `/watchlist`: add a symbol, confirm it appears in both the
leaderboard and your individual list with a live price once a Finnhub
key is set; log in as a second test user, add the same symbol, confirm
the leaderboard count goes to 2 and both names show; confirm you can
only delete your own entries, not the other user's.

- [ ] **Step 3: Report completion**

No commit needed for this task unless smoke testing surfaces a bug — fix
as a new small commit and re-run Step 1.
