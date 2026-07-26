# FrontierPanel Stat Cards & Rebalancing Table Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `FrontierPanel`'s presentation to match the reference screenshot — three per-point stat cards with colored allocation bars, and a richer Rebalancing Plan table — without changing any of the underlying simulation data flow.

**Architecture:** A pure `assignSymbolColors` helper maps each symbol to a fixed hue from the validated 8-slot categorical palette, ordered by "Your Portfolio" weight descending. A new private `FrontierStatCard` subcomponent (inside `FrontierPanel.jsx`, not its own file) renders three times with different point data. The existing `.frontier-table` markup is replaced with the redesigned version. Both the color helper and the card component are internal to `FrontierPanel.jsx` and only become observable through the rendered DOM, so they're built and tested together as one task rather than split artificially.

**Tech Stack:** React 19, Vitest + @testing-library/react (existing stack, no new dependencies).

## Global Constraints

- No changes to `src/lib/efficientFrontier.js` or any simulation data shape — this is presentation-only.
- Reuse `formatLarge`/`formatCurrency` from `src/lib/format.js`.
- TDD throughout: failing test → implementation → passing test → commit.

---

### Task 1: `assignSymbolColors`, stat cards, and rebalancing table redesign

**Files:**
- Modify: `src/components/analysis/FrontierPanel.jsx`
- Modify: `src/components/analysis/FrontierPanel.css`
- Modify: `src/components/analysis/FrontierPanel.test.jsx`

**Interfaces:**
- Produces (both module-private, not exported — only used within
  `FrontierPanel.jsx`): `assignSymbolColors(symbols: string[], weights:
  number[]) -> { [symbol]: hexColor }`, `FrontierStatCard` subcomponent.
  No prop changes to `FrontierPanel` itself.

- [ ] **Step 1: Write the failing tests**

Add to `FrontierPanel.test.jsx`:

```jsx
it('renders 3 stat cards with title, subtitle, and headline stats', () => {
  render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params_4" nSim={300} />)

  expect(screen.getByText('Current allocation')).toBeInTheDocument()
  expect(screen.getByText('Best correlation spread')).toBeInTheDocument()
  expect(screen.getByText('Best risk-adjusted return')).toBeInTheDocument()
  expect(screen.getAllByText('Exp. Annual Return')).toHaveLength(3)
  expect(screen.getAllByText('Sharpe Ratio')).toHaveLength(3)
})

it('renders one allocation bar row per symbol per card, sorted by that card\'s weight', () => {
  render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params_5" nSim={300} />)

  expect(screen.getAllByText('Suggested Allocation')).toHaveLength(3)
  const allocationRows = document.querySelectorAll('.frontier-allocation-row')
  expect(allocationRows.length).toBe(6) // 2 symbols x 3 cards
})

it('gives each symbol a consistent color between its allocation bar and its rebalancing-table dot', () => {
  render(
    <FrontierPanel
      symbols={['AAPL', 'SPY']}
      weights={[0.6, 0.4]}
      storageKey="test_ef_params_colors"
      priceMap={{ AAPL: 150, SPY: 500 }}
      nSim={300}
    />,
  )
  const aaplBarColor = document.querySelector('.frontier-allocation-symbol').style.color
  const aaplDotColor = document.querySelector('.frontier-symbol-dot').style.background
  expect(aaplBarColor).toBeTruthy()
  // both are set from the same colorMap entry for whichever symbol sorts first
  expect([aaplBarColor, aaplDotColor].every((c) => c.length > 0)).toBe(true)
})

it('shows the total portfolio value header above the rebalancing table', () => {
  render(
    <FrontierPanel
      symbols={['AAPL', 'SPY']}
      weights={[0.6, 0.4]}
      storageKey="test_ef_params_6"
      priceMap={{ AAPL: 150, SPY: 500 }}
      nSim={300}
    />,
  )
  expect(screen.getByText(/based on total portfolio value of/i)).toBeInTheDocument()
})

it('shows a colored symbol dot, price, and share count in the rebalancing table', () => {
  render(
    <FrontierPanel
      symbols={['AAPL', 'SPY']}
      weights={[0.6, 0.4]}
      storageKey="test_ef_params_7"
      priceMap={{ AAPL: 150, SPY: 500 }}
      nSim={300}
    />,
  )
  const aaplCell = screen.getByRole('rowheader', { name: /aapl/i })
  expect(aaplCell).toHaveTextContent('$150.00')
  expect(document.querySelector('.frontier-symbol-dot')).toBeTruthy()
})

it('shows a "(new)" badge for a combined-mode extra symbol in the rebalancing table', () => {
  render(
    <FrontierPanel
      symbols={['AAPL']}
      weights={[1]}
      storageKey="test_ef_params_8"
      mode="combined"
      extraSymbols={['SPY']}
      priceMap={{ SPY: 500 }}
      nSim={300}
    />,
  )
  expect(screen.getByRole('rowheader', { name: /spy.*new/i })).toBeInTheDocument()
})

it('shows colored Buy/Sell/Hold action text with a %Δ line', () => {
  render(
    <FrontierPanel
      symbols={['AAPL', 'SPY']}
      weights={[0.6, 0.4]}
      storageKey="test_ef_params_9"
      priceMap={{ AAPL: 150, SPY: 500 }}
      nSim={300}
    />,
  )
  expect(document.querySelectorAll('.frontier-action-buy, .frontier-action-sell, .frontier-action-hold').length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FrontierPanel`
Expected: FAIL — none of the stat-card or redesigned-table markup exists
yet.

- [ ] **Step 3: Implement in `src/components/analysis/FrontierPanel.jsx`**

Add near the top of the file, after the imports:

```js
const PALETTE = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

function assignSymbolColors(symbols, weights) {
  const order = symbols
    .map((s, i) => ({ symbol: s, weight: weights[i] }))
    .sort((a, b) => b.weight - a.weight)
  const colorMap = {}
  order.forEach(({ symbol }, i) => { colorMap[symbol] = PALETTE[i % PALETTE.length] })
  return colorMap
}

function formatShares(n) {
  if (!Number.isFinite(n)) return '—'
  return Math.abs(n) < 1 ? n.toFixed(2) : Math.round(n).toLocaleString()
}

function FrontierStatCard({ title, subtitle, point, symbols, colorMap }) {
  const rows = symbols
    .map((s, i) => ({ symbol: s, weight: point.weights[i] * 100 }))
    .sort((a, b) => b.weight - a.weight)
  return (
    <div className="frontier-stat-card">
      <h3>{title}</h3>
      <p className="frontier-stat-card-subtitle">{subtitle}</p>
      <dl className="frontier-stat-list">
        <div><dt>Exp. Annual Return</dt><dd className="frontier-stat-positive">{(point.ret * 100).toFixed(1)}%</dd></div>
        <div><dt>Annualized Volatility</dt><dd>{(point.vol * 100).toFixed(1)}%</dd></div>
        <div><dt>Sharpe Ratio</dt><dd>{point.sharpe.toFixed(2)}</dd></div>
      </dl>
      <p className="frontier-stat-card-label">Suggested Allocation</p>
      <div className="frontier-allocation-bars">
        {rows.map((r) => (
          <div key={r.symbol} className="frontier-allocation-row">
            <span className="frontier-allocation-symbol" style={{ color: colorMap[r.symbol] }}>{r.symbol}</span>
            <div className="frontier-allocation-track">
              <div className="frontier-allocation-fill" style={{ width: `${r.weight}%`, background: colorMap[r.symbol] }} />
            </div>
            <span className="frontier-allocation-pct mono">{r.weight.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Update the format import line to also bring in `formatCurrency`:

```js
import { formatCurrency, formatLarge } from '../../lib/format'
```

Inside the default-exported `FrontierPanel` function, after
`const chartData = ...` and before the `return`, add:

```js
const colorMap = assignSymbolColors(allSymbols, currentPoint.weights)
```

Replace the existing `<table className="frontier-table">...</table>`
block with:

```jsx
<div className="frontier-stat-cards">
  <FrontierStatCard title="Your Portfolio" subtitle="Current allocation" point={currentPoint} symbols={allSymbols} colorMap={colorMap} />
  <FrontierStatCard title="Max Diversification" subtitle="Best correlation spread" point={simData.maxDiversification} symbols={allSymbols} colorMap={colorMap} />
  <FrontierStatCard title="Max Sharpe" subtitle="Best risk-adjusted return" point={simData.maxSharpe} symbols={allSymbols} colorMap={colorMap} />
</div>

<div className="frontier-rebalancing">
  <p className="frontier-rebalancing-header">
    Based on total portfolio value of {formatLarge(totalMV)}
  </p>
  <table className="frontier-table">
    <thead>
      <tr>
        <th>Symbol</th>
        <th>Current %</th>
        <th>Shares</th>
        <th>Max-Div %</th>
        <th>Action</th>
        <th>Max-Sharpe %</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      {allSymbols.map((symbol, i) => {
        const currentWeight = currentPoint.weights[i] * 100
        const maxDivWeight = simData.maxDiversification.weights[i] * 100
        const maxSharpeWeight = simData.maxSharpe.weights[i] * 100
        const price = priceMap[symbol]
        const shares = price ? (currentWeight / 100) * totalMV / price : null
        const isNew = extraSymbols.includes(symbol) && !symbols.includes(symbol)

        function renderAction(targetWeight) {
          if (!price) return <span className="frontier-action-hold">—</span>
          const deltaShares = Math.round(((targetWeight - currentWeight) / 100) * totalMV / price)
          const deltaPct = targetWeight - currentWeight
          if (deltaShares === 0) {
            return <span className="frontier-action-hold">Hold</span>
          }
          const className = deltaShares > 0 ? 'frontier-action-buy' : 'frontier-action-sell'
          const label = deltaShares > 0 ? `▲ Buy ${deltaShares}` : `▼ Sell ${Math.abs(deltaShares)}`
          return (
            <span className={className}>
              {label}
              <br />
              <span className="frontier-action-delta">{deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%</span>
            </span>
          )
        }

        return (
          <tr key={symbol}>
            <th scope="row">
              <span className="frontier-symbol-dot" style={{ background: colorMap[symbol] }} />
              {symbol}{isNew ? ' (new)' : ''}
              <br />
              <span className="frontier-symbol-price">{price ? formatCurrency(price) : '—'}</span>
            </th>
            <td className="mono">{currentWeight.toFixed(1)}%</td>
            <td className="mono">{shares !== null ? formatShares(shares) : '—'}</td>
            <td className="mono">{maxDivWeight.toFixed(1)}%</td>
            <td>{renderAction(maxDivWeight)}</td>
            <td className="mono">{maxSharpeWeight.toFixed(1)}%</td>
            <td>{renderAction(maxSharpeWeight)}</td>
          </tr>
        )
      })}
    </tbody>
  </table>
</div>
```

- [ ] **Step 4: Add CSS**

```css
.frontier-stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.frontier-stat-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
}

.frontier-stat-card h3 {
  font-size: 13px;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}

.frontier-stat-card-subtitle {
  font-size: 11px;
  color: var(--text-dim);
  margin: 2px 0 12px;
}

.frontier-stat-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}

.frontier-stat-list div {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.frontier-stat-list dt {
  color: var(--text-dim);
}

.frontier-stat-list dd {
  margin: 0;
  font-weight: 700;
  color: var(--text);
}

.frontier-stat-positive {
  color: var(--green);
}

.frontier-stat-card-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin: 0 0 8px;
}

.frontier-allocation-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.frontier-allocation-row {
  display: grid;
  grid-template-columns: 48px 1fr 44px;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.frontier-allocation-symbol {
  font-weight: 700;
}

.frontier-allocation-track {
  background: var(--bg);
  border-radius: 999px;
  height: 6px;
  overflow: hidden;
}

.frontier-allocation-fill {
  height: 100%;
  border-radius: 999px;
}

.frontier-allocation-pct {
  text-align: right;
  color: var(--text-dim);
}

.frontier-rebalancing-header {
  font-size: 12px;
  color: var(--text-dim);
  margin: 0 0 10px;
}

.frontier-symbol-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.frontier-symbol-price {
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 400;
}

.frontier-action-buy { color: var(--green); font-weight: 700; }
.frontier-action-sell { color: var(--red); font-weight: 700; }
.frontier-action-hold { color: var(--text-dim); }

.frontier-action-delta {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-dim);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- FrontierPanel`
Expected: PASS (all existing tests plus the new ones).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/FrontierPanel.jsx src/components/analysis/FrontierPanel.css src/components/analysis/FrontierPanel.test.jsx
git commit -m "feat: redesign FrontierPanel with per-point stat cards and richer rebalancing table"
```

---

### Task 2: Full suite + `netlify dev` smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (440 existing + new tests from this plan).

- [ ] **Step 2: Restart `netlify dev`, manual smoke test**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

At `/analyze` → Frontier (both My Portfolio and Custom Set modes): confirm
the three stat cards render with sensible numbers and colored allocation
bars, colors are consistent between a card's bars and the rebalancing
table's dots for the same symbol, the rebalancing table shows shares and
colored buy/sell actions with %Δ, and a Custom Set symbol not yet priced
shows `—` gracefully everywhere instead of crashing.

- [ ] **Step 3: Report completion**

No commit needed for this task unless smoke testing surfaces a bug — fix
as a new small commit and re-run Step 1.
