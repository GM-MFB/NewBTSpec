# FrontierPanel Hoverable Curve Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let hovering anywhere on the Efficient Frontier curve (or the 3 fixed reference dots) show that point's per-symbol allocation, closing the gap where `chartData` currently discards each point's weight vector.

**Architecture:** `extractFrontier`'s points already carry `weights` — `FrontierPanel` just needs to stop stripping it when building `chartData`, add small visible dots to the curve, and swap the plain `<Tooltip>` for a custom-content one backed by a new exported `FrontierHoverTooltip` component (exported specifically so it can be unit-tested directly, since simulating real recharts hover in jsdom is unreliable).

**Tech Stack:** React 19, Vitest + @testing-library/react (existing stack, no new dependencies).

## Global Constraints

- No changes to `src/lib/efficientFrontier.js`.
- No buy/sell delta math in the hover tooltip — allocation percentages only.
- TDD throughout: failing test → implementation → passing test → commit.

---

### Task 1: Hoverable curve with allocation tooltip

**Files:**
- Modify: `src/components/analysis/FrontierPanel.jsx`
- Modify: `src/components/analysis/FrontierPanel.css`
- Modify: `src/components/analysis/FrontierPanel.test.jsx`

**Interfaces:**
- Produces: `export function FrontierHoverTooltip({ active, payload, symbols, colorMap })`
  — a recharts-compatible tooltip content component, exported for direct
  unit testing.

- [ ] **Step 1: Write the failing tests**

Add to `FrontierPanel.test.jsx`:

```jsx
import FrontierPanel, { FrontierHoverTooltip } from './FrontierPanel'
```

(update the existing default-only import at the top of the file to also
bring in the named export)

```jsx
describe('FrontierHoverTooltip', () => {
  const colorMap = { AAPL: '#3987e5', SPY: '#d95926', TLT: '#199e70' }

  it('renders nothing when inactive', () => {
    const { container } = render(
      <FrontierHoverTooltip active={false} payload={[]} symbols={['AAPL', 'SPY']} colorMap={colorMap} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the payload has no weights', () => {
    const payload = [{ payload: { vol: 12, ret: 8 } }]
    const { container } = render(
      <FrontierHoverTooltip active payload={payload} symbols={['AAPL', 'SPY']} colorMap={colorMap} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the Return/Vol header and a sorted, filtered allocation list', () => {
    const payload = [{ payload: { vol: 12.34, ret: 8.9, weights: [0.003, 0.6, 0.397] } }]
    render(<FrontierHoverTooltip active payload={payload} symbols={['AAPL', 'SPY', 'TLT']} colorMap={colorMap} />)

    expect(screen.getByText(/return 8\.9%/i)).toBeInTheDocument()
    expect(screen.getByText(/vol 12\.3%/i)).toBeInTheDocument()
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument() // 0.3% filtered out
    const symbolEls = screen.getAllByText(/^(SPY|TLT)$/)
    expect(symbolEls.map((el) => el.textContent)).toEqual(['SPY', 'TLT']) // sorted by weight desc
  })

  it('renders a title line when the point has a label', () => {
    const payload = [{ payload: { vol: 10, ret: 5, weights: [1, 0, 0], label: 'Your Portfolio' } }]
    render(<FrontierHoverTooltip active payload={payload} symbols={['AAPL', 'SPY', 'TLT']} colorMap={colorMap} />)
    expect(screen.getByText('Your Portfolio')).toBeInTheDocument()
  })
})

it('keeps each frontier point\'s weights available for the hover tooltip', () => {
  render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params_hover" nSim={300} />)
  // smoke check: rendering doesn't crash now that chartData/Scatter data carry weights
  expect(screen.getAllByText('Your Portfolio').length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FrontierPanel`
Expected: FAIL — `FrontierHoverTooltip` isn't exported yet.

- [ ] **Step 3: Implement in `src/components/analysis/FrontierPanel.jsx`**

Add the exported tooltip component near `FrontierStatCard`:

```jsx
export function FrontierHoverTooltip({ active, payload, symbols, colorMap }) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  if (!point.weights) return null
  const rows = symbols
    .map((s, i) => ({ symbol: s, weight: point.weights[i] * 100 }))
    .filter((r) => r.weight > 0.5)
    .sort((a, b) => b.weight - a.weight)
  return (
    <div className="frontier-hover-tooltip">
      {point.label && <p className="frontier-hover-tooltip-title">{point.label}</p>}
      <p className="frontier-hover-tooltip-stats">Return {point.ret.toFixed(1)}% · Vol {point.vol.toFixed(1)}%</p>
      <ul className="frontier-hover-tooltip-list">
        {rows.map((r) => (
          <li key={r.symbol}>
            <span className="frontier-hover-tooltip-symbol" style={{ color: colorMap[r.symbol] }}>{r.symbol}</span>
            <span className="mono">{r.weight.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Update `chartData` to keep `weights`:

```js
const chartData = simData.frontier.map((p) => ({ vol: p.vol * 100, ret: p.ret * 100, weights: p.weights }))
```

Update the three reference `Scatter` data objects to carry `weights` and
`label`, and swap the plain `Line`/`Tooltip` for the hoverable versions:

```jsx
<Tooltip content={(props) => <FrontierHoverTooltip {...props} symbols={allSymbols} colorMap={colorMap} />} />
<Legend wrapperStyle={{ fontSize: 11, color: '#888' }} />
<Line type="monotone" dataKey="ret" data={chartData} name="Efficient Frontier" stroke="#898781" strokeWidth={2} dot={{ r: 2, fill: '#898781' }} />
<Scatter name="Your Portfolio" data={[{ vol: currentPoint.vol * 100, ret: currentPoint.ret * 100, weights: currentPoint.weights, label: 'Your Portfolio' }]} fill="#3987e5" />
<Scatter name="Max Diversification" data={[{ vol: simData.maxDiversification.vol * 100, ret: simData.maxDiversification.ret * 100, weights: simData.maxDiversification.weights, label: 'Max Diversification' }]} fill="#d95926" />
<Scatter name="Max Sharpe" data={[{ vol: simData.maxSharpe.vol * 100, ret: simData.maxSharpe.ret * 100, weights: simData.maxSharpe.weights, label: 'Max Sharpe' }]} fill="#199e70" />
```

Remove the now-unused `contentStyle`/`itemStyle`/`labelStyle` props from
the old `<Tooltip>` element (replaced entirely by the `content` prop
above).

- [ ] **Step 4: Add CSS**

```css
.frontier-hover-tooltip {
  background: #141414;
  border: 1px solid #262626;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  min-width: 140px;
}

.frontier-hover-tooltip-title {
  font-weight: 700;
  color: #e5e5e5;
  margin: 0 0 4px;
}

.frontier-hover-tooltip-stats {
  color: #888;
  margin: 0 0 6px;
  font-size: 11px;
}

.frontier-hover-tooltip-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.frontier-hover-tooltip-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #e5e5e5;
}

.frontier-hover-tooltip-symbol {
  font-weight: 700;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- FrontierPanel`
Expected: PASS (all existing tests plus the new `FrontierHoverTooltip`
tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/FrontierPanel.jsx src/components/analysis/FrontierPanel.css src/components/analysis/FrontierPanel.test.jsx
git commit -m "feat: add hoverable allocation tooltip to the Efficient Frontier curve"
```

---

### Task 2: Full suite + `netlify dev` smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (447 existing + new tests from this task).

- [ ] **Step 2: Restart `netlify dev`, manual smoke test**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

At `/analyze` → Frontier: hover several different spots along the curve
and confirm the tooltip shows a sensible allocation breakdown at each;
hover the 3 fixed reference dots and confirm they show their name plus
the same allocation-list style.

- [ ] **Step 3: Report completion**

No commit needed for this task unless smoke testing surfaces a bug — fix
as a new small commit and re-run Step 1.
