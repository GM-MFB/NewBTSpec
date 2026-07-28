# Charts Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Charts" top-level tab that embeds a TradingView Advanced Chart widget for a searched symbol, with a sidebar listing the shared Watchlist's symbols (ranked by watch count) for quick switching.

**Architecture:** A thin `TradingViewWidget` component injects TradingView's public embed `<script>` into a container div, re-mounting it whenever the `symbol` prop changes. `ChartsPage` owns the current symbol (seeded from `localStorage`), renders a search form, the widget, and a sidebar built from the existing `useWatchlist` + `buildLeaderboard` (both already used by `WatchlistPage`, no changes needed to either).

**Tech Stack:** React 19, Vite, Vitest + Testing Library, react-router-dom. TradingView's free `embed-widget-advanced-chart.js` script (no API key, no new dependency).

## Global Constraints

- Do not modify `database-reference.md`-tracked schema, RLS, or any Supabase table/column — this feature is 100% client-side (localStorage) plus a read-only reuse of the existing `fund_watchlist` data via `useWatchlist`.
- No new npm dependencies — the TradingView widget is loaded via a plain `<script>` tag injected at runtime, not an installed package.
- Follow the existing dark-theme CSS custom-property conventions (`--bg`, `--bg-elevated`, `--border`, `--text`, `--text-dim`, `--green`, `--red`, uppercase small section-header labels with `border-bottom`, `.mono` for tabular numerics) — same conventions used in `src/pages/WatchlistPage.css`.
- TDD discipline: write failing test → run → confirm FAIL → implement → run → confirm PASS → commit, for every task with testable logic.
- localStorage key for the persisted symbol: `bt_charts_symbol` (matches the existing `bt_active_account` naming pattern in `src/hooks/useAccounts.js`).

---

### Task 1: `TradingViewWidget` component

**Files:**
- Create: `src/components/TradingViewWidget.jsx`
- Test: `src/components/TradingViewWidget.test.jsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export default function TradingViewWidget({ symbol })` — a React component. Later tasks (`ChartsPage`) import and render `<TradingViewWidget symbol={symbol} />`.

This component's only logic is: on mount, and whenever `symbol` changes, clear its container and inject a fresh TradingView embed `<script>` tag configured for that symbol. This is a side-effecting DOM wrapper with no branching logic, so its test only verifies the container structure renders and that the effect re-runs (clears + re-populates the container) when `symbol` changes — it does not assert on TradingView's actual script execution (that's third-party and not unit-testable).

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/TradingViewWidget.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import TradingViewWidget from './TradingViewWidget'

describe('TradingViewWidget', () => {
  it('renders a widget container', () => {
    const { container } = render(<TradingViewWidget symbol="AAPL" />)
    expect(container.querySelector('.tradingview-widget-container')).toBeInTheDocument()
  })

  it('injects a script tag configured with the given symbol', () => {
    const { container } = render(<TradingViewWidget symbol="AAPL" />)
    const script = container.querySelector('script')
    expect(script).toBeInTheDocument()
    expect(script.textContent).toContain('"symbol":"AAPL"')
  })

  it('re-injects the script when the symbol prop changes', () => {
    const { container, rerender } = render(<TradingViewWidget symbol="AAPL" />)
    rerender(<TradingViewWidget symbol="TSLA" />)
    const script = container.querySelector('script')
    expect(script.textContent).toContain('"symbol":"TSLA"')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run TradingViewWidget`
Expected: FAIL with "Failed to resolve import ./TradingViewWidget" or similar (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/TradingViewWidget.jsx
import { useEffect, useRef } from 'react'

export default function TradingViewWidget({ symbol }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.textContent = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      allow_symbol_change: true,
      support_host: 'https://www.tradingview.com',
    })
    container.appendChild(script)
  }, [symbol])

  return (
    <div className="tradingview-widget-container" ref={containerRef} />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run TradingViewWidget`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/TradingViewWidget.jsx src/components/TradingViewWidget.test.jsx
git commit -m "feat: add TradingViewWidget component wrapping the TradingView embed script"
```

---

### Task 2: `ChartsPage`

**Files:**
- Create: `src/pages/ChartsPage.jsx`
- Create: `src/pages/ChartsPage.css`
- Test: `src/pages/ChartsPage.test.jsx`

**Interfaces:**
- Consumes:
  - `TradingViewWidget` from Task 1 — `<TradingViewWidget symbol={string} />`.
  - `useAuth()` from `src/hooks/useAuth.js` — returns `{ user, signOut }`.
  - `useAccounts(userId)` from `src/hooks/useAccounts.js` — returns `{ accounts, activeAccount, switchAccount, createAccount }`.
  - `useWatchlist(userId)` from `src/hooks/useWatchlist.js` — returns `{ entries, loading, addEntry, removeEntry }` where each entry is `{ id, userId, displayName, symbol, note, createdAt }`.
  - `buildLeaderboard(entries)` from `src/lib/watchlistLeaderboard.js` — returns `[{ symbol, count, people }]` sorted by count desc, symbol asc.
  - `Header` from `src/components/Header.jsx` — props `accounts, activeAccount, switchAccount, createAccount, onSignOut, showAddButton`.
- Produces: `export default function ChartsPage()` — routed at `/charts` in Task 3.

- [ ] **Step 1: Write the failing test**

```jsx
// src/pages/ChartsPage.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ChartsPage from './ChartsPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useWatchlist } from '../hooks/useWatchlist'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useWatchlist')
vi.mock('../components/TradingViewWidget', () => ({
  default: ({ symbol }) => <div data-testid="tv-widget">{symbol}</div>,
}))

function mockCommon({ entries = [] } = {}) {
  useAuth.mockReturnValue({ user: { id: 'u1', email: 'alice@example.com' }, signOut: vi.fn() })
  useAccounts.mockReturnValue({
    accounts: [{ id: 'a1', name: 'Main Account' }],
    activeAccount: { id: 'a1', name: 'Main Account' },
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
  })
  useWatchlist.mockReturnValue({ entries, loading: false, addEntry: vi.fn(), removeEntry: vi.fn() })
}

describe('ChartsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('defaults to AAPL when no stored symbol exists', () => {
    mockCommon()
    render(<MemoryRouter><ChartsPage /></MemoryRouter>)
    expect(screen.getByTestId('tv-widget')).toHaveTextContent('AAPL')
  })

  it('restores the last-viewed symbol from localStorage', () => {
    localStorage.setItem('bt_charts_symbol', 'MSFT')
    mockCommon()
    render(<MemoryRouter><ChartsPage /></MemoryRouter>)
    expect(screen.getByTestId('tv-widget')).toHaveTextContent('MSFT')
  })

  it('updates the chart and localStorage when searching a new symbol', async () => {
    mockCommon()
    render(<MemoryRouter><ChartsPage /></MemoryRouter>)

    await userEvent.type(screen.getByLabelText(/symbol/i), 'nvda')
    await userEvent.click(screen.getByRole('button', { name: /^show$/i }))

    expect(screen.getByTestId('tv-widget')).toHaveTextContent('NVDA')
    expect(localStorage.getItem('bt_charts_symbol')).toBe('NVDA')
  })

  it('shows watchlist symbols ranked by watch count in the sidebar', () => {
    mockCommon({
      entries: [
        { id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' },
        { id: 'w2', userId: 'u2', displayName: 'Bob', symbol: 'AAPL', note: null, createdAt: '2026-01-02' },
        { id: 'w3', userId: 'u1', displayName: 'Alice', symbol: 'TSLA', note: null, createdAt: '2026-01-03' },
      ],
    })
    render(<MemoryRouter><ChartsPage /></MemoryRouter>)

    const rows = screen.getAllByTestId('charts-sidebar-row')
    expect(rows[0]).toHaveTextContent('AAPL')
    expect(rows[1]).toHaveTextContent('TSLA')
  })

  it('switches the chart symbol when a sidebar row is clicked', async () => {
    mockCommon({
      entries: [{ id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'TSLA', note: null, createdAt: '2026-01-01' }],
    })
    render(<MemoryRouter><ChartsPage /></MemoryRouter>)

    await userEvent.click(screen.getByTestId('charts-sidebar-row'))

    expect(screen.getByTestId('tv-widget')).toHaveTextContent('TSLA')
    expect(localStorage.getItem('bt_charts_symbol')).toBe('TSLA')
  })

  it('shows a placeholder message when the watchlist is empty', () => {
    mockCommon({ entries: [] })
    render(<MemoryRouter><ChartsPage /></MemoryRouter>)

    expect(screen.getByText(/no watchlist symbols yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run ChartsPage`
Expected: FAIL with "Failed to resolve import ./ChartsPage" (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/pages/ChartsPage.jsx
import { useState } from 'react'
import './ChartsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useWatchlist } from '../hooks/useWatchlist'
import { buildLeaderboard } from '../lib/watchlistLeaderboard'
import TradingViewWidget from '../components/TradingViewWidget'
import Header from '../components/Header'

const STORAGE_KEY = 'bt_charts_symbol'

export default function ChartsPage() {
  const { user, signOut } = useAuth()
  const { accounts, activeAccount, switchAccount, createAccount } = useAccounts(user?.id)
  const { entries } = useWatchlist(user?.id)

  const [symbol, setSymbol] = useState(() => localStorage.getItem(STORAGE_KEY) || 'AAPL')
  const [searchInput, setSearchInput] = useState('')

  const leaderboard = buildLeaderboard(entries)

  function setActiveSymbol(next) {
    setSymbol(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  function handleSearch(e) {
    e.preventDefault()
    const next = searchInput.trim().toUpperCase()
    if (!next) return
    setActiveSymbol(next)
    setSearchInput('')
  }

  return (
    <div data-testid="charts-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        onSignOut={signOut}
        showAddButton={false}
      />

      <div className="charts-page">
        <aside className="charts-sidebar">
          <h2>Watchlist</h2>
          {leaderboard.length === 0 ? (
            <p className="charts-sidebar-empty">No watchlist symbols yet.</p>
          ) : (
            <ul>
              {leaderboard.map((row) => (
                <li key={row.symbol}>
                  <button
                    type="button"
                    data-testid="charts-sidebar-row"
                    className={row.symbol === symbol ? 'active' : undefined}
                    onClick={() => setActiveSymbol(row.symbol)}
                  >
                    <span className="charts-sidebar-symbol">{row.symbol}</span>
                    <span className="charts-sidebar-count">{row.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="charts-main">
          <form className="charts-search-form" onSubmit={handleSearch}>
            <label htmlFor="chartsSymbol">Symbol</label>
            <input
              id="chartsSymbol"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit">Show</button>
          </form>

          <div className="charts-widget-wrapper">
            <TradingViewWidget symbol={symbol} />
          </div>
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run ChartsPage`
Expected: PASS (6 tests)

- [ ] **Step 5: Write the CSS**

```css
/* src/pages/ChartsPage.css */
.charts-page {
  display: flex;
  gap: 20px;
  padding: 20px 32px 40px;
  align-items: flex-start;
}

.charts-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  max-height: 80vh;
  overflow-y: auto;
}

.charts-sidebar h2 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.charts-sidebar-empty {
  color: var(--text-dim);
  font-size: 13px;
}

.charts-sidebar ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.charts-sidebar button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 8px 10px;
  color: var(--text);
  font-size: 13px;
  text-align: left;
}

.charts-sidebar button:hover {
  border-color: var(--border);
}

.charts-sidebar button.active {
  background: var(--bg);
  border-color: var(--border);
  font-weight: 700;
}

.charts-sidebar-symbol {
  font-weight: 700;
}

.charts-sidebar-count {
  color: var(--text-dim);
  font-size: 12px;
}

.charts-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.charts-search-form {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.charts-search-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

.charts-search-form input {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 8px;
  font-size: 13px;
}

.charts-widget-wrapper {
  height: 70vh;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.charts-widget-wrapper .tradingview-widget-container {
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 6: Re-run tests to confirm CSS import doesn't break anything**

Run: `npx vitest run ChartsPage`
Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
git add src/pages/ChartsPage.jsx src/pages/ChartsPage.css src/pages/ChartsPage.test.jsx
git commit -m "feat: add ChartsPage with TradingView chart and watchlist sidebar"
```

---

### Task 3: Wire up routing and navigation

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/Header.jsx`
- Test: `src/components/Header.test.jsx` (if it exists — check first; if not, skip test changes for this task since `Header` is already covered indirectly by every page test that renders it)

**Interfaces:**
- Consumes: `ChartsPage` from Task 2 (default export).
- Produces: nothing new consumed by later tasks — this is the final integration task.

- [ ] **Step 1: Check for an existing Header test file**

Run: `ls src/components/Header.test.jsx 2>/dev/null || echo "no header test"`

If it exists, read it and add one assertion that a "Charts" nav link renders, following the file's existing style. If it does not exist, skip straight to Step 2 (no test file to update).

- [ ] **Step 2: Add the route**

In `src/App.jsx`, add the import and route:

```jsx
import ChartsPage from "./pages/ChartsPage";
```

Add after the `/watchlist` route:

```jsx
<Route
    path="/charts"
    element={
        <RequireAuth user={user}>
            <ChartsPage />
        </RequireAuth>
    }
/>
```

- [ ] **Step 3: Add the nav link**

In `src/components/Header.jsx`, add after the `/watchlist` `NavLink` (inside `<nav className="app-nav">`):

```jsx
<NavLink
    to="/charts"
    className={({ isActive }) =>
        isActive ? "active" : undefined
    }
>
    Charts
</NavLink>
```

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, all previously-passing tests plus the 9 new tests from Tasks 1 and 2 (total prior count + 9).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/Header.jsx
git commit -m "feat: wire up Charts tab route and nav link"
```

---

### Task 4: Manual smoke test

**Files:** none (verification only).

- [ ] **Step 1: Restart the dev server**

```bash
taskkill //F //IM node.exe //T
(npm run dev > /tmp/charts_smoke.log 2>&1 &)
sleep 8
cat /tmp/charts_smoke.log
```

Expected: log shows "Loaded function yahoo-proxy" and the local dev server ready banner, no errors.

- [ ] **Step 2: Confirm the route responds**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8888/charts
```

Expected: `200`

- [ ] **Step 3: Report to the user**

Tell the user the Charts tab is live at `/charts`, reusing their Watchlist for the sidebar, and ask them to open it in a browser to confirm the TradingView widget itself renders correctly (this cannot be verified by an automated test since it depends on TradingView's external script executing in a real browser).
