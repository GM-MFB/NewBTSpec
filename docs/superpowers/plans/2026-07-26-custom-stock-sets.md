# Custom Stock Sets for Frontier & Optimizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users build an arbitrary set of stocks (not limited to real holdings) and run Frontier or Optimizer against it, either via an in-tab picker or by sending a Sector Browser selection straight to either tab.

**Architecture:** `OptimizerTab` already has a `mode`/`incomingSymbols` skeleton from Phase 5; this plan makes the symbol list editable in custom mode and adds the same mode/picker/Fetch pattern to `FrontierTab`, which currently has none. `AnalyzePage` lifts a `customSymbols` array so Sector Browser's two new "Send to…" buttons can hand a selection to either tab and switch to it in one action.

**Tech Stack:** React 19, Vitest + @testing-library/react (existing stack, no new dependencies).

## Global Constraints

- No Supabase schema changes.
- Reuse existing patterns exactly: symbol-chip picker (Financials/DCF/Research), Fetch-button pacing (Optimizer's existing `handleFetchPrices`), mode-toggle styling (Optimizer's `.optimizer-mode-toggle`).
- TDD throughout: failing test → implementation → passing test → commit, per task.

---

### Task 1: `SectorBrowser` — Send to Frontier / Send to Optimizer buttons

**Files:**
- Modify: `src/components/analysis/SectorBrowser.jsx`
- Modify: `src/components/analysis/SectorBrowser.test.jsx`

**Interfaces:**
- Produces: two new optional props `onSendToFrontier(symbols: string[])`,
  `onSendToOptimizer(symbols: string[])`. Consumed by Task 2 (`ResearchTab`).

- [ ] **Step 1: Write the failing test**

```jsx
it('calls onSendToFrontier with the selected symbols and clears the selection', async () => {
  const onSendToFrontier = vi.fn()
  render(<SectorBrowser onAddToCompare={vi.fn()} onSendToFrontier={onSendToFrontier} onSendToOptimizer={vi.fn()} />)

  const firstCheckbox = screen.getAllByRole('checkbox')[0]
  await userEvent.click(firstCheckbox)
  await userEvent.click(screen.getByRole('button', { name: /send to frontier/i }))

  expect(onSendToFrontier).toHaveBeenCalledTimes(1)
  expect(onSendToFrontier.mock.calls[0][0]).toHaveLength(1)
  expect(firstCheckbox).not.toBeChecked()
})

it('calls onSendToOptimizer with the selected symbols and clears the selection', async () => {
  const onSendToOptimizer = vi.fn()
  render(<SectorBrowser onAddToCompare={vi.fn()} onSendToFrontier={vi.fn()} onSendToOptimizer={onSendToOptimizer} />)

  const firstCheckbox = screen.getAllByRole('checkbox')[0]
  await userEvent.click(firstCheckbox)
  await userEvent.click(screen.getByRole('button', { name: /send to optimizer/i }))

  expect(onSendToOptimizer).toHaveBeenCalledTimes(1)
  expect(onSendToOptimizer.mock.calls[0][0]).toHaveLength(1)
})

it('disables the send buttons when nothing is selected', () => {
  render(<SectorBrowser onAddToCompare={vi.fn()} onSendToFrontier={vi.fn()} onSendToOptimizer={vi.fn()} />)
  expect(screen.getByRole('button', { name: /send to frontier/i })).toBeDisabled()
  expect(screen.getByRole('button', { name: /send to optimizer/i })).toBeDisabled()
})
```

Add these inside the existing `describe('SectorBrowser', ...)` block, alongside whatever imports (`vi`, `userEvent`, `screen`, `render`) the file already uses — check the top of `SectorBrowser.test.jsx` for the existing import list before adding.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SectorBrowser`
Expected: FAIL — the two buttons don't exist yet.

- [ ] **Step 3: Implement in `src/components/analysis/SectorBrowser.jsx`**

```jsx
export default function SectorBrowser({ onAddToCompare, onSendToFrontier, onSendToOptimizer }) {
  const [selected, setSelected] = useState(new Set())

  function toggle(sym) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(sym)) next.delete(sym)
      else next.add(sym)
      return next
    })
  }

  function handleAdd() {
    onAddToCompare([...selected])
    setSelected(new Set())
  }

  function handleSendToFrontier() {
    onSendToFrontier([...selected])
    setSelected(new Set())
  }

  function handleSendToOptimizer() {
    onSendToOptimizer([...selected])
    setSelected(new Set())
  }

  return (
    <div className="sector-browser">
      {SECTORS.map((sector) => (
        <details key={sector.name} className="sector-group">
          <summary>{sector.name}</summary>
          <div className="sector-stock-grid">
            {sector.stocks.map((stock) => (
              <label key={stock.sym} className="sector-stock">
                <input
                  type="checkbox"
                  checked={selected.has(stock.sym)}
                  onChange={() => toggle(stock.sym)}
                  aria-label={`${stock.sym} — ${stock.name}`}
                />
                {stock.sym} — {stock.name}
              </label>
            ))}
          </div>
        </details>
      ))}
      <div className="sector-actions">
        <span>{selected.size} selected</span>
        <button type="button" onClick={handleAdd} disabled={selected.size === 0}>Add to Compare</button>
        <button type="button" onClick={handleSendToFrontier} disabled={selected.size === 0}>Send to Frontier</button>
        <button type="button" onClick={handleSendToOptimizer} disabled={selected.size === 0}>Send to Optimizer</button>
      </div>
    </div>
  )
}
```

Only the function body and the props destructuring changed — `SECTORS` import and the rest of the file stay as-is.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- SectorBrowser`
Expected: PASS (all existing SectorBrowser tests plus the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis/SectorBrowser.jsx src/components/analysis/SectorBrowser.test.jsx
git commit -m "feat: add Send to Frontier and Send to Optimizer buttons to SectorBrowser"
```

---

### Task 2: `ResearchTab` — thread the two send handlers through to `SectorBrowser`

**Files:**
- Modify: `src/components/analysis/ResearchTab.jsx`
- Modify: `src/components/analysis/ResearchTab.test.jsx`

**Interfaces:**
- Consumes: `SectorBrowser`'s new props (Task 1).
- Produces: two new optional `ResearchTab` props `onSendToFrontier`,
  `onSendToOptimizer`, passed straight through. Consumed by Task 5
  (`AnalyzePage`).

- [ ] **Step 1: Write the failing test**

```jsx
it('passes onSendToFrontier and onSendToOptimizer through to SectorBrowser', async () => {
  useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
  const onSendToFrontier = vi.fn()
  const onSendToOptimizer = vi.fn()

  render(
    <MemoryRouter>
      <ResearchTab investments={investments} onSendToFrontier={onSendToFrontier} onSendToOptimizer={onSendToOptimizer} />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: /^compare$/i }))
  await userEvent.click(screen.getByRole('button', { name: /browse by sector/i }))

  const firstCheckbox = screen.getAllByRole('checkbox')[0]
  await userEvent.click(firstCheckbox)
  await userEvent.click(screen.getByRole('button', { name: /send to frontier/i }))

  expect(onSendToFrontier).toHaveBeenCalledTimes(1)
})
```

Add this inside the existing `describe('ResearchTab', ...)` block in
`ResearchTab.test.jsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ResearchTab`
Expected: FAIL — `ResearchTab` doesn't accept or forward the two props yet.

- [ ] **Step 3: Implement in `src/components/analysis/ResearchTab.jsx`**

Update the function signature and the `SectorBrowser` render call:

```jsx
export default function ResearchTab({ investments, onSendToFrontier, onSendToOptimizer }) {
```

```jsx
{view === 'compare' && showSectorBrowser && (
  <SectorBrowser
    onAddToCompare={handleAddToCompare}
    onSendToFrontier={onSendToFrontier}
    onSendToOptimizer={onSendToOptimizer}
  />
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ResearchTab`
Expected: PASS (all existing tests plus the new one).

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis/ResearchTab.jsx src/components/analysis/ResearchTab.test.jsx
git commit -m "feat: thread onSendToFrontier/onSendToOptimizer through ResearchTab to SectorBrowser"
```

---

### Task 3: `OptimizerTab` — editable custom-set picker + `incomingSymbols` seeding

**Files:**
- Modify: `src/components/analysis/OptimizerTab.jsx`
- Modify: `src/components/analysis/OptimizerTab.css`
- Modify: `src/components/analysis/OptimizerTab.test.jsx`

**Interfaces:**
- No signature change to `incomingSymbols` (already exists) — this task
  makes it drive editable state instead of a static read, and adds an
  add/remove picker UI in custom mode.

- [ ] **Step 1: Write the failing test**

```jsx
it('lets the user add and remove symbols in Custom mode', async () => {
  render(<OptimizerTab investments={investments} />)
  await userEvent.click(screen.getByRole('button', { name: /^custom$/i }))

  await userEvent.type(screen.getByLabelText(/add symbol/i), 'NVDA{enter}')
  expect(screen.getByRole('rowheader', { name: /nvda/i })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: /remove nvda/i }))
  expect(screen.queryByRole('rowheader', { name: /nvda/i })).not.toBeInTheDocument()
})

it('seeds Custom mode with incomingSymbols on mount', () => {
  render(<OptimizerTab investments={investments} incomingSymbols={['NVDA', 'AMD']} />)
  expect(screen.getByRole('button', { name: /^custom$/i })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('rowheader', { name: /nvda/i })).toBeInTheDocument()
  expect(screen.getByRole('rowheader', { name: /amd/i })).toBeInTheDocument()
})

it('re-seeds Custom mode when a new incomingSymbols array arrives', () => {
  const { rerender } = render(<OptimizerTab investments={investments} incomingSymbols={['NVDA']} />)
  expect(screen.getByRole('rowheader', { name: /nvda/i })).toBeInTheDocument()

  rerender(<OptimizerTab investments={investments} incomingSymbols={['TSLA']} />)
  expect(screen.getByRole('rowheader', { name: /tsla/i })).toBeInTheDocument()
  expect(screen.queryByRole('rowheader', { name: /nvda/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- OptimizerTab`
Expected: FAIL — no add-symbol input or remove buttons exist yet, and
`incomingSymbols` is read once into `mode` but never seeds an editable list.

- [ ] **Step 3: Implement in `src/components/analysis/OptimizerTab.jsx`**

```jsx
import { useEffect, useState } from 'react'
```

Replace the `mode`/`symbols` derivation and add picker state:

```jsx
export default function OptimizerTab({ investments, incomingSymbols = null }) {
  const { user } = useAuth()
  const { finnhubKey } = useUserSettings(user?.id)
  const [mode, setMode] = useState(incomingSymbols && incomingSymbols.length > 0 ? 'custom' : 'portfolio')
  const [customSymbols, setCustomSymbols] = useState(incomingSymbols ?? [])
  const [customInput, setCustomInput] = useState('')
  const [simLevel, setSimLevel] = useState('standard')
  const [priceOverrides, setPriceOverrides] = useState({})
  const [fetchErrors, setFetchErrors] = useState({})
  const [totalToInvest, setTotalToInvest] = useState('')
  const [result, setResult] = useState(null)
  const [ranWithVersion, setRanWithVersion] = useState(null)

  useEffect(() => {
    if (incomingSymbols && incomingSymbols.length > 0) {
      setCustomSymbols(incomingSymbols)
      setMode('custom')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSymbols])

  const portfolioSymbols = investments.filter((i) => ['Stock', 'ETF', 'Crypto'].includes(i.assetType)).map((i) => i.symbol)
  const symbols = mode === 'custom' ? customSymbols : portfolioSymbols

  function addCustomSymbol(rawSymbol) {
    const symbol = rawSymbol.trim().toUpperCase()
    if (!symbol) return
    setCustomSymbols((prev) => (prev.includes(symbol) ? prev : [...prev, symbol]))
    setCustomInput('')
  }

  function removeCustomSymbol(symbol) {
    setCustomSymbols((prev) => prev.filter((s) => s !== symbol))
  }

  function priceFor(symbol) {
```

(the rest of `priceFor` through `handleRun`/`isStale` is unchanged — only
the block above it changes).

Add the picker UI right after the mode toggle, before the "Total to invest"
label:

```jsx
{mode === 'custom' && (
  <div className="optimizer-custom-picker">
    <div className="optimizer-custom-chips">
      {customSymbols.map((symbol) => (
        <span key={symbol} className="optimizer-custom-chip">
          {symbol}
          <button type="button" aria-label={`Remove ${symbol}`} onClick={() => removeCustomSymbol(symbol)}>×</button>
        </span>
      ))}
    </div>
    <form onSubmit={(e) => { e.preventDefault(); addCustomSymbol(customInput) }}>
      <label htmlFor="optimizerAddSymbol">Add symbol</label>
      <input
        id="optimizerAddSymbol"
        value={customInput}
        onChange={(e) => setCustomInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSymbol(customInput) } }}
      />
    </form>
  </div>
)}
```

- [ ] **Step 4: Add CSS for the picker**

```css
.optimizer-custom-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.optimizer-custom-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.optimizer-custom-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.optimizer-custom-chip button {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 14px;
  line-height: 1;
  padding: 0;
}

.optimizer-custom-picker input {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 8px;
  font-size: 12px;
  text-transform: uppercase;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- OptimizerTab`
Expected: PASS (all existing tests plus the 3 new ones).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/OptimizerTab.jsx src/components/analysis/OptimizerTab.css src/components/analysis/OptimizerTab.test.jsx
git commit -m "feat: make Optimizer's Custom mode symbol list editable and seedable from incomingSymbols"
```

---

### Task 4: `FrontierTab` — mode toggle, custom-set picker, Fetch button, `incomingSymbols` seeding

**Files:**
- Modify: `src/components/analysis/FrontierTab.jsx`
- Modify: `src/components/analysis/FrontierTab.css`
- Modify: `src/components/analysis/FrontierTab.test.jsx`

**Interfaces:**
- Produces: new `incomingSymbols` prop (mirrors `OptimizerTab`'s). Consumed
  by Task 5 (`AnalyzePage`).

- [ ] **Step 1: Write the failing test**

```jsx
it('defaults to My Portfolio mode with no incomingSymbols', () => {
  const investments = [
    { symbol: 'AAPL', assetType: 'Stock', shares: 10, currentPrice: 150 },
    { symbol: 'SPY', assetType: 'ETF', shares: 5, currentPrice: 500 },
  ]
  render(<FrontierTab investments={investments} />)
  expect(screen.getByRole('button', { name: /^my portfolio$/i })).toHaveAttribute('aria-pressed', 'true')
})

it('seeds Custom Set mode with incomingSymbols on mount', () => {
  render(<FrontierTab investments={[]} incomingSymbols={['NVDA', 'AMD']} />)
  expect(screen.getByRole('button', { name: /^custom set$/i })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('NVDA')).toBeInTheDocument()
  expect(screen.getByText('AMD')).toBeInTheDocument()
})

it('lets the user add symbols in Custom Set mode and renders the frontier once there are 2+', async () => {
  render(<FrontierTab investments={[]} />)
  await userEvent.click(screen.getByRole('button', { name: /^custom set$/i }))

  expect(screen.getByText(/add at least 2 symbols/i)).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText(/add symbol/i), 'NVDA{enter}')
  await userEvent.type(screen.getByLabelText(/add symbol/i), 'AMD{enter}')

  await waitFor(() => expect(screen.getByText('Your Portfolio')).toBeInTheDocument())
})

it('shows a Fetch button in Custom Set mode that populates prices via fetchQuote', async () => {
  fetchQuote.mockResolvedValue({ c: 123.45 })
  useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
  render(<FrontierTab investments={[]} incomingSymbols={['NVDA', 'AMD']} />)

  await userEvent.click(screen.getByRole('button', { name: /^fetch$/i }))

  await waitFor(() => expect(fetchQuote).toHaveBeenCalledTimes(2))
  expect(screen.getAllByText('$123.45').length).toBeGreaterThan(0)
})
```

These need new mocks at the top of `FrontierTab.test.jsx` (which currently
only mocks `../../lib/fetchCorrelations`):

```jsx
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchQuote } from '../../lib/finnhub'

vi.mock('../../hooks/useAuth')
vi.mock('../../hooks/useUserSettings')
vi.mock('../../lib/finnhub')
```

and in `beforeEach`:

```jsx
useAuth.mockReturnValue({ user: { id: 'u1' } })
useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FrontierTab`
Expected: FAIL — no mode toggle, no picker, no Fetch button exist yet.

- [ ] **Step 3: Implement in `src/components/analysis/FrontierTab.jsx`**

```jsx
import { useEffect, useState } from 'react'
import './FrontierTab.css'
import FrontierPanel from './FrontierPanel'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchQuote } from '../../lib/finnhub'
import { fetchCorrelations } from '../../lib/fetchCorrelations'
import { setRealCorrelations, setComputedParams } from '../../lib/efficientFrontier'
import { formatCurrency } from '../../lib/format'

export default function FrontierTab({ investments, incomingSymbols = null }) {
  const { user } = useAuth()
  const { finnhubKey } = useUserSettings(user?.id)
  const [mode, setMode] = useState(incomingSymbols && incomingSymbols.length > 0 ? 'custom' : 'portfolio')
  const [customSymbols, setCustomSymbols] = useState(incomingSymbols ?? [])
  const [customInput, setCustomInput] = useState('')
  const [customPrices, setCustomPrices] = useState({})
  const [fetchErrors, setFetchErrors] = useState({})

  useEffect(() => {
    if (incomingSymbols && incomingSymbols.length > 0) {
      setCustomSymbols(incomingSymbols)
      setMode('custom')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSymbols])

  const portfolioPositions = investments.filter((i) => ['Stock', 'ETF', 'Crypto'].includes(i.assetType))
  const portfolioSymbols = portfolioPositions.map((p) => p.symbol)
  const symbols = mode === 'custom' ? customSymbols : portfolioSymbols

  useEffect(() => {
    if (symbols.length < 2) return
    fetchCorrelations(symbols).then(({ corrMap, paramsMap }) => {
      setRealCorrelations(corrMap)
      setComputedParams(paramsMap)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')])

  function addCustomSymbol(rawSymbol) {
    const symbol = rawSymbol.trim().toUpperCase()
    if (!symbol) return
    setCustomSymbols((prev) => (prev.includes(symbol) ? prev : [...prev, symbol]))
    setCustomInput('')
  }

  function removeCustomSymbol(symbol) {
    setCustomSymbols((prev) => prev.filter((s) => s !== symbol))
  }

  async function handleFetchPrices() {
    setFetchErrors({})
    for (const symbol of customSymbols) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const quote = await fetchQuote(symbol, finnhubKey)
        setCustomPrices((prev) => ({ ...prev, [symbol]: quote.c }))
      } catch {
        setFetchErrors((prev) => ({ ...prev, [symbol]: true }))
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  let weights
  let priceMap
  if (mode === 'custom') {
    weights = customSymbols.map(() => (customSymbols.length > 0 ? 1 / customSymbols.length : 0))
    priceMap = customPrices
  } else {
    const totalMV = portfolioPositions.reduce((sum, p) => sum + p.shares * p.currentPrice, 0)
    weights = portfolioPositions.map((p) => (totalMV > 0 ? (p.shares * p.currentPrice) / totalMV : 0))
    priceMap = Object.fromEntries(portfolioPositions.map((p) => [p.symbol, p.currentPrice]))
  }

  return (
    <div className="frontier-tab">
      <div className="frontier-mode-toggle">
        <button type="button" aria-pressed={mode === 'portfolio'} onClick={() => setMode('portfolio')}>My Portfolio</button>
        <button type="button" aria-pressed={mode === 'custom'} onClick={() => setMode('custom')}>Custom Set</button>
      </div>

      {mode === 'custom' && (
        <div className="frontier-custom-picker">
          <div className="frontier-custom-chips">
            {customSymbols.map((symbol) => (
              <span key={symbol} className="frontier-custom-chip">
                {symbol}
                <button type="button" aria-label={`Remove ${symbol}`} onClick={() => removeCustomSymbol(symbol)}>×</button>
              </span>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); addCustomSymbol(customInput) }}>
            <label htmlFor="frontierAddSymbol">Add symbol</label>
            <input
              id="frontierAddSymbol"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSymbol(customInput) } }}
            />
          </form>
          <button type="button" onClick={handleFetchPrices}>Fetch</button>

          {customSymbols.length > 0 && (
            <table className="frontier-price-table">
              <thead><tr><th>Symbol</th><th>Price</th></tr></thead>
              <tbody>
                {customSymbols.map((symbol) => (
                  <tr key={symbol}>
                    <th scope="row">{symbol}</th>
                    <td className="mono">
                      {fetchErrors[symbol] ? 'error' : (customPrices[symbol] ? formatCurrency(customPrices[symbol]) : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {symbols.length < 2 ? (
        <div className="frontier-empty">
          <p>
            {mode === 'custom'
              ? 'Add at least 2 symbols to see the Efficient Frontier.'
              : 'Add at least 2 open positions to see your Efficient Frontier.'}
          </p>
        </div>
      ) : (
        <FrontierPanel
          symbols={symbols}
          weights={weights}
          storageKey={mode === 'custom' ? 'bt_ef_custom_params' : 'bt_ef_params'}
          priceMap={priceMap}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add CSS for the mode toggle and picker**

```css
.frontier-mode-toggle {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
}

.frontier-mode-toggle button {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.frontier-mode-toggle button[aria-pressed="true"] {
  border-color: var(--green);
  color: var(--green);
}

.frontier-custom-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.frontier-custom-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.frontier-custom-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.frontier-custom-chip button {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 14px;
  line-height: 1;
  padding: 0;
}

.frontier-custom-picker input {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 8px;
  font-size: 12px;
  text-transform: uppercase;
}

.frontier-price-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.frontier-price-table th, .frontier-price-table td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  text-align: right;
}

.frontier-price-table th[scope="row"] {
  text-align: left;
  color: var(--text-dim);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- FrontierTab`
Expected: PASS (all existing tests plus the 4 new ones).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/FrontierTab.jsx src/components/analysis/FrontierTab.css src/components/analysis/FrontierTab.test.jsx
git commit -m "feat: add Custom Set mode with symbol picker and price Fetch to FrontierTab"
```

---

### Task 5: `AnalyzePage` — lift `customSymbols`, wire the send handlers

**Files:**
- Modify: `src/pages/AnalyzePage.jsx`
- Modify: `src/pages/AnalyzePage.test.jsx`

**Interfaces:**
- Consumes: `ResearchTab`'s `onSendToFrontier`/`onSendToOptimizer` (Task 2),
  `FrontierTab`'s `incomingSymbols` (Task 4), `OptimizerTab`'s
  `incomingSymbols` (Task 3, already existed).

- [ ] **Step 1: Write the failing test**

```jsx
it('sending a Sector Browser selection to Frontier switches tabs and seeds the picker', async () => {
  mockCommon()
  render(<MemoryRouter><AnalyzePage /></MemoryRouter>)

  await userEvent.click(screen.getByRole('button', { name: /^research$/i }))
  await userEvent.click(screen.getByRole('button', { name: /^compare$/i }))
  await userEvent.click(screen.getByRole('button', { name: /browse by sector/i }))
  await userEvent.click(screen.getAllByRole('checkbox')[0])
  await userEvent.click(screen.getByRole('button', { name: /send to frontier/i }))

  expect(screen.getByRole('button', { name: /^frontier$/i })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /^custom set$/i })).toHaveAttribute('aria-pressed', 'true')
})

it('sending a Sector Browser selection to Optimizer switches tabs and seeds the picker', async () => {
  mockCommon()
  render(<MemoryRouter><AnalyzePage /></MemoryRouter>)

  await userEvent.click(screen.getByRole('button', { name: /^research$/i }))
  await userEvent.click(screen.getByRole('button', { name: /^compare$/i }))
  await userEvent.click(screen.getByRole('button', { name: /browse by sector/i }))
  await userEvent.click(screen.getAllByRole('checkbox')[0])
  await userEvent.click(screen.getByRole('button', { name: /send to optimizer/i }))

  expect(screen.getByRole('button', { name: /^optimizer$/i })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /^custom$/i })).toHaveAttribute('aria-pressed', 'true')
})
```

Add these inside the existing `describe('AnalyzePage', ...)` block. They
render the real `ResearchTab`/`FrontierTab`/`OptimizerTab`/`SectorBrowser`
tree (no additional mocking needed beyond what `mockCommon()` already sets
up), since this is deliberately an integration-style test of the hand-off
path through real components.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AnalyzePage`
Expected: FAIL — `AnalyzePage` doesn't pass the send handlers or
`incomingSymbols` yet.

- [ ] **Step 3: Implement in `src/pages/AnalyzePage.jsx`**

```jsx
export default function AnalyzePage() {
  const { user } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount } = useAccounts(user?.id)
  const { investments } = useInvestments(activeAccountId)
  const [tab, setTab] = useState('research')
  const [customSymbols, setCustomSymbols] = useState(null)

  function handleSendToFrontier(symbols) {
    setCustomSymbols(symbols)
    setTab('frontier')
  }

  function handleSendToOptimizer(symbols) {
    setCustomSymbols(symbols)
    setTab('optimizer')
  }

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

      {tab === 'financials' && <FinancialsTab investments={investments} />}
      {tab === 'research' && (
        <ResearchTab investments={investments} onSendToFrontier={handleSendToFrontier} onSendToOptimizer={handleSendToOptimizer} />
      )}
      {tab === 'dcf' && <DCFTab investments={investments} />}
      {tab === 'frontier' && <FrontierTab investments={investments} incomingSymbols={customSymbols} />}
      {tab === 'optimizer' && <OptimizerTab investments={investments} incomingSymbols={customSymbols} />}
      {tab === 'risk' && <RiskTab investments={investments} />}
      {!['financials', 'research', 'dcf', 'frontier', 'optimizer', 'risk'].includes(tab) && (
        <AnalyzeTabPlaceholder label={TABS.find((t) => t.key === tab).label} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- AnalyzePage`
Expected: PASS (all existing tests plus the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/pages/AnalyzePage.jsx src/pages/AnalyzePage.test.jsx
git commit -m "feat: wire Sector Browser send-to-Frontier/Optimizer hand-off through AnalyzePage"
```

---

### Task 6: Full suite + `netlify dev` smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (427 existing + new tests from this plan).

- [ ] **Step 2: Restart `netlify dev`, manual smoke test**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

At `/analyze`:
- **Frontier**: switch to Custom Set, add 2-3 tickers not in your
  portfolio, confirm the chart renders with an equal-weight "Your
  Portfolio" point, click Fetch with a real Finnhub key and confirm prices
  populate.
- **Optimizer**: switch to Custom, add/remove a few tickers, run at
  "Fast", confirm the elimination trail reflects the custom set.
- **Research → Sector Browser**: select a few checkboxes, click "Send to
  Frontier" — confirm it jumps to Frontier already in Custom Set mode with
  those symbols. Repeat with "Send to Optimizer".

- [ ] **Step 3: Report completion**

No commit needed for this task unless smoke testing surfaces a bug — fix
as a new small commit and re-run Step 1.
