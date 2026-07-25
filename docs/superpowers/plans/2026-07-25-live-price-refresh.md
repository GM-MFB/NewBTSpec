# Live Price Refresh + Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user save a Finnhub API key and manually refresh current prices for all open investment positions, per `docs/superpowers/specs/2026-07-25-live-price-refresh-design.md`.

**Architecture:** A new `useUserSettings` hook mirrors `user_settings.finnhub_key` to `localStorage['bt_finnhub_key']`. A pure `fetchQuote` helper wraps the Finnhub REST call. `InvestmentsPage` drives the refresh loop, calling the existing (now-fixed) `updateInvestment` per matching investment. `Header` gains an optional Refresh button and a settings icon link, used only by `InvestmentsPage`.

**Tech Stack:** Same as the rest of the app — Vite, React, react-router-dom, @supabase/supabase-js, Vitest, @testing-library/react.

## Global Constraints

- Do not change any existing table/column names — `user_settings.finnhub_key` already exists.
- Mirror the key to `localStorage['bt_finnhub_key']` per `database-reference.md`'s convention.
- No caching layer for quotes (Finnhub's free tier rate limit is not a concern here, unlike Alpha Vantage).
- `updateInvestment` must always be called through the already-fixed merge-with-current-record path in `useInvestments.js` — never re-introduce a raw `toRow(patch)` call.

---

## Task 1: `useUserSettings` hook (TDD)

**Files:**
- Create: `src/hooks/useUserSettings.js`
- Test: `src/hooks/useUserSettings.test.js`

**Interfaces:**
- Consumes: `supabase` (`src/utils/supabase.js`); a `userId` string.
- Produces: `useUserSettings(userId) -> { finnhubKey, loading, error, saveFinnhubKey(key) }`. Consumed by `SettingsPage` (Task 3) and `InvestmentsPage` (Task 5).

- [ ] **Step 1: Write the failing tests**

`src/hooks/useUserSettings.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useUserSettings } from './useUserSettings'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

describe('useUserSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('loads the finnhub key from user_settings and mirrors it to localStorage', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { finnhub_key: 'abc123' }, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    const { result } = renderHook(() => useUserSettings('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.finnhubKey).toBe('abc123')
    expect(localStorage.getItem('bt_finnhub_key')).toBe('abc123')
  })

  it('falls back to localStorage when there is no user_settings row yet', async () => {
    localStorage.setItem('bt_finnhub_key', 'from-storage')
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    const { result } = renderHook(() => useUserSettings('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.finnhubKey).toBe('from-storage')
  })

  it('saveFinnhubKey upserts user_settings and updates localStorage', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    const upsert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ select, upsert })

    const { result } = renderHook(() => useUserSettings('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.saveFinnhubKey('new-key')
    })

    expect(upsert).toHaveBeenCalledWith({ user_id: 'u1', finnhub_key: 'new-key' }, { onConflict: 'user_id' })
    expect(result.current.finnhubKey).toBe('new-key')
    expect(localStorage.getItem('bt_finnhub_key')).toBe('new-key')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useUserSettings`
Expected: FAIL — `useUserSettings.js` does not exist.

- [ ] **Step 3: Implement the hook**

`src/hooks/useUserSettings.js`:
```js
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase'

const STORAGE_KEY = 'bt_finnhub_key'

export function useUserSettings(userId) {
  const [finnhubKey, setFinnhubKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('user_settings')
      .select('finnhub_key')
      .eq('user_id', userId)
      .maybeSingle()

    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    if (data?.finnhub_key) {
      setFinnhubKey(data.finnhub_key)
      localStorage.setItem(STORAGE_KEY, data.finnhub_key)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  async function saveFinnhubKey(key) {
    const { error: err } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, finnhub_key: key }, { onConflict: 'user_id' })
    if (err) throw err
    setFinnhubKey(key)
    localStorage.setItem(STORAGE_KEY, key)
  }

  return { finnhubKey, loading, error, saveFinnhubKey }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useUserSettings`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useUserSettings.js src/hooks/useUserSettings.test.js
git commit -m "feat: add useUserSettings hook for the Finnhub API key"
```

---

## Task 2: Finnhub quote fetch helper (TDD)

**Files:**
- Create: `src/lib/finnhub.js`
- Test: `src/lib/finnhub.test.js`

**Interfaces:**
- Produces: `fetchQuote(symbol, apiKey) -> Promise<number>` (the current price), throwing on a non-OK response or a missing price in the payload. Consumed by `InvestmentsPage` (Task 5).

- [ ] **Step 1: Write the failing tests**

`src/lib/finnhub.test.js`:
```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchQuote } from './finnhub'

describe('fetchQuote', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the current price from a successful quote response', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ c: 165.2 }) })

    const price = await fetchQuote('AAPL', 'key123')

    expect(price).toBe(165.2)
    expect(global.fetch).toHaveBeenCalledWith('https://finnhub.io/api/v1/quote?symbol=AAPL&token=key123')
  })

  it('throws when the response is not ok', async () => {
    global.fetch.mockResolvedValue({ ok: false })
    await expect(fetchQuote('AAPL', 'key123')).rejects.toThrow(/AAPL/)
  })

  it('throws when the payload has no price', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await expect(fetchQuote('AAPL', 'key123')).rejects.toThrow(/AAPL/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- finnhub.test`
Expected: FAIL — `finnhub.js` does not exist.

- [ ] **Step 3: Implement the helper**

`src/lib/finnhub.js`:
```js
export async function fetchQuote(symbol, apiKey) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Finnhub request failed for ${symbol}`)
  const data = await res.json()
  if (data.c === undefined || data.c === null) throw new Error(`No quote returned for ${symbol}`)
  return data.c
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- finnhub.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finnhub.js src/lib/finnhub.test.js
git commit -m "feat: add Finnhub quote fetch helper"
```

---

## Task 3: `SettingsPage`

**Files:**
- Create: `src/pages/SettingsPage.jsx`
- Create: `src/pages/SettingsPage.css`
- Test: `src/pages/SettingsPage.test.jsx`

**Interfaces:**
- Consumes: `useAuth` (Task 4 of Phase 1), `useUserSettings` (Task 1).
- Produces: the screen wired to `/settings` in Task 6. `data-testid="settings-page"`.

- [ ] **Step 1: Write the failing tests**

`src/pages/SettingsPage.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'
import { useAuth } from '../hooks/useAuth'
import { useUserSettings } from '../hooks/useUserSettings'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useUserSettings')

describe('SettingsPage', () => {
  it('shows the current Finnhub key once loaded', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    useUserSettings.mockReturnValue({ finnhubKey: 'abc123', loading: false, saveFinnhubKey: vi.fn() })

    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByLabelText(/finnhub api key/i)).toHaveValue('abc123'))
  })

  it('calls saveFinnhubKey with the entered value on submit', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    const saveFinnhubKey = vi.fn().mockResolvedValue(undefined)
    useUserSettings.mockReturnValue({ finnhubKey: '', loading: false, saveFinnhubKey })

    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    await userEvent.type(screen.getByLabelText(/finnhub api key/i), 'new-key')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(saveFinnhubKey).toHaveBeenCalledWith('new-key')
    expect(await screen.findByText(/saved/i)).toBeInTheDocument()
  })

  it('shows an inline error when saveFinnhubKey rejects', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    const saveFinnhubKey = vi.fn().mockRejectedValue(new Error('save failed'))
    useUserSettings.mockReturnValue({ finnhubKey: '', loading: false, saveFinnhubKey })

    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    await userEvent.type(screen.getByLabelText(/finnhub api key/i), 'new-key')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText(/save failed/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- SettingsPage`
Expected: FAIL — `SettingsPage.jsx` does not exist.

- [ ] **Step 3: Implement the page**

`src/pages/SettingsPage.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './SettingsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useUserSettings } from '../hooks/useUserSettings'

export default function SettingsPage() {
  const { user } = useAuth()
  const { finnhubKey, loading, saveFinnhubKey } = useUserSettings(user?.id)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!loading) setValue(finnhubKey)
  }, [loading, finnhubKey])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setStatus(null)
    try {
      await saveFinnhubKey(value)
      setStatus('Saved.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div data-testid="settings-page" className="settings-page">
      <Link to="/">← Home</Link>
      <h1>Settings</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="finnhubKey">Finnhub API Key</label>
        <input id="finnhubKey" type="password" value={value} onChange={(e) => setValue(e.target.value)} />

        {error && <p role="alert">{error}</p>}
        {status && <p>{status}</p>}

        <button type="submit">Save</button>
      </form>
    </div>
  )
}
```

`src/pages/SettingsPage.css`:
```css
.settings-page {
  max-width: 420px;
  margin: 0 auto;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-page form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-page label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.settings-page input {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 9px 10px;
  font-size: 14px;
}

.settings-page button {
  background: var(--green);
  border: none;
  color: #062611;
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
}

.settings-page [role="alert"] {
  color: var(--red);
  font-size: 13px;
  margin: 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- SettingsPage`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.jsx src/pages/SettingsPage.css src/pages/SettingsPage.test.jsx
git commit -m "feat: implement SettingsPage for the Finnhub API key"
```

---

## Task 4: `Header` gains an optional Refresh button and a Settings link

**Files:**
- Modify: `src/components/Header.jsx`
- Modify: `src/components/Header.css`
- Modify: `src/components/Header.test.jsx`

**Interfaces:**
- Produces: `Header` accepts optional `onRefresh` and `refreshing` props. When `onRefresh` is provided, a "↻ Refresh" button renders (disabled + "Refreshing…" text while `refreshing` is true). A settings icon link to `/settings` always renders. `TradesPage` (unchanged, no `onRefresh` passed) never shows the Refresh button.

- [ ] **Step 1: Update the failing/changed tests**

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

  it('always renders a link to Settings', () => {
    setup()
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings')
  })

  it('does not render a Refresh button when onRefresh is not provided', () => {
    setup()
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument()
  })

  it('renders and calls onRefresh when provided', async () => {
    const onRefresh = vi.fn()
    setup({ onRefresh })
    await userEvent.click(screen.getByRole('button', { name: /^↻ refresh$/i }))
    expect(onRefresh).toHaveBeenCalled()
  })

  it('disables the Refresh button and shows Refreshing… while refreshing', () => {
    setup({ onRefresh: vi.fn(), refreshing: true })
    expect(screen.getByRole('button', { name: /refreshing/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run tests to verify the new/changed ones fail**

Run: `npm test -- Header.test`
Expected: FAIL — no Settings link, no Refresh button support yet.

- [ ] **Step 3: Update the component**

`src/components/Header.jsx`:
```jsx
import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import './Header.css'

export default function Header({
  accounts, activeAccount, switchAccount, createAccount, onAddTrade,
  addLabel = '+ Add Trade', onRefresh, refreshing = false,
}) {
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

      <div className="header-actions">
        {onRefresh && (
          <button type="button" className="refresh-btn" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
        )}
        <button type="button" className="add-trade-btn" onClick={onAddTrade}>
          {addLabel}
        </button>
        <Link to="/settings" className="settings-link" aria-label="Settings">⚙</Link>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Update `Header.css`**

Add to `src/components/Header.css`:
```css
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.refresh-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.refresh-btn:hover:not(:disabled) {
  border-color: var(--green);
  color: var(--green);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.settings-link {
  color: var(--text-dim);
  text-decoration: none;
  font-size: 18px;
  line-height: 1;
  padding: 6px;
}

.settings-link:hover {
  color: var(--text);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- Header.test`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/Header.jsx src/components/Header.css src/components/Header.test.jsx
git commit -m "feat: add optional Refresh button and Settings link to Header"
```

---

## Task 5: Wire the refresh flow into `InvestmentsPage`

**Files:**
- Modify: `src/pages/InvestmentsPage.jsx`
- Modify: `src/pages/InvestmentsPage.test.jsx`

**Interfaces:**
- Consumes: `useUserSettings` (Task 1), `fetchQuote` (Task 2), `updateInvestment` (existing, now fixed).
- Produces: clicking "Refresh" in the Header (Task 4) updates `currentPrice` for every open investment matching a fetched symbol.

- [ ] **Step 1: Write the failing tests**

Add to `src/pages/InvestmentsPage.test.jsx` (add these imports/mocks alongside the existing ones at the top of the file):
```js
import { useUserSettings } from '../hooks/useUserSettings'
import { fetchQuote } from '../lib/finnhub'

vi.mock('../hooks/useUserSettings')
vi.mock('../lib/finnhub')
```

Add these test cases inside the existing `describe('InvestmentsPage', ...)` block:
```js
  it('shows a missing-key message and does not fetch when Refresh is clicked with no key', async () => {
    mockAccounts()
    useUserSettings.mockReturnValue({ finnhubKey: '', loading: false, saveFinnhubKey: vi.fn() })
    useInvestments.mockReturnValue({
      investments: [{ id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' }],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn(),
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^↻ refresh$/i }))

    expect(screen.getByText(/add your finnhub api key/i)).toBeInTheDocument()
    expect(fetchQuote).not.toHaveBeenCalled()
  })

  it('fetches a quote per unique symbol and updates every matching investment', async () => {
    mockAccounts()
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', loading: false, saveFinnhubKey: vi.fn() })
    const updateInvestment = vi.fn().mockResolvedValue(undefined)
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' },
        { id: 'i2', symbol: 'AAPL', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'covered_call', strike: 200, expiry: '2026-03-01' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment, deleteInvestment: vi.fn(),
    })
    fetchQuote.mockResolvedValue(165.2)

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^↻ refresh$/i }))

    await waitFor(() => expect(updateInvestment).toHaveBeenCalledTimes(2))
    expect(fetchQuote).toHaveBeenCalledWith('AAPL', 'key123')
    expect(updateInvestment).toHaveBeenCalledWith('i1', { currentPrice: 165.2 })
    expect(updateInvestment).toHaveBeenCalledWith('i2', { currentPrice: 165.2 })
  })

  it('shows which symbols failed to refresh without blocking the others', async () => {
    mockAccounts()
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', loading: false, saveFinnhubKey: vi.fn() })
    const updateInvestment = vi.fn().mockResolvedValue(undefined)
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' },
        { id: 'i2', symbol: 'MSFT', assetType: 'Stock', shares: 5, avgCost: 300, strategy: '', strike: '', expiry: '' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment, deleteInvestment: vi.fn(),
    })
    fetchQuote.mockImplementation((symbol) => (symbol === 'AAPL' ? Promise.resolve(165.2) : Promise.reject(new Error('fail'))))

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^↻ refresh$/i }))

    await waitFor(() => expect(screen.getByText(/couldn.t refresh msft/i)).toBeInTheDocument())
    expect(updateInvestment).toHaveBeenCalledWith('i1', { currentPrice: 165.2 })
  })
```

Also add default `useUserSettings.mockReturnValue({ finnhubKey: 'key123', loading: false, saveFinnhubKey: vi.fn() })` inside `mockAccounts()` so the plan's earlier tests (which don't click Refresh) keep passing without needing a per-test mock — update `mockAccounts` to:
```js
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
  useUserSettings.mockReturnValue({ finnhubKey: 'key123', loading: false, saveFinnhubKey: vi.fn() })
}
```
(the two new tests above that need a specific `finnhubKey` value call `useUserSettings.mockReturnValue` again *after* `mockAccounts()`, which overrides this default — that's fine since Vitest mocks return the most recent `mockReturnValue`).

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- InvestmentsPage`
Expected: FAIL — no Refresh button/handler exists yet on the page.

- [ ] **Step 3: Update `InvestmentsPage.jsx`**

```jsx
import { useState } from 'react'
import './InvestmentsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'
import { useUserSettings } from '../hooks/useUserSettings'
import { STRATEGIES } from '../lib/optionStrategies'
import { coveredSharesFor } from '../lib/coverage'
import { computeSummary } from '../lib/portfolioSummary'
import { formatCurrency } from '../lib/format'
import { fetchQuote } from '../lib/finnhub'
import Header from '../components/Header'
import InvestmentRow from '../components/InvestmentRow'
import AddInvestmentModal from '../components/AddInvestmentModal'
import ClosePositionModal from '../components/ClosePositionModal'

export default function InvestmentsPage() {
  const { user } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount } = useAccounts(user?.id)
  const { investments, error, reload, addInvestment, closeInvestment, updateInvestment, deleteInvestment } = useInvestments(activeAccountId)
  const { finnhubKey } = useUserSettings(user?.id)
  const [addOpen, setAddOpen] = useState(false)
  const [closingId, setClosingId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [missingKey, setMissingKey] = useState(false)
  const [refreshFailedSymbols, setRefreshFailedSymbols] = useState([])

  const stockInvestments = investments.filter((i) => i.assetType === 'Stock')
  const strategyGroups = STRATEGIES
    .map((s) => ({ ...s, items: investments.filter((i) => i.assetType === 'Option' && i.strategy === s.value) }))
    .filter((g) => g.items.length > 0)
  const categorizedIds = new Set([
    ...stockInvestments.map((i) => i.id),
    ...strategyGroups.flatMap((g) => g.items.map((i) => i.id)),
  ])
  const otherInvestments = investments.filter((i) => !categorizedIds.has(i.id))
  const summary = computeSummary(investments)

  async function handleRefresh() {
    if (!finnhubKey) {
      setMissingKey(true)
      return
    }
    setMissingKey(false)
    setRefreshFailedSymbols([])
    setRefreshing(true)

    const symbols = [...new Set(investments.map((i) => i.symbol).filter(Boolean))]
    const failed = []
    for (const symbol of symbols) {
      try {
        const price = await fetchQuote(symbol, finnhubKey)
        const matches = investments.filter((i) => i.symbol === symbol)
        for (const match of matches) {
          await updateInvestment(match.id, { currentPrice: price })
        }
      } catch {
        failed.push(symbol)
      }
    }

    setRefreshFailedSymbols(failed)
    setRefreshing(false)
  }

  return (
    <div data-testid="investments-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        onAddTrade={() => setAddOpen(true)}
        addLabel="+ Add Investment"
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {error && (
        <div className="error-banner">
          <span>Couldn't load investments.</span>
          <button type="button" onClick={reload}>Retry</button>
        </div>
      )}

      {missingKey && (
        <div className="error-banner">
          <span>Add your Finnhub API key in Settings to enable price refresh.</span>
          <Link to="/settings">Go to Settings</Link>
        </div>
      )}

      {refreshFailedSymbols.length > 0 && (
        <div className="error-banner">
          <span>Couldn't refresh {refreshFailedSymbols.join(', ')}</span>
        </div>
      )}

      {investments.length > 0 && (
        <div className="portfolio-summary">
          <div className="summary-stat">
            <span className="summary-label">Total Collateral Deployed</span>
            <span className="summary-value mono">{formatCurrency(summary.totalCollateral)}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-label">Potential Options Premium</span>
            <span className="summary-value mono">{formatCurrency(summary.potentialPremium)}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-label">Unrealized Stock P&L</span>
            <span className={`summary-value mono ${summary.unrealizedStockPnl < 0 ? 'summary-value--negative' : 'summary-value--positive'}`}>
              {formatCurrency(summary.unrealizedStockPnl)}
            </span>
          </div>
        </div>
      )}

      {investments.length === 0 ? (
        <p className="empty-state">No open investments — add one to get started</p>
      ) : (
        <div className="investment-groups">
          {stockInvestments.length > 0 && (
            <section className="investment-group">
              <h2 className="group-title">Stock</h2>
              <ul className="investment-list">
                {stockInvestments.map((investment) => (
                  <InvestmentRow
                    key={investment.id}
                    investment={investment}
                    onClosePosition={setClosingId}
                    onDelete={deleteInvestment}
                    coveredShares={coveredSharesFor(investment, investments)}
                  />
                ))}
              </ul>
            </section>
          )}

          {strategyGroups.length > 0 && (
            <section className="investment-group">
              <h2 className="group-title">Option</h2>
              {strategyGroups.map((group) => (
                <div key={group.value} className="strategy-group">
                  <h3 className="strategy-title">{group.label}</h3>
                  <ul className="investment-list">
                    {group.items.map((investment) => (
                      <InvestmentRow
                        key={investment.id}
                        investment={investment}
                        onClosePosition={setClosingId}
                        onDelete={deleteInvestment}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {otherInvestments.length > 0 && (
            <section className="investment-group">
              <h2 className="group-title">Other</h2>
              <ul className="investment-list">
                {otherInvestments.map((investment) => (
                  <InvestmentRow key={investment.id} investment={investment} onClosePosition={setClosingId} onDelete={deleteInvestment} />
                ))}
              </ul>
            </section>
          )}
        </div>
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

      {closingId && (
        <ClosePositionModal
          onClose={() => setClosingId(null)}
          onConfirm={async (closeFields) => {
            await closeInvestment(closingId, closeFields)
            setClosingId(null)
          }}
        />
      )}
    </div>
  )
}
```

**Note:** this adds a `<Link to="/settings">` for the missing-key banner — add `import { Link } from 'react-router-dom'` alongside the other imports at the top of the file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- InvestmentsPage`
Expected: PASS (all tests, including the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/pages/InvestmentsPage.jsx src/pages/InvestmentsPage.test.jsx
git commit -m "feat: wire live price refresh into InvestmentsPage"
```

---

## Task 6: Wire the `/settings` route

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

**Interfaces:**
- Produces: `/settings` renders `SettingsPage` behind `RequireAuth`, same as every other authenticated route.

- [ ] **Step 1: Update the failing/changed test**

Add to `src/App.test.jsx` (alongside the existing tests, reusing the existing `useInvestments` mock already present there):
```js
  it('renders SettingsPage at /settings', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' }, session: {}, loading: false, signOut: vi.fn() })
    useAccounts.mockReturnValue({
      accounts: [{ id: 'a1', name: 'Main Account' }],
      activeAccount: { id: 'a1', name: 'Main Account' },
      activeAccountId: 'a1',
      switchAccount: vi.fn(),
      createAccount: vi.fn(),
      loading: false,
    })

    render(<MemoryRouter initialEntries={['/settings']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('settings-page')).toBeInTheDocument())
  })
```

This new test needs `useUserSettings` mocked too (`SettingsPage` calls it directly) — add near the top of `src/App.test.jsx`:
```js
import { useUserSettings } from './hooks/useUserSettings'
vi.mock('./hooks/useUserSettings')
```
and inside the new test, before rendering:
```js
    useUserSettings.mockReturnValue({ finnhubKey: '', loading: false, saveFinnhubKey: vi.fn() })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- App.test`
Expected: FAIL — no `/settings` route exists yet.

- [ ] **Step 3: Update `App.jsx`**

```jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import InvestmentsPage from './pages/InvestmentsPage'
import TradesPage from './pages/TradesPage'
import SettingsPage from './pages/SettingsPage'
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
      <Route path="/settings" element={<RequireAuth user={user}><SettingsPage /></RequireAuth>} />
      <Route path="/stats" element={<RequireAuth user={user}><PlaceholderPage title="Stats" /></RequireAuth>} />
      <Route path="/analyze" element={<RequireAuth user={user}><PlaceholderPage title="Analyze" /></RequireAuth>} />
      <Route path="/matt-cap" element={<RequireAuth user={user}><PlaceholderPage title="Matt Cap" /></RequireAuth>} />
    </Routes>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- App.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat: wire /settings route"
```

---

## Task 7: Full test suite pass and manual smoke test

**Files:** none (verification-only task).

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Manual smoke test against the live Supabase project**

With a real Finnhub API key available (the user provides one — https://finnhub.io free tier signup if needed):
1. Sign in, go to Settings (⚙ icon), enter the Finnhub key, save, confirm "Saved." appears.
2. Return to Investments (Home), click Refresh — confirm the button shows "Refreshing…" then returns to "↻ Refresh".
3. Confirm Stock rows' Current Price / Unrealized P&L update, and Option rows' Strike price coloring updates.
4. Temporarily clear the key in Settings, save, click Refresh on Investments — confirm the "Add your Finnhub API key…" banner appears and no request fires.
5. Re-add the key, refresh again to confirm recovery.

- [ ] **Step 3: Fix any issues found, re-run affected unit tests, and commit fixes**

If manual testing surfaces a bug, fix it, re-run that file's test suite, and commit with a `fix:` message.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: live price refresh + Settings page complete"
```
