# Risk Tab Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Risk tab (`RiskTab.jsx`) so its beta, VaR, HHI, diversification score, stop-loss coverage, and stress tests all account for open option positions (currently invisible to all of them), sized by collateral/max-loss rather than a priced options model, plus a new "Options Risk" table.

**Architecture:** Reuse the existing `collateralFor()`/`effectiveStrategyDef()` option-valuation pattern (already used by `src/lib/portfolioWeights.js` for the Frontier panel). Add one new lib function (`optionsCapitalAtRisk`) for long-option/covered-call sizing that `collateralFor` deliberately doesn't cover. Extend two existing `efficientFrontier.js` risk functions (`getPortfolioRiskMetrics`, `getStressTests`) to be option-aware without breaking their existing stock-only call sites. Rewrite `RiskTab.jsx`'s position derivation to build a combined stock+option position list, and add a new "Options Risk" section.

**Tech Stack:** React 19, Vitest + @testing-library/react + @testing-library/user-event, plain CSS (no framework).

## Global Constraints

- No options pricing model (Black-Scholes, greeks, implied vol) — sizing is collateral/max-loss only, per the spec.
- Bonds stay unhandled/$0-weighted — out of scope.
- Stop Loss Protection stays scoped to Stock/ETF/Crypto only — options get their own bounded-risk section instead.
- The existing 4 tests in `RiskTab.test.jsx` (hero tiles, <80% coverage warning, 6 expandable stress scenarios, Risk Contribution rows) use Stock/ETF-only fixtures and must keep passing unchanged throughout — they are the non-regression check.
- Database schema (`database-reference.md`) is not touched by this plan — no new columns, no migrations.

---

### Task 1: `optionsCapitalAtRisk()` in `optionMath.js`

**Files:**
- Modify: `src/lib/optionMath.js`
- Test: `src/lib/optionMath.test.js`

**Interfaces:**
- Consumes: nothing new — uses the existing `collateralFor(investment, strategyDef)` already exported from this file, and the `strategyDef` shape produced by `effectiveStrategyDef()` in `src/lib/optionStrategies.js` (`{ value, label, optionType, optionDirection, isSpread }`).
- Produces: `optionsCapitalAtRisk(investment, strategyDef) → number`. Short non-covered-call → `collateralFor()`'s value (coerced to a number, `''` becomes `0`). Covered call → `0`. Long call/put → `Number(investment.avgCost) * 100 * Number(investment.shares)` (premium paid), or `0` if `avgCost`/`shares` are missing. This is what Task 4 uses to build the Options Risk table and what Task 6 passes into `getStressTests` as each option position's `capitalAtRisk`.

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `src/lib/optionMath.test.js` (the file already imports `describe, it, expect` from `vitest`, `collateralFor, potentialPnlFor` from `./optionMath`, and `strategyByValue` from `./optionStrategies` — add `optionsCapitalAtRisk` to the existing import line):

```js
import { collateralFor, potentialPnlFor, optionsCapitalAtRisk } from './optionMath'
```

```js
describe('optionsCapitalAtRisk', () => {
  it('returns collateral for a short cash secured put', () => {
    const investment = { shares: 2, strike: 380 }
    expect(optionsCapitalAtRisk(investment, strategyByValue('cash_secured_put'))).toBe(76000)
  })

  it('returns collateral for a credit spread', () => {
    const investment = { shares: 1, strike: 36, strike2: 35 }
    expect(optionsCapitalAtRisk(investment, strategyByValue('put_credit_spread'))).toBe(100)
  })

  it('returns 0 for a covered call', () => {
    const investment = { shares: 1, strike: 450 }
    expect(optionsCapitalAtRisk(investment, strategyByValue('covered_call'))).toBe(0)
  })

  it('returns premium paid (contracts x price x 100) for a long call', () => {
    const investment = { shares: 3, avgCost: 2.5 }
    expect(optionsCapitalAtRisk(investment, strategyByValue('call'))).toBe(750)
  })

  it('returns premium paid for a long put', () => {
    const investment = { shares: 1, avgCost: 4 }
    expect(optionsCapitalAtRisk(investment, strategyByValue('put'))).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/optionMath.test.js`
Expected: FAIL — `optionsCapitalAtRisk is not a function` (or similar import error).

- [ ] **Step 3: Implement `optionsCapitalAtRisk`**

Add to `src/lib/optionMath.js`, after the existing `potentialPnlFor` function:

```js
export function optionsCapitalAtRisk(investment, strategyDef) {
  if (!strategyDef) return 0
  if (strategyDef.optionDirection === 'short') {
    if (strategyDef.value === 'covered_call') return 0
    return Number(collateralFor(investment, strategyDef)) || 0
  }
  const contracts = Number(investment.shares)
  const price = Number(investment.avgCost)
  if (!contracts || !price) return 0
  return contracts * price * 100
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/optionMath.test.js`
Expected: PASS (10 tests total — 5 existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/optionMath.js src/lib/optionMath.test.js
git commit -m "feat: add optionsCapitalAtRisk for long-option/covered-call sizing"
```

---

### Task 2: Scope stop-loss coverage to non-option positions in `getPortfolioRiskMetrics`

**Files:**
- Modify: `src/lib/efficientFrontier.js` (the `getPortfolioRiskMetrics` function, currently lines 205-231)
- Test: `src/lib/efficientFrontier.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `getPortfolioRiskMetrics(positions)` unchanged return shape (`{ hhi, diversificationScore, stopCoveragePct, dollarAtRisk, totalMV, expectedReturn, volatility, beta, var95 }`), but now reads an optional `assetType` field per position — when `assetType === 'Option'`, that position is excluded from the `stopCoveragePct`/`dollarAtRisk` calculation only (HHI/beta/volatility/totalMV still use every position, unchanged). Positions without an `assetType` field (all existing call sites/tests) behave exactly as before, since `undefined !== 'Option'` keeps them included. Task 4 relies on this to pass a combined stock+option list without the stop-coverage percentage being diluted by positions that can never have a stop.

- [ ] **Step 1: Write the failing test**

Add to the existing `describe('getPortfolioRiskMetrics', ...)` block in `src/lib/efficientFrontier.test.js` (it already has a `positions` const with AAPL/SPY at the top of the block — add this test after the existing three):

```js
  it('excludes option positions from the stop-coverage denominator', () => {
    const withOption = [
      ...positions,
      { symbol: 'MSFT', assetType: 'Option', weight: 0, marketValue: 0, currentPrice: undefined, stopLoss: null, shares: undefined },
    ]
    const metrics = getPortfolioRiskMetrics(withOption)
    expect(metrics.stopCoveragePct).toBe(50)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/efficientFrontier.test.js -t "excludes option positions"`
Expected: FAIL — with the option row counted in the denominator, `stopCoveragePct` would be `33.33...` (1 of 3) instead of `50` (1 of 2).

- [ ] **Step 3: Implement the scoping fix**

In `src/lib/efficientFrontier.js`, replace the current stop-coverage block inside `getPortfolioRiskMetrics`:

```js
  const withStop = positions.filter((p) => p.stopLoss)
  const stopCoveragePct = positions.length > 0 ? (withStop.length / positions.length) * 100 : 0
  const dollarAtRisk = positions.reduce((sum, p) => {
    if (!p.stopLoss || p.stopLoss >= p.currentPrice) return sum
    return sum + Math.max(0, p.currentPrice - p.stopLoss) * p.shares
  }, 0)
```

with:

```js
  const stopEligible = positions.filter((p) => p.assetType !== 'Option')
  const withStop = stopEligible.filter((p) => p.stopLoss)
  const stopCoveragePct = stopEligible.length > 0 ? (withStop.length / stopEligible.length) * 100 : 0
  const dollarAtRisk = stopEligible.reduce((sum, p) => {
    if (!p.stopLoss || p.stopLoss >= p.currentPrice) return sum
    return sum + Math.max(0, p.currentPrice - p.stopLoss) * p.shares
  }, 0)
```

Everything below this block (`totalMV`, `symbols`, `weights`, `portfolioStats`, `beta`, `var95`, the final `return`) stays exactly as-is — it already uses the full `positions` array.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/efficientFrontier.test.js`
Expected: PASS (all existing `getPortfolioRiskMetrics` tests plus the new one).

- [ ] **Step 5: Commit**

```bash
git add src/lib/efficientFrontier.js src/lib/efficientFrontier.test.js
git commit -m "fix: exclude option positions from stop-loss coverage denominator"
```

---

### Task 3: Extend `getStressTests` with a binary bounded option rule

**Files:**
- Modify: `src/lib/efficientFrontier.js` (the `getStressTests` function, currently lines 263-277)
- Test: `src/lib/efficientFrontier.test.js`

**Interfaces:**
- Consumes: `optionsCapitalAtRisk` is NOT called here — the caller (Task 6, in `RiskTab.jsx`) pre-computes each option position's `capitalAtRisk` (via Task 1's function) and passes it in on each `optionPositions` entry.
- Produces: `getStressTests(positions, optionPositions = [])`. `positions` keeps its existing shape/behavior (stock/ETF/crypto, beta-weighted, unchanged for existing callers that omit the second argument). Each entry of the new `optionPositions` array must have `{ symbol, optionType, optionDirection, capitalAtRisk }`. Return shape per scenario gains one new field: `totalImpact` (the sum of every row's `impact`, stock and option combined) — Task 6 uses this to replace the old `portfolioMove * totalMV` header calculation. `perPosition` rows contributed by `optionPositions` have `beta: null` and `move: null` (Task 6 renders these as `—`) and are merged into the same sorted array as the stock rows.

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe('getStressTests', ...)` block in `src/lib/efficientFrontier.test.js`, after its existing two tests:

```js
  describe('with option positions', () => {
    const stockPositions = [{ symbol: 'SPY', weight: 1, marketValue: 10000 }]

    it('shows full capital-at-risk impact for a long call in down-move scenarios, $0 in Bull Run', () => {
      const optionPositions = [{ symbol: 'AAPL', optionType: 'call', optionDirection: 'long', capitalAtRisk: 500 }]
      const results = getStressTests(stockPositions, optionPositions)
      const bullRun = results.find((r) => r.name === 'Bull Run')
      const correction = results.find((r) => r.name === 'Correction')
      expect(bullRun.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(0)
      expect(correction.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(-500)
    })

    it('shows full capital-at-risk impact for a long put in Bull Run, $0 in down-move scenarios', () => {
      const optionPositions = [{ symbol: 'AAPL', optionType: 'put', optionDirection: 'long', capitalAtRisk: 400 }]
      const results = getStressTests(stockPositions, optionPositions)
      const bullRun = results.find((r) => r.name === 'Bull Run')
      const crash = results.find((r) => r.name === 'Crash')
      expect(bullRun.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(-400)
      expect(crash.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(0)
    })

    it('shows full capital-at-risk impact for a short cash secured put in down-move scenarios', () => {
      const optionPositions = [{ symbol: 'AAPL', optionType: 'put', optionDirection: 'short', capitalAtRisk: 38000 }]
      const results = getStressTests(stockPositions, optionPositions)
      const bearMarket = results.find((r) => r.name === 'Bear Market')
      expect(bearMarket.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(-38000)
    })

    it('shows full capital-at-risk impact for a call credit spread in Bull Run', () => {
      const optionPositions = [{ symbol: 'AAPL', optionType: 'call', optionDirection: 'short', capitalAtRisk: 100 }]
      const results = getStressTests(stockPositions, optionPositions)
      const bullRun = results.find((r) => r.name === 'Bull Run')
      const correction = results.find((r) => r.name === 'Correction')
      expect(bullRun.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(-100)
      expect(correction.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(0)
    })

    it('shows $0 impact for a covered call in every scenario', () => {
      const optionPositions = [{ symbol: 'AAPL', optionType: 'call', optionDirection: 'short', capitalAtRisk: 0 }]
      const results = getStressTests(stockPositions, optionPositions)
      for (const scenario of results) {
        expect(scenario.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(0)
      }
    })

    it('sets totalImpact to the sum of all perPosition impacts including options', () => {
      const optionPositions = [{ symbol: 'AAPL', optionType: 'call', optionDirection: 'long', capitalAtRisk: 500 }]
      const results = getStressTests(stockPositions, optionPositions)
      for (const scenario of results) {
        const expectedTotal = scenario.perPosition.reduce((sum, p) => sum + p.impact, 0)
        expect(scenario.totalImpact).toBeCloseTo(expectedTotal, 6)
      }
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/efficientFrontier.test.js -t "with option positions"`
Expected: FAIL — `getStressTests` doesn't accept a second argument yet, so `scenario.totalImpact` is `undefined` and option rows never appear in `perPosition`.

- [ ] **Step 3: Implement the option-aware stress test rule**

In `src/lib/efficientFrontier.js`, add a helper directly above `getStressTests` (which currently starts at line 263):

```js
function optionAdverseSign(optionType, optionDirection) {
  if (optionType === 'call') return optionDirection === 'long' ? -1 : 1
  return optionDirection === 'long' ? 1 : -1
}
```

Then replace the body of `getStressTests`:

```js
export function getStressTests(positions) {
  return STRESS_SCENARIOS.map((scenario) => {
    const perPosition = positions.map((p) => {
      const params = getAssetParams(p.symbol)
      const beta = (params.s * getCorrelation(p.symbol, 'SPY')) / SPY_VOL
      const move = beta * scenario.move
      const impact = move * p.marketValue
      return { symbol: p.symbol, beta, move, impact }
    })
    const totalMV = positions.reduce((sum, p) => sum + p.marketValue, 0)
    const weightedBeta = positions.reduce((sum, p, i) => sum + (p.marketValue / totalMV) * perPosition[i].beta, 0)
    const portfolioMove = weightedBeta * scenario.move
    return { name: scenario.name, marketMove: scenario.move, portfolioMove, perPosition: perPosition.sort((a, b) => a.impact - b.impact) }
  })
}
```

with:

```js
export function getStressTests(positions, optionPositions = []) {
  return STRESS_SCENARIOS.map((scenario) => {
    const perPosition = positions.map((p) => {
      const params = getAssetParams(p.symbol)
      const beta = (params.s * getCorrelation(p.symbol, 'SPY')) / SPY_VOL
      const move = beta * scenario.move
      const impact = move * p.marketValue
      return { symbol: p.symbol, beta, move, impact }
    })
    const optionImpacts = optionPositions.map((p) => {
      const hurt = Math.sign(scenario.move) === optionAdverseSign(p.optionType, p.optionDirection)
      return { symbol: p.symbol, beta: null, move: null, impact: hurt ? -p.capitalAtRisk : 0 }
    })
    const combined = [...perPosition, ...optionImpacts]
    const totalMV = positions.reduce((sum, p) => sum + p.marketValue, 0)
    const weightedBeta = positions.reduce((sum, p, i) => sum + (p.marketValue / totalMV) * perPosition[i].beta, 0)
    const portfolioMove = weightedBeta * scenario.move
    const totalImpact = combined.reduce((sum, p) => sum + p.impact, 0)
    return { name: scenario.name, marketMove: scenario.move, portfolioMove, totalImpact, perPosition: combined.sort((a, b) => a.impact - b.impact) }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/efficientFrontier.test.js`
Expected: PASS (all existing `getStressTests` tests plus the 6 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/efficientFrontier.js src/lib/efficientFrontier.test.js
git commit -m "feat: extend getStressTests with a bounded option impact rule"
```

---

### Task 4: Combined stock+option position model in `RiskTab.jsx`

**Files:**
- Modify: `src/components/analysis/RiskTab.jsx` (currently lines 1-41 — imports and the position-derivation block, through the `getPortfolioRiskMetrics`/`largestWeight` lines)
- Modify: `src/components/analysis/RiskTab.css`
- Test: `src/components/analysis/RiskTab.test.jsx`

**Interfaces:**
- Consumes: `effectiveStrategyDef` from `src/lib/optionStrategies.js`, `optionsCapitalAtRisk` from `src/lib/optionMath.js` (Task 1), the updated `getPortfolioRiskMetrics` from Task 2.
- Produces: two module-scope-shaped variables inside the component — `stockPositions` (unchanged shape: `{ symbol, assetType, marketValue, currentPrice, stopLoss, shares }`, now including an explicit `assetType` field it didn't have before) and `optionPositions` (`{ symbol, assetType: 'Option', strategyLabel, optionType, optionDirection, contracts, capitalAtRisk, marketValue }`, where `marketValue` mirrors `capitalAtRisk` so it folds into the same totals). `withWeights` becomes the concatenation of both, weighted against their combined total. Task 5 reads `optionPositions` to render the Options Risk table; Task 6 reads the `assetType` field to split `withWeights` before calling `getStressTests`.

- [ ] **Step 1: Write the failing test**

Add to `src/components/analysis/RiskTab.test.jsx`, after the existing 4 `it(...)` blocks (still inside the top-level `describe('RiskTab', ...)`):

```js
  it('shows a caption noting options have a defined max loss instead of a stop', () => {
    render(<RiskTab investments={investments} />)
    expect(screen.getByText(/options have a defined max loss/i)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/analysis/RiskTab.test.jsx -t "defined max loss"`
Expected: FAIL — no such text exists in the current component.

- [ ] **Step 3: Rewrite the position-derivation block**

In `src/components/analysis/RiskTab.jsx`, replace the imports at the top:

```js
import { useState } from 'react'
import './RiskTab.css'
import { getPortfolioRiskMetrics, getStressTests, getRiskContribution } from '../../lib/efficientFrontier'
import { formatCurrency } from '../../lib/format'
```

with:

```js
import { useState } from 'react'
import './RiskTab.css'
import { getPortfolioRiskMetrics, getStressTests, getRiskContribution } from '../../lib/efficientFrontier'
import { optionsCapitalAtRisk } from '../../lib/optionMath'
import { effectiveStrategyDef } from '../../lib/optionStrategies'
import { formatCurrency } from '../../lib/format'
```

Replace the position-derivation block (currently the `const positions = ...` through `const riskContributions = ...` lines, right after the `export default function RiskTab({ investments }) {` line and the `expandedScenario` state line):

```js
  const positions = investments
    .filter((i) => ['Stock', 'ETF', 'Crypto'].includes(i.assetType))
    .map((i) => {
      const marketValue = i.shares * i.currentPrice
      return { symbol: i.symbol, marketValue, currentPrice: i.currentPrice, stopLoss: i.stopLoss || null, shares: i.shares }
    })

  const totalMV = positions.reduce((sum, p) => sum + p.marketValue, 0)
  const withWeights = positions.map((p) => ({ ...p, weight: totalMV > 0 ? p.marketValue / totalMV : 0 }))

  const metrics = getPortfolioRiskMetrics(withWeights)
  const largestWeight = Math.max(...withWeights.map((p) => p.weight), 0)
  const stressTests = getStressTests(withWeights)
  const riskContributions = getRiskContribution(withWeights)
```

with:

```js
  const stockPositions = investments
    .filter((i) => ['Stock', 'ETF', 'Crypto'].includes(i.assetType))
    .map((i) => {
      const marketValue = i.shares * i.currentPrice
      return { symbol: i.symbol, assetType: i.assetType, marketValue, currentPrice: i.currentPrice, stopLoss: i.stopLoss || null, shares: i.shares }
    })

  const optionPositions = investments
    .filter((i) => i.assetType === 'Option')
    .map((i) => {
      const strategyDef = effectiveStrategyDef(i)
      const capitalAtRisk = optionsCapitalAtRisk(i, strategyDef)
      return {
        symbol: i.symbol,
        assetType: 'Option',
        strategyLabel: strategyDef?.label ?? 'Option',
        optionType: strategyDef?.optionType,
        optionDirection: strategyDef?.optionDirection,
        contracts: i.shares,
        capitalAtRisk,
        marketValue: capitalAtRisk,
      }
    })

  const positions = [...stockPositions, ...optionPositions]
  const totalMV = positions.reduce((sum, p) => sum + p.marketValue, 0)
  const withWeights = positions.map((p) => ({ ...p, weight: totalMV > 0 ? p.marketValue / totalMV : 0 }))

  const metrics = getPortfolioRiskMetrics(withWeights)
  const largestWeight = Math.max(...withWeights.map((p) => p.weight), 0)
  const stressTests = getStressTests(withWeights)
  const riskContributions = getRiskContribution(withWeights)
```

(Task 6 will revisit the `getStressTests(withWeights)` line to split it into two arguments — leave it as-is for this task so the existing stress-test tests keep passing in the meantime.)

Now update the "Stop Loss Protection" section (find `<section className="risk-stoploss">`) to use `stockPositions` for the coverage counts (matches the metrics scoping from Task 2) and add the new caption. Replace:

```jsx
      <section className="risk-stoploss">
        <h2>Stop Loss Protection</h2>
        <p>{withWeights.filter((p) => p.stopLoss).length} / {withWeights.length} positions have a stop set</p>
        <p>$ at risk if all stops hit: {formatCurrency(metrics.dollarAtRisk)}</p>
        {metrics.stopCoveragePct < 80 && (
          <p className="risk-warning">Stop coverage is below 80% — consider setting stops on more positions.</p>
        )}
      </section>
```

with:

```jsx
      <section className="risk-stoploss">
        <h2>Stop Loss Protection</h2>
        <p>{stockPositions.filter((p) => p.stopLoss).length} / {stockPositions.length} positions have a stop set</p>
        <p>$ at risk if all stops hit: {formatCurrency(metrics.dollarAtRisk)}</p>
        {metrics.stopCoveragePct < 80 && (
          <p className="risk-warning">Stop coverage is below 80% — consider setting stops on more positions.</p>
        )}
        <p className="risk-caption">Options have a defined max loss instead of a stop — see Options Risk below.</p>
      </section>
```

Add to `src/components/analysis/RiskTab.css`, after the `.risk-warning` rule:

```css
.risk-caption {
  color: var(--text-dim);
  font-size: 12px;
  margin-top: 4px;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/analysis/RiskTab.test.jsx`
Expected: PASS — all 4 original tests plus the new caption test (5 total). The original 4 must pass unchanged since the `investments` fixture in this test file has no `Option` positions, so `optionPositions` is `[]` and `stockPositions`/`positions`/`withWeights` behave identically to the old single `positions` array.

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis/RiskTab.jsx src/components/analysis/RiskTab.css src/components/analysis/RiskTab.test.jsx
git commit -m "feat: build a combined stock+option position model in RiskTab"
```

---

### Task 5: "Options Risk" section

**Files:**
- Modify: `src/components/analysis/RiskTab.jsx` (insert a new section between `risk-stoploss` and `risk-stress`)
- Modify: `src/components/analysis/RiskTab.css`
- Test: `src/components/analysis/RiskTab.test.jsx`

**Interfaces:**
- Consumes: `optionPositions` and `metrics.totalMV` from Task 4.
- Produces: nothing new consumed by later tasks — this is a leaf UI section.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/analysis/RiskTab.test.jsx`, after the caption test added in Task 4:

```js
  it('shows a "No open option positions" note when there are no option positions', () => {
    render(<RiskTab investments={investments} />)
    expect(screen.getByText(/no open option positions/i)).toBeInTheDocument()
  })

  it('renders an Options Risk row with capital at risk for a short cash secured put', () => {
    const withOption = [
      ...investments,
      { symbol: 'MSFT', assetType: 'Option', shares: 2, avgCost: 3.5, strategy: 'cash_secured_put', strike: 130 },
    ]
    render(<RiskTab investments={withOption} />)
    expect(screen.getByText('Cash Secured Put')).toBeInTheDocument()
    expect(screen.getByText('$26,000.00')).toBeInTheDocument()
    expect(screen.getByTestId('options-total-risk')).toHaveTextContent('$26,000.00')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/analysis/RiskTab.test.jsx -t "Options Risk"`
Expected: FAIL — no "Options Risk" section exists yet, so neither the empty-state text nor the option row/testid are found.

- [ ] **Step 3: Add the section**

In `src/components/analysis/RiskTab.jsx`, insert a new section directly after the closing `</section>` of `risk-stoploss` and before `<section className="risk-stress">`:

```jsx
      <section className="risk-options">
        <h2>Options Risk</h2>
        {optionPositions.length === 0 ? (
          <p>No open option positions.</p>
        ) : (
          <>
            <table className="risk-table">
              <thead>
                <tr><th>Symbol</th><th>Strategy</th><th>Contracts</th><th>Capital at Risk</th><th>% of Portfolio</th></tr>
              </thead>
              <tbody>
                {optionPositions.map((p, idx) => (
                  <tr key={`${p.symbol}-${idx}`}>
                    <th scope="row">{p.symbol}</th>
                    <td className="mono">{p.strategyLabel}</td>
                    <td className="mono">{p.contracts}</td>
                    <td className="mono">{p.capitalAtRisk > 0 ? formatCurrency(p.capitalAtRisk) : 'Covered'}</td>
                    <td className="mono">{(metrics.totalMV > 0 ? (p.capitalAtRisk / metrics.totalMV) * 100 : 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p data-testid="options-total-risk">
              Total Options Capital at Risk: {formatCurrency(optionPositions.reduce((sum, p) => sum + p.capitalAtRisk, 0))}
              {' '}({(metrics.totalMV > 0 ? (optionPositions.reduce((sum, p) => sum + p.capitalAtRisk, 0) / metrics.totalMV) * 100 : 0).toFixed(1)}% of portfolio)
            </p>
          </>
        )}
      </section>
```

Add to `src/components/analysis/RiskTab.css`, extending the existing header-styling selector list from:

```css
.risk-concentration h2, .risk-stoploss h2 {
```

to:

```css
.risk-concentration h2, .risk-stoploss h2, .risk-options h2 {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/analysis/RiskTab.test.jsx`
Expected: PASS — all 7 tests so far (4 original + caption + 2 new Options Risk tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis/RiskTab.jsx src/components/analysis/RiskTab.css src/components/analysis/RiskTab.test.jsx
git commit -m "feat: add Options Risk section to RiskTab"
```

---

### Task 6: Wire Stress Tests to option positions

**Files:**
- Modify: `src/components/analysis/RiskTab.jsx` (the `stressTests` derivation from Task 4, and the `risk-stress` JSX section)
- Test: `src/components/analysis/RiskTab.test.jsx`

**Interfaces:**
- Consumes: Task 3's `getStressTests(positions, optionPositions)` two-argument form and `totalImpact` field; Task 4's `withWeights` (filtered by `assetType`).
- Produces: nothing new consumed elsewhere — this is the last task.

- [ ] **Step 1: Write the failing test**

Add to `src/components/analysis/RiskTab.test.jsx`, after the Task 5 tests:

```js
  it('includes an option position in an expanded stress scenario with a bounded impact', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const withOption = [
      ...investments,
      { symbol: 'MSFT', assetType: 'Option', shares: 2, avgCost: 3.5, strategy: 'cash_secured_put', strike: 130 },
    ]
    render(<RiskTab investments={withOption} />)

    await userEvent.click(screen.getByText(/^Bear Market/))

    // MSFT also appears in the always-rendered Options Risk table, so scope
    // the query to the expanded stress scenario's own table.
    const table = screen.getByTestId('stress-scenario-table')
    const msftRow = within(table).getByText('MSFT').closest('tr')
    expect(msftRow).toHaveTextContent('-$26,000.00')
    expect(msftRow).toHaveTextContent('—')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/analysis/RiskTab.test.jsx -t "bounded impact"`
Expected: FAIL — two problems: `getStressTests` is still being called with only `withWeights` (all positions, including the option, being treated as a stock-style beta row), and `screen.getByTestId('stress-scenario-table')` doesn't exist yet.

Add `within` to the existing `@testing-library/react` import at the top of the test file:

```js
import { render, screen, within } from '@testing-library/react'
```

- [ ] **Step 3: Wire the split call, add a table testid, and render `—` for null beta/move**

In `src/components/analysis/RiskTab.jsx`, replace the single line (added in Task 4):

```js
  const stressTests = getStressTests(withWeights)
```

with:

```js
  const stressTests = getStressTests(
    withWeights.filter((p) => p.assetType !== 'Option'),
    withWeights.filter((p) => p.assetType === 'Option'),
  )
```

Then update the stress test rendering. Replace the scenario header button's text and the expanded table's row markup — find:

```jsx
            <button type="button" onClick={() => setExpandedScenario(expandedScenario === scenario.name ? null : scenario.name)}>
              {scenario.name} ({(scenario.portfolioMove * 100).toFixed(1)}%, {formatCurrency(scenario.portfolioMove * metrics.totalMV)})
            </button>
            {expandedScenario === scenario.name && (
              <table className="risk-table">
                <thead><tr><th>Symbol</th><th>Beta</th><th>Move %</th><th>$ Impact</th></tr></thead>
                <tbody>
                  {scenario.perPosition.map((p) => (
                    <tr key={p.symbol}>
                      <th scope="row">{p.symbol}</th>
                      <td className="mono">{p.beta.toFixed(2)}</td>
                      <td className="mono">{(p.move * 100).toFixed(1)}%</td>
                      <td className="mono">{formatCurrency(p.impact)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
```

with:

```jsx
            <button type="button" onClick={() => setExpandedScenario(expandedScenario === scenario.name ? null : scenario.name)}>
              {scenario.name} ({(scenario.portfolioMove * 100).toFixed(1)}%, {formatCurrency(scenario.totalImpact)})
            </button>
            {expandedScenario === scenario.name && (
              <table className="risk-table" data-testid="stress-scenario-table">
                <thead><tr><th>Symbol</th><th>Beta</th><th>Move %</th><th>$ Impact</th></tr></thead>
                <tbody>
                  {scenario.perPosition.map((p, idx) => (
                    <tr key={`${p.symbol}-${idx}`}>
                      <th scope="row">{p.symbol}</th>
                      <td className="mono">{p.beta === null ? '—' : p.beta.toFixed(2)}</td>
                      <td className="mono">{p.move === null ? '—' : `${(p.move * 100).toFixed(1)}%`}</td>
                      <td className="mono">{formatCurrency(p.impact)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/analysis/RiskTab.test.jsx`
Expected: PASS — all 8 tests, including the 4 original non-regression tests (their fixture has no option positions, so `withWeights.filter((p) => p.assetType === 'Option')` is `[]`, matching Task 3's default-argument behavior exactly).

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions anywhere else in the app (nothing outside `RiskTab.jsx`/`efficientFrontier.js`/`optionMath.js` and their own test files was touched, and every change to shared functions was verified backward-compatible in Tasks 2 and 3).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/RiskTab.jsx src/components/analysis/RiskTab.test.jsx
git commit -m "feat: include option positions in RiskTab stress test scenarios"
```

---

## Manual Verification (after all tasks)

Restart the dev server and smoke-test in the browser:

```bash
taskkill //F //IM node.exe //T
(npm run dev > /tmp/dev.log 2>&1 &)
sleep 9
cat /tmp/dev.log
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8888/analyze
```

Expect `200`. Then open `/analyze` → Risk tab in a browser with an account that has both stock and option positions (e.g. the "Test Data" seed account from earlier this session) and confirm: the Options Risk table shows sensible Capital at Risk figures, the Stop Loss caption reads correctly, an expanded stress scenario shows option rows with `—` beta/move and a bounded $ impact, and the hero tiles/concentration numbers visibly shift compared to before (since options now count toward beta/HHI/totalMV).
