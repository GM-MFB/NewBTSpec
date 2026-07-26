# Analyze Tab — Phase 3 (Research) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract Fundamentals' panel JSX into a reusable `SymbolPanels`, then build Research: Single/Compare view toggle, a metrics comparison table, and a Sector Browser to bulk-add symbols to compare.

**Architecture:** `SymbolPanels` is pure presentation, shared by `FundamentalsTab` and `ResearchTab`. `ResearchTab` owns its own fetch/cache state (same pattern as `FundamentalsTab`) plus a `compareSymbols` list. `CompareView` and `SectorBrowser` are presentational, driven by pure data modules (`compareMetrics.js`, `sectorStocks.js`).

**Tech Stack:** React 19, Vitest + @testing-library/react. No new dependencies.

## Global Constraints

- No Supabase schema changes.
- Reuse existing `fund-*` CSS classes via `FundamentalsTab.css` import in `SymbolPanels.jsx` — no parallel class names for identical visuals.
- TDD throughout: failing test → implementation → passing test → commit, per task.
- Portfolio Context panel, Send-to-Optimizer/Risk, and Research→Financials integration are explicitly out of scope this phase.

---

### Task 1: Extract `SymbolPanels` from `FundamentalsTab`

**Files:**
- Create: `src/components/analysis/SymbolPanels.jsx`
- Create: `src/components/analysis/SymbolPanels.test.jsx`
- Modify: `src/components/analysis/FundamentalsTab.jsx`

**Interfaces:**
- Produces: `<SymbolPanels symbol result investment peers onResearchPeer />` — pure presentation, no fetching. `result` is the `FundamentalsResult` shape (`{ profile, quote, metrics, recs, targets, news, earnings }`), `investment` is a matching open investment or `null`, `peers` is `string[]`, `onResearchPeer(symbol)` fires when a peer chip is clicked.
- Consumed by: `FundamentalsTab.jsx` (Task 1) and `ResearchTab.jsx` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `src/components/analysis/SymbolPanels.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SymbolPanels from './SymbolPanels'

const fullResult = {
  profile: { name: 'Apple Inc', exchange: 'NASDAQ', finnhubIndustry: 'Technology' },
  quote: { c: 165, pc: 160 },
  metrics: { peBasicExclExtraTTM: 28.456789, roeTTM: 15, marketCapitalization: 2_500_000 },
  recs: null,
  targets: null,
  news: [],
  earnings: null,
}

describe('SymbolPanels', () => {
  it('renders the header and Valuation panel', () => {
    render(<SymbolPanels symbol="AAPL" result={fullResult} investment={null} peers={[]} onResearchPeer={vi.fn()} />)
    expect(screen.getByText('Apple Inc')).toBeInTheDocument()
    expect(screen.getByText('Valuation')).toBeInTheDocument()
  })

  it('rounds raw metric values to exactly 2 decimal places', () => {
    render(<SymbolPanels symbol="AAPL" result={fullResult} investment={null} peers={[]} onResearchPeer={vi.fn()} />)
    expect(screen.getByText('28.46')).toBeInTheDocument()
    expect(screen.getByText('15.00')).toBeInTheDocument()
  })

  it('shows Your Position when an investment is passed', () => {
    const investment = { symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 165 }
    render(<SymbolPanels symbol="AAPL" result={fullResult} investment={investment} peers={[]} onResearchPeer={vi.fn()} />)
    expect(screen.getByText('Your Position')).toBeInTheDocument()
  })

  it('does not crash when metrics is null', () => {
    render(<SymbolPanels symbol="AAPL" result={{ ...fullResult, metrics: null }} investment={null} peers={[]} onResearchPeer={vi.fn()} />)
    expect(screen.getByText('Apple Inc')).toBeInTheDocument()
  })

  it('calls onResearchPeer when a peer chip is clicked', async () => {
    const onResearchPeer = vi.fn()
    render(<SymbolPanels symbol="AAPL" result={fullResult} investment={null} peers={['MSFT']} onResearchPeer={onResearchPeer} />)
    await userEvent.click(screen.getByRole('button', { name: 'MSFT' }))
    expect(onResearchPeer).toHaveBeenCalledWith('MSFT')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SymbolPanels`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `SymbolPanels.jsx` by moving the JSX out of `FundamentalsTab.jsx`**

Move `toneFor`, `StatTile`, and everything from `<div className="fund-panels">`
down (the header, Your Position, Similar Stocks, Valuation, Growth &
Profitability, Risk & Price Range, Earnings History, Recent News sections)
out of `FundamentalsTab.jsx` into this new file, parameterized as props:

```jsx
import './FundamentalsTab.css'
import { unrealizedPnlFor } from '../../lib/investmentStats'
import { formatCurrency, formatCurrencyAuto, formatLarge, formatDecimal } from '../../lib/format'

function toneFor(value, { greenAbove, redAbove, greenBelow, redBelow } = {}) {
  if (value === undefined || value === null) return ''
  if (redAbove !== undefined && value > redAbove) return 'negative'
  if (greenAbove !== undefined && value > greenAbove) return 'positive'
  if (redBelow !== undefined && value < redBelow) return 'negative'
  if (greenBelow !== undefined && value < greenBelow) return 'positive'
  return ''
}

function StatTile({ label, value, tone }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="fund-stat-tile">
      <span className="fund-stat-label">{label}</span>
      <span className={`fund-stat-value mono ${tone ? `fund-stat-value--${tone}` : ''}`}>{value}</span>
    </div>
  )
}

export default function SymbolPanels({ symbol, result, investment, peers, onResearchPeer }) {
  return (
    <div className="fund-panels">
      <div className="fund-header">
        <span className="fund-symbol">{symbol}</span>
        <span>{result.profile?.name}</span>
        <span className="fund-meta">{result.profile?.exchange} · {result.profile?.finnhubIndustry}</span>
        {result.quote?.c !== undefined && (
          <span className="mono">
            {formatCurrency(result.quote.c)}
            {result.quote.pc ? ` (${(((result.quote.c - result.quote.pc) / result.quote.pc) * 100).toFixed(2)}%)` : ''}
          </span>
        )}
      </div>

      {investment && (
        <section className="fund-section">
          <h2>Your Position</h2>
          <div className="fund-stat-grid">
            <StatTile label="Shares" value={investment.shares} />
            <StatTile label="Avg Cost" value={formatCurrency(investment.avgCost)} />
            <StatTile label="Market Value" value={formatCurrency(Number(investment.currentPrice) * Number(investment.shares))} />
            <StatTile
              label="Unrealized P&L"
              value={formatCurrency(unrealizedPnlFor(investment))}
              tone={unrealizedPnlFor(investment) >= 0 ? 'positive' : 'negative'}
            />
          </div>
        </section>
      )}

      {peers?.length > 0 && (
        <section className="fund-section">
          <h2>Similar Stocks</h2>
          <div className="fund-symbol-picker">
            {peers.map((peer) => (
              <button key={peer} type="button" className="fund-chip" onClick={() => onResearchPeer(peer)}>{peer}</button>
            ))}
          </div>
        </section>
      )}

      <section className="fund-section">
        <h2>Valuation</h2>
        <div className="fund-stat-grid">
          <StatTile label="Market Cap" value={result.metrics?.marketCapitalization ? formatLarge(result.metrics.marketCapitalization * 1e6) : null} />
          <StatTile label="P/E" value={formatDecimal(result.metrics?.peBasicExclExtraTTM)} tone={toneFor(result.metrics?.peBasicExclExtraTTM, { redAbove: 30, greenBelow: 15 })} />
          <StatTile label="Forward P/E" value={formatDecimal(result.metrics?.peTTM)} />
          <StatTile label="P/S" value={formatDecimal(result.metrics?.psTTM)} />
          <StatTile label="P/B" value={formatDecimal(result.metrics?.pbQuarterly)} />
          <StatTile label="EV/EBITDA" value={formatDecimal(result.metrics?.evEbitdaTTM)} />
          <StatTile label="EPS TTM" value={formatDecimal(result.metrics?.epsTTM)} />
          <StatTile label="Div Yield" value={formatDecimal(result.metrics?.dividendYieldIndicatedAnnual)} />
        </div>
      </section>

      <section className="fund-section">
        <h2>Growth & Profitability</h2>
        <div className="fund-stat-grid">
          <StatTile label="Rev/Share" value={formatDecimal(result.metrics?.revenuePerShareTTM)} />
          <StatTile label="ROE" value={formatDecimal(result.metrics?.roeTTM)} tone={toneFor(result.metrics?.roeTTM, { greenAbove: 15, redBelow: 0 })} />
          <StatTile label="ROA" value={formatDecimal(result.metrics?.roaTTM)} tone={toneFor(result.metrics?.roaTTM, { greenAbove: 5 })} />
          <StatTile label="Net Margin" value={formatDecimal(result.metrics?.netProfitMarginTTM)} />
          <StatTile label="Gross Margin" value={formatDecimal(result.metrics?.grossMarginTTM)} />
          <StatTile label="Rev Growth YoY" value={formatDecimal(result.metrics?.revenueGrowthTTMYoy)} />
          <StatTile label="EPS Growth YoY" value={formatDecimal(result.metrics?.epsGrowthTTMYoy)} />
        </div>
      </section>

      <section className="fund-section">
        <h2>Risk & Price Range</h2>
        <div className="fund-stat-grid">
          <StatTile label="Beta" value={formatDecimal(result.metrics?.beta)} tone={toneFor(result.metrics?.beta, { redAbove: 1.5, greenBelow: 0.8 })} />
          <StatTile label="Debt/Equity" value={formatDecimal(result.metrics?.['totalDebt/totalEquityQuarterly'])} tone={toneFor(result.metrics?.['totalDebt/totalEquityQuarterly'], { redAbove: 2 })} />
          <StatTile label="Current Ratio" value={formatDecimal(result.metrics?.currentRatioQuarterly)} tone={toneFor(result.metrics?.currentRatioQuarterly, { greenAbove: 1.5, redBelow: 1 })} />
          <StatTile label="52W High" value={formatCurrencyAuto(result.metrics?.['52WeekHigh'])} />
          <StatTile label="52W Low" value={formatCurrencyAuto(result.metrics?.['52WeekLow'])} />
          <StatTile label="Shares Outstanding" value={result.metrics?.marketCapitalization && result.quote?.c ? Math.round((result.metrics.marketCapitalization * 1e6) / result.quote.c).toLocaleString() : null} />
        </div>
      </section>

      {result.earnings?.earnings?.length > 0 && (
        <section className="fund-section">
          <h2>Earnings History</h2>
          <table className="fund-table">
            <thead>
              <tr><th>Period</th><th>Actual</th><th>Estimate</th></tr>
            </thead>
            <tbody>
              {[...result.earnings.earnings].slice(0, 8).reverse().map((e, idx) => (
                <tr key={idx}>
                  <td>{e.period}</td>
                  <td className="mono">{formatDecimal(e.actual)}</td>
                  <td className="mono">{formatDecimal(e.estimate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {result.news?.length > 0 && (
        <section className="fund-section">
          <h2>Recent News</h2>
          <ul className="fund-news-list">
            {result.news.map((item) => (
              <li key={item.id}>
                <a href={item.url} target="_blank" rel="noreferrer">{item.headline}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update `FundamentalsTab.jsx` to render `SymbolPanels`**

Remove `toneFor`, `StatTile`, and the moved JSX from `FundamentalsTab.jsx`.
Remove now-unused imports (`unrealizedPnlFor`, `formatCurrency`,
`formatCurrencyAuto`, `formatLarge`, `formatDecimal` — keep only what's
still used, e.g. none of these directly if fully moved). Add:

```js
import SymbolPanels from './SymbolPanels'
```

Replace the `{result && !isEtf && ( <div className="fund-panels">...</div> )}`
block with:

```jsx
{result && !isEtf && (
  <SymbolPanels
    symbol={activeSymbol}
    result={result}
    investment={investment}
    peers={peers[activeSymbol] ?? []}
    onResearchPeer={research}
  />
)}
```

- [ ] **Step 5: Run tests to verify everything still passes**

Run: `npm test -- SymbolPanels FundamentalsTab`
Expected: PASS — `SymbolPanels.test.jsx` (5 new tests) and the existing
`FundamentalsTab.test.jsx` (8 tests, unchanged, still green since this is
a pure extraction with no behavior change).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/SymbolPanels.jsx src/components/analysis/SymbolPanels.test.jsx src/components/analysis/FundamentalsTab.jsx
git commit -m "refactor: extract SymbolPanels from FundamentalsTab for reuse in Research"
```

---

### Task 2: `sectorStocks.js`

**Files:**
- Create: `src/lib/sectorStocks.js`
- Create: `src/lib/sectorStocks.test.js`

**Interfaces:**
- Produces: `SECTORS: Array<{ name: string, stocks: Array<{ sym: string, name: string }> }>`, consumed by Task 5 (`SectorBrowser`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { SECTORS } from './sectorStocks'

describe('SECTORS', () => {
  it('has at least 10 sectors', () => {
    expect(SECTORS.length).toBeGreaterThanOrEqual(10)
  })

  it('gives every sector a name and a non-empty stock list', () => {
    for (const sector of SECTORS) {
      expect(sector.name).toBeTruthy()
      expect(sector.stocks.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate tickers within a single sector', () => {
    for (const sector of SECTORS) {
      const syms = sector.stocks.map((s) => s.sym)
      expect(new Set(syms).size).toBe(syms.length)
    }
  })

  it('gives every stock a symbol and a name', () => {
    for (const sector of SECTORS) {
      for (const stock of sector.stocks) {
        expect(stock.sym).toBeTruthy()
        expect(stock.name).toBeTruthy()
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sectorStocks`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/lib/sectorStocks.js`**

```js
export const SECTORS = [
  {
    name: 'Technology', stocks: [
      { sym: 'AAPL', name: 'Apple' }, { sym: 'MSFT', name: 'Microsoft' }, { sym: 'GOOGL', name: 'Alphabet' },
      { sym: 'META', name: 'Meta Platforms' }, { sym: 'ORCL', name: 'Oracle' }, { sym: 'ADBE', name: 'Adobe' },
      { sym: 'CRM', name: 'Salesforce' }, { sym: 'IBM', name: 'IBM' }, { sym: 'INTU', name: 'Intuit' },
      { sym: 'NOW', name: 'ServiceNow' }, { sym: 'SAP', name: 'SAP' }, { sym: 'UBER', name: 'Uber' },
    ],
  },
  {
    name: 'Semiconductors', stocks: [
      { sym: 'NVDA', name: 'NVIDIA' }, { sym: 'AVGO', name: 'Broadcom' }, { sym: 'AMD', name: 'AMD' },
      { sym: 'QCOM', name: 'Qualcomm' }, { sym: 'TXN', name: 'Texas Instruments' }, { sym: 'INTC', name: 'Intel' },
      { sym: 'MU', name: 'Micron' }, { sym: 'AMAT', name: 'Applied Materials' }, { sym: 'LRCX', name: 'Lam Research' },
      { sym: 'ASML', name: 'ASML' }, { sym: 'TSM', name: 'Taiwan Semiconductor' },
    ],
  },
  {
    name: 'Healthcare', stocks: [
      { sym: 'UNH', name: 'UnitedHealth' }, { sym: 'JNJ', name: 'Johnson & Johnson' }, { sym: 'LLY', name: 'Eli Lilly' },
      { sym: 'ABBV', name: 'AbbVie' }, { sym: 'MRK', name: 'Merck' }, { sym: 'TMO', name: 'Thermo Fisher' },
      { sym: 'ABT', name: 'Abbott' }, { sym: 'PFE', name: 'Pfizer' }, { sym: 'DHR', name: 'Danaher' },
      { sym: 'CVS', name: 'CVS Health' },
    ],
  },
  {
    name: 'Biotech & Pharma', stocks: [
      { sym: 'AMGN', name: 'Amgen' }, { sym: 'GILD', name: 'Gilead Sciences' }, { sym: 'VRTX', name: 'Vertex Pharma' },
      { sym: 'REGN', name: 'Regeneron' }, { sym: 'BIIB', name: 'Biogen' }, { sym: 'MRNA', name: 'Moderna' },
      { sym: 'BNTX', name: 'BioNTech' }, { sym: 'ILMN', name: 'Illumina' },
    ],
  },
  {
    name: 'Financial Services', stocks: [
      { sym: 'JPM', name: 'JPMorgan Chase' }, { sym: 'BAC', name: 'Bank of America' }, { sym: 'WFC', name: 'Wells Fargo' },
      { sym: 'GS', name: 'Goldman Sachs' }, { sym: 'MS', name: 'Morgan Stanley' }, { sym: 'V', name: 'Visa' },
      { sym: 'MA', name: 'Mastercard' }, { sym: 'AXP', name: 'American Express' }, { sym: 'C', name: 'Citigroup' },
      { sym: 'SCHW', name: 'Charles Schwab' },
    ],
  },
  {
    name: 'Consumer Discretionary', stocks: [
      { sym: 'AMZN', name: 'Amazon' }, { sym: 'TSLA', name: 'Tesla' }, { sym: 'HD', name: 'Home Depot' },
      { sym: 'MCD', name: "McDonald's" }, { sym: 'NKE', name: 'Nike' }, { sym: 'SBUX', name: 'Starbucks' },
      { sym: 'LOW', name: "Lowe's" }, { sym: 'BKNG', name: 'Booking Holdings' }, { sym: 'TJX', name: 'TJX Companies' },
    ],
  },
  {
    name: 'Consumer Staples', stocks: [
      { sym: 'WMT', name: 'Walmart' }, { sym: 'PG', name: 'Procter & Gamble' }, { sym: 'KO', name: 'Coca-Cola' },
      { sym: 'PEP', name: 'PepsiCo' }, { sym: 'COST', name: 'Costco' }, { sym: 'PM', name: 'Philip Morris' },
      { sym: 'MDLZ', name: 'Mondelez' }, { sym: 'CL', name: 'Colgate-Palmolive' },
    ],
  },
  {
    name: 'Energy', stocks: [
      { sym: 'XOM', name: 'ExxonMobil' }, { sym: 'CVX', name: 'Chevron' }, { sym: 'COP', name: 'ConocoPhillips' },
      { sym: 'SLB', name: 'Schlumberger' }, { sym: 'EOG', name: 'EOG Resources' }, { sym: 'PSX', name: 'Phillips 66' },
      { sym: 'MPC', name: 'Marathon Petroleum' },
    ],
  },
  {
    name: 'Industrials', stocks: [
      { sym: 'CAT', name: 'Caterpillar' }, { sym: 'BA', name: 'Boeing' }, { sym: 'HON', name: 'Honeywell' },
      { sym: 'UPS', name: 'UPS' }, { sym: 'GE', name: 'GE Aerospace' }, { sym: 'RTX', name: 'RTX Corp' },
      { sym: 'DE', name: 'Deere & Co' }, { sym: 'LMT', name: 'Lockheed Martin' },
    ],
  },
  {
    name: 'Materials', stocks: [
      { sym: 'LIN', name: 'Linde' }, { sym: 'APD', name: 'Air Products' }, { sym: 'SHW', name: 'Sherwin-Williams' },
      { sym: 'FCX', name: 'Freeport-McMoRan' }, { sym: 'NEM', name: 'Newmont' }, { sym: 'ECL', name: 'Ecolab' },
    ],
  },
  {
    name: 'Real Estate', stocks: [
      { sym: 'PLD', name: 'Prologis' }, { sym: 'AMT', name: 'American Tower' }, { sym: 'EQIX', name: 'Equinix' },
      { sym: 'SPG', name: 'Simon Property' }, { sym: 'O', name: 'Realty Income' }, { sym: 'PSA', name: 'Public Storage' },
    ],
  },
  {
    name: 'Utilities', stocks: [
      { sym: 'NEE', name: 'NextEra Energy' }, { sym: 'DUK', name: 'Duke Energy' }, { sym: 'SO', name: 'Southern Co' },
      { sym: 'D', name: 'Dominion Energy' }, { sym: 'AEP', name: 'American Electric Power' },
    ],
  },
  {
    name: 'Communication Services', stocks: [
      { sym: 'GOOG', name: 'Alphabet (Class C)' }, { sym: 'NFLX', name: 'Netflix' }, { sym: 'DIS', name: 'Disney' },
      { sym: 'CMCSA', name: 'Comcast' }, { sym: 'T', name: 'AT&T' }, { sym: 'VZ', name: 'Verizon' },
      { sym: 'TMUS', name: 'T-Mobile' },
    ],
  },
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- sectorStocks`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sectorStocks.js src/lib/sectorStocks.test.js
git commit -m "feat: add SECTORS curated stock lists for Research's Sector Browser"
```

---

### Task 3: `compareMetrics.js`

**Files:**
- Create: `src/lib/compareMetrics.js`
- Create: `src/lib/compareMetrics.test.js`

**Interfaces:**
- Produces: `METRIC_GROUPS` (shape in spec), `bestIndex(values, better) -> number|null`. Consumed by Task 4 (`CompareView`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { METRIC_GROUPS, bestIndex } from './compareMetrics'

const aapl = {
  quote: { c: 165, pc: 160 },
  metrics: { peBasicExclExtraTTM: 28, psTTM: 7, pbQuarterly: 40, evEbitdaTTM: 20, marketCapitalization: 2_500_000, roeTTM: 150, roaTTM: 20, netProfitMarginTTM: 25, revenueGrowthTTMYoy: 8, beta: 1.2, 'totalDebt/totalEquityQuarterly': 1.5, currentRatioQuarterly: 1.0 },
  recs: { strongBuy: 10, buy: 20, hold: 5, sell: 1, strongSell: 0 },
  targets: { targetMean: 200 },
}
const msft = {
  quote: { c: 420, pc: 410 },
  metrics: { peBasicExclExtraTTM: 35, psTTM: 12, pbQuarterly: 12, evEbitdaTTM: 25, marketCapitalization: 3_100_000, roeTTM: 40, roaTTM: 15, netProfitMarginTTM: 35, revenueGrowthTTMYoy: 15, beta: 0.9, 'totalDebt/totalEquityQuarterly': 0.4, currentRatioQuarterly: 1.8 },
  recs: { strongBuy: 15, buy: 10, hold: 2, sell: 0, strongSell: 0 },
  targets: { targetMean: 480 },
}

describe('METRIC_GROUPS', () => {
  it('defines 5 groups', () => {
    expect(METRIC_GROUPS.map((g) => g.group)).toEqual([
      'Price', 'Valuation', 'Growth & Profitability', 'Risk & Balance Sheet', 'Analyst Consensus',
    ])
  })

  it('pulls the P/E value for the Valuation group', () => {
    const valuation = METRIC_GROUPS.find((g) => g.group === 'Valuation')
    const peRow = valuation.rows.find((r) => r.label === 'P/E')
    expect(peRow.get(aapl)).toBe(28)
    expect(peRow.better).toBe('low')
  })

  it('computes Day Change % for the Price group', () => {
    const price = METRIC_GROUPS.find((g) => g.group === 'Price')
    const changeRow = price.rows.find((r) => r.label === 'Day Change %')
    expect(changeRow.get(aapl)).toBeCloseTo(3.125, 2)
  })

  it('computes Price Target Upside % for Analyst Consensus', () => {
    const consensus = METRIC_GROUPS.find((g) => g.group === 'Analyst Consensus')
    const upsideRow = consensus.rows.find((r) => r.label === 'Price Target Upside %')
    expect(upsideRow.get(aapl)).toBeCloseTo(21.21, 1)
  })

  it('returns null get() results gracefully for missing data', () => {
    const valuation = METRIC_GROUPS.find((g) => g.group === 'Valuation')
    const peRow = valuation.rows.find((r) => r.label === 'P/E')
    expect(peRow.get({ metrics: null })).toBeNull()
  })
})

describe('bestIndex', () => {
  it('picks the highest value when better is "high"', () => {
    expect(bestIndex([10, 25, 5], 'high')).toBe(1)
  })

  it('picks the lowest value when better is "low"', () => {
    expect(bestIndex([10, 25, 5], 'low')).toBe(2)
  })

  it('returns null when better is null', () => {
    expect(bestIndex([10, 25, 5], null)).toBeNull()
  })

  it('returns null when all values are null', () => {
    expect(bestIndex([null, null], 'high')).toBeNull()
  })

  it('returns null on a tie', () => {
    expect(bestIndex([10, 10], 'high')).toBeNull()
  })

  it('ignores null values when picking the winner', () => {
    expect(bestIndex([null, 25, 5], 'high')).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- compareMetrics`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/lib/compareMetrics.js`**

```js
function num(v) {
  return v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v)
}

function dayChangePct(result) {
  const c = num(result.quote?.c)
  const pc = num(result.quote?.pc)
  if (c === null || pc === null || pc === 0) return null
  return ((c - pc) / pc) * 100
}

function buyRatio(result) {
  const r = result.recs
  if (!r) return null
  const total = (r.strongBuy ?? 0) + (r.buy ?? 0) + (r.hold ?? 0) + (r.sell ?? 0) + (r.strongSell ?? 0)
  if (total === 0) return null
  return (((r.strongBuy ?? 0) + (r.buy ?? 0)) / total) * 100
}

function priceTargetUpside(result) {
  const mean = num(result.targets?.targetMean)
  const current = num(result.quote?.c)
  if (mean === null || current === null || current === 0) return null
  return ((mean - current) / current) * 100
}

function fmtPct(v) {
  return v === null ? '—' : `${v.toFixed(1)}%`
}

function fmtNum(v) {
  return v === null ? '—' : v.toFixed(2)
}

function fmtLargeNum(v) {
  return v === null ? '—' : `${(v / 1e6).toFixed(1)}M`
}

export const METRIC_GROUPS = [
  {
    group: 'Price',
    rows: [
      { label: 'Current Price', get: (r) => num(r.quote?.c), format: (v) => (v === null ? '—' : `$${v.toFixed(2)}`), better: null },
      { label: 'Day Change %', get: dayChangePct, format: fmtPct, better: 'high' },
    ],
  },
  {
    group: 'Valuation',
    rows: [
      { label: 'P/E', get: (r) => num(r.metrics?.peBasicExclExtraTTM), format: fmtNum, better: 'low' },
      { label: 'P/S', get: (r) => num(r.metrics?.psTTM), format: fmtNum, better: 'low' },
      { label: 'P/B', get: (r) => num(r.metrics?.pbQuarterly), format: fmtNum, better: 'low' },
      { label: 'EV/EBITDA', get: (r) => num(r.metrics?.evEbitdaTTM), format: fmtNum, better: 'low' },
      { label: 'Market Cap', get: (r) => num(r.metrics?.marketCapitalization), format: fmtLargeNum, better: null },
    ],
  },
  {
    group: 'Growth & Profitability',
    rows: [
      { label: 'ROE', get: (r) => num(r.metrics?.roeTTM), format: fmtPct, better: 'high' },
      { label: 'ROA', get: (r) => num(r.metrics?.roaTTM), format: fmtPct, better: 'high' },
      { label: 'Net Margin', get: (r) => num(r.metrics?.netProfitMarginTTM), format: fmtPct, better: 'high' },
      { label: 'Rev Growth YoY', get: (r) => num(r.metrics?.revenueGrowthTTMYoy), format: fmtPct, better: 'high' },
    ],
  },
  {
    group: 'Risk & Balance Sheet',
    rows: [
      { label: 'Beta', get: (r) => num(r.metrics?.beta), format: fmtNum, better: null },
      { label: 'Debt/Equity', get: (r) => num(r.metrics?.['totalDebt/totalEquityQuarterly']), format: fmtNum, better: 'low' },
      { label: 'Current Ratio', get: (r) => num(r.metrics?.currentRatioQuarterly), format: fmtNum, better: 'high' },
    ],
  },
  {
    group: 'Analyst Consensus',
    rows: [
      { label: 'Buy Ratio %', get: buyRatio, format: fmtPct, better: 'high' },
      { label: 'Price Target Upside %', get: priceTargetUpside, format: fmtPct, better: 'high' },
    ],
  },
]

export function bestIndex(values, better) {
  if (!better) return null
  let winner = null
  values.forEach((v, i) => {
    if (v === null || v === undefined) return
    if (winner === null) { winner = i; return }
    const current = values[winner]
    if (better === 'high' ? v > current : v < current) winner = i
    else if (v === current) winner = -1 // tie marker, resolved below
  })
  if (winner === -1) return null
  if (winner === null) return null
  // re-check for ties against the winner across all values
  const winnerValue = values[winner]
  const tie = values.some((v, i) => i !== winner && v === winnerValue)
  return tie ? null : winner
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- compareMetrics`
Expected: PASS. If `bestIndex`'s tie-handling doesn't match the test cases exactly, simplify to: compute the extreme value via `Math.max`/`Math.min` over non-null values, then check how many indices hold that value — return the index only if exactly one does.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compareMetrics.js src/lib/compareMetrics.test.js
git commit -m "feat: add compareMetrics (METRIC_GROUPS, bestIndex) for Research compare view"
```

---

### Task 4: `CompareView` component

**Files:**
- Create: `src/components/analysis/CompareView.jsx`
- Create: `src/components/analysis/CompareView.css`
- Create: `src/components/analysis/CompareView.test.jsx`

**Interfaces:**
- Consumes: `METRIC_GROUPS`, `bestIndex` (Task 3).
- Produces: `<CompareView symbols={string[]} data={{[symbol]: FundamentalsResult}} onRemove={(symbol) => void} />`, consumed by Task 6 (`ResearchTab`).

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CompareView from './CompareView'

const data = {
  AAPL: { quote: { c: 165, pc: 160 }, metrics: { peBasicExclExtraTTM: 28 }, recs: null, targets: null },
  MSFT: { quote: { c: 420, pc: 410 }, metrics: { peBasicExclExtraTTM: 35 }, recs: null, targets: null },
}

describe('CompareView', () => {
  it('renders one column header per symbol', () => {
    render(<CompareView symbols={['AAPL', 'MSFT']} data={data} onRemove={vi.fn()} />)
    expect(screen.getByRole('columnheader', { name: 'AAPL' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'MSFT' })).toBeInTheDocument()
  })

  it('highlights the winning cell for a lower-is-better metric', () => {
    render(<CompareView symbols={['AAPL', 'MSFT']} data={data} onRemove={vi.fn()} />)
    const peRow = screen.getByText('P/E').closest('tr')
    const aaplCell = peRow.querySelector('[data-symbol="AAPL"]')
    expect(aaplCell).toHaveClass('compare-cell--best')
  })

  it('does not crash for a symbol still loading (no data yet)', () => {
    render(<CompareView symbols={['AAPL', 'TSLA']} data={{ AAPL: data.AAPL }} onRemove={vi.fn()} />)
    expect(screen.getByRole('columnheader', { name: 'TSLA' })).toBeInTheDocument()
  })

  it('calls onRemove when a column Remove button is clicked', async () => {
    const onRemove = vi.fn()
    render(<CompareView symbols={['AAPL', 'MSFT']} data={data} onRemove={onRemove} />)
    await userEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])
    expect(onRemove).toHaveBeenCalledWith('AAPL')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CompareView`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/components/analysis/CompareView.jsx`**

```jsx
import './CompareView.css'
import { METRIC_GROUPS, bestIndex } from '../../lib/compareMetrics'

export default function CompareView({ symbols, data, onRemove }) {
  return (
    <div className="compare-table-wrap">
      <table className="compare-table">
        <thead>
          <tr>
            <th></th>
            {symbols.map((symbol) => (
              <th key={symbol}>
                {symbol}
                <button type="button" className="compare-remove" onClick={() => onRemove(symbol)}>Remove</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_GROUPS.map((group) => (
            <>
              <tr key={group.group} className="compare-group-row">
                <td colSpan={symbols.length + 1}>{group.group}</td>
              </tr>
              {group.rows.map((row) => {
                const values = symbols.map((symbol) => (data[symbol] ? row.get(data[symbol]) : null))
                const winner = bestIndex(values, row.better)
                return (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    {symbols.map((symbol, i) => (
                      <td key={symbol} data-symbol={symbol} className={i === winner ? 'compare-cell--best' : ''}>
                        {row.format(values[i])}
                        {i === winner && <span className="compare-best-marker">▲</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Add `CompareView.css`**

```css
.compare-table-wrap {
  overflow-x: auto;
}

.compare-table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
}

.compare-table th, .compare-table td {
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  text-align: right;
}

.compare-table th:first-child, .compare-table td:first-child {
  text-align: left;
  color: var(--text-dim);
}

.compare-group-row td {
  color: var(--text-dim);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}

.compare-cell--best {
  color: var(--green);
  font-weight: 700;
}

.compare-best-marker {
  margin-left: 4px;
}

.compare-remove {
  display: block;
  margin-top: 4px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.compare-remove:hover {
  border-color: var(--red);
  color: var(--red);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- CompareView`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/CompareView.jsx src/components/analysis/CompareView.css src/components/analysis/CompareView.test.jsx
git commit -m "feat: add CompareView side-by-side metrics table for Research"
```

---

### Task 5: `SectorBrowser` component

**Files:**
- Create: `src/components/analysis/SectorBrowser.jsx`
- Create: `src/components/analysis/SectorBrowser.css`
- Create: `src/components/analysis/SectorBrowser.test.jsx`

**Interfaces:**
- Consumes: `SECTORS` (Task 2).
- Produces: `<SectorBrowser onAddToCompare={(symbols: string[]) => void} />`, consumed by Task 6 (`ResearchTab`).

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SectorBrowser from './SectorBrowser'
import { SECTORS } from '../../lib/sectorStocks'

describe('SectorBrowser', () => {
  it('renders a section for each sector', () => {
    render(<SectorBrowser onAddToCompare={vi.fn()} />)
    expect(screen.getByText(SECTORS[0].name)).toBeInTheDocument()
  })

  it('adds checked symbols to compare and clears selection', async () => {
    const onAddToCompare = vi.fn()
    render(<SectorBrowser onAddToCompare={onAddToCompare} />)

    const firstSector = SECTORS[0]
    const firstStock = firstSector.stocks[0]
    const checkbox = screen.getByRole('checkbox', { name: new RegExp(firstStock.sym) })
    await userEvent.click(checkbox)

    await userEvent.click(screen.getByRole('button', { name: /add to compare/i }))

    expect(onAddToCompare).toHaveBeenCalledWith([firstStock.sym])
    expect(checkbox).not.toBeChecked()
  })

  it('disables Add to Compare when nothing is selected', () => {
    render(<SectorBrowser onAddToCompare={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add to compare/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SectorBrowser`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/components/analysis/SectorBrowser.jsx`**

```jsx
import { useState } from 'react'
import './SectorBrowser.css'
import { SECTORS } from '../../lib/sectorStocks'

export default function SectorBrowser({ onAddToCompare }) {
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

  return (
    <div className="sector-browser">
      {SECTORS.map((sector) => (
        <details key={sector.name} className="sector-group">
          <summary>{sector.name}</summary>
          <div className="sector-stock-grid">
            {sector.stocks.map((stock) => (
              <label key={stock.sym} className="sector-stock">
                <input type="checkbox" checked={selected.has(stock.sym)} onChange={() => toggle(stock.sym)} />
                {stock.sym} — {stock.name}
              </label>
            ))}
          </div>
        </details>
      ))}
      <div className="sector-actions">
        <span>{selected.size} selected</span>
        <button type="button" onClick={handleAdd} disabled={selected.size === 0}>Add to Compare</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add `SectorBrowser.css`**

```css
.sector-browser {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sector-group summary {
  cursor: pointer;
  padding: 8px 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.sector-group summary::marker {
  color: var(--text-dim);
}

.sector-stock-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 6px;
  padding: 8px 0 8px 16px;
}

.sector-stock {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
}

.sector-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.sector-actions button {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.sector-actions button:hover:not(:disabled) {
  border-color: var(--green);
  color: var(--green);
}

.sector-actions button:disabled {
  opacity: 0.5;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- SectorBrowser`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/SectorBrowser.jsx src/components/analysis/SectorBrowser.css src/components/analysis/SectorBrowser.test.jsx
git commit -m "feat: add SectorBrowser for bulk-adding sector stocks to Research compare"
```

---

### Task 6: `ResearchTab` orchestration + page wiring

**Files:**
- Create: `src/components/analysis/ResearchTab.jsx`
- Create: `src/components/analysis/ResearchTab.css`
- Create: `src/components/analysis/ResearchTab.test.jsx`
- Modify: `src/pages/AnalyzePage.jsx`
- Modify: `src/pages/AnalyzePage.test.jsx`

**Interfaces:**
- Consumes: `useAuth`, `useUserSettings` (existing), `fetchFundamentals`/`fetchPeers` (existing), `KNOWN_ETFS` (existing), `SymbolPanels` (Task 1), `CompareView` (Task 4), `SectorBrowser` (Task 5).
- Props: `{ investments }` — same shape as `FundamentalsTab`/`FinancialsTab`.

- [ ] **Step 1: Write the failing tests**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ResearchTab from './ResearchTab'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFundamentals, fetchPeers } from '../../lib/fetchFundamentals'

vi.mock('../../hooks/useAuth')
vi.mock('../../hooks/useUserSettings')
vi.mock('../../lib/fetchFundamentals')

const investments = [
  { id: 'i1', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 165 },
]

function mockResult(name) {
  return {
    profile: { name }, quote: { c: 100, pc: 95 }, metrics: { peBasicExclExtraTTM: 20 },
    recs: null, targets: null, news: [], earnings: null,
  }
}

describe('ResearchTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    fetchPeers.mockResolvedValue([])
  })

  it('shows a Key Required state when there is no Finnhub key', () => {
    useUserSettings.mockReturnValue({ finnhubKey: '', avKey: '', loading: false })
    render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
    expect(screen.getByText(/key required/i)).toBeInTheDocument()
  })

  it('defaults to Single view and renders SymbolPanels for a researched symbol', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockResolvedValue(mockResult('Apple Inc'))

    render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Apple Inc')).toBeInTheDocument())
    expect(screen.queryByTestId('compare-view')).not.toBeInTheDocument()
  })

  it('accumulates researched symbols into Compare view instead of replacing', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockImplementation((symbol) => Promise.resolve(mockResult(symbol)))

    render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /^compare$/i }))

    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'AAPL' })).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText(/add symbol/i), 'MSFT{enter}')
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'MSFT' })).toBeInTheDocument())

    expect(screen.getByRole('columnheader', { name: 'AAPL' })).toBeInTheDocument()
  })

  it('feeds Sector Browser Add to Compare into the same compare list', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockImplementation((symbol) => Promise.resolve(mockResult(symbol)))

    render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /^compare$/i }))
    await userEvent.click(screen.getByRole('button', { name: /browse by sector/i }))

    const firstCheckbox = screen.getAllByRole('checkbox')[0]
    await userEvent.click(firstCheckbox)
    await userEvent.click(screen.getByRole('button', { name: /add to compare/i }))

    await waitFor(() => expect(screen.getByTestId('compare-view')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ResearchTab`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/components/analysis/ResearchTab.jsx`**

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import './ResearchTab.css'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFundamentals, fetchPeers } from '../../lib/fetchFundamentals'
import { KNOWN_ETFS } from '../../lib/knownEtfs'
import SymbolPanels from './SymbolPanels'
import CompareView from './CompareView'
import SectorBrowser from './SectorBrowser'

export default function ResearchTab({ investments }) {
  const { user } = useAuth()
  const { finnhubKey, loading: settingsLoading } = useUserSettings(user?.id)
  const [data, setData] = useState({})
  const [peers, setPeers] = useState({})
  const [activeSymbol, setActiveSymbol] = useState(null)
  const [compareSymbols, setCompareSymbols] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loadingSymbol, setLoadingSymbol] = useState(null)
  const [view, setView] = useState('single')
  const [showSectorBrowser, setShowSectorBrowser] = useState(false)

  const stockSymbols = [...new Set(investments.filter((i) => i.assetType === 'Stock').map((i) => i.symbol))]

  async function fetchSymbol(symbol) {
    if (data[symbol] || KNOWN_ETFS.has(symbol)) return
    setLoadingSymbol(symbol)
    const [result, peerList] = await Promise.all([
      fetchFundamentals(symbol, finnhubKey),
      fetchPeers(symbol, finnhubKey),
    ])
    setData((prev) => ({ ...prev, [symbol]: result }))
    setPeers((prev) => ({ ...prev, [symbol]: peerList }))
    setLoadingSymbol(null)
  }

  async function research(rawSymbol) {
    const symbol = rawSymbol.trim().toUpperCase()
    if (!symbol) return
    setInputValue('')
    if (view === 'compare') {
      setCompareSymbols((prev) => (prev.includes(symbol) ? prev : [...prev, symbol]))
    } else {
      setActiveSymbol(symbol)
    }
    await fetchSymbol(symbol)
  }

  function handleAddToCompare(symbols) {
    setCompareSymbols((prev) => [...new Set([...prev, ...symbols])])
    for (const symbol of symbols) fetchSymbol(symbol)
    setShowSectorBrowser(false)
  }

  function handleRemoveFromCompare(symbol) {
    setCompareSymbols((prev) => prev.filter((s) => s !== symbol))
  }

  if (!settingsLoading && !finnhubKey) {
    return (
      <div className="fund-key-required">
        <p>Key Required</p>
        <p>Add your Finnhub API key in Settings to research stocks.</p>
        <Link to="/settings">Go to Settings</Link>
      </div>
    )
  }

  const isEtf = activeSymbol && KNOWN_ETFS.has(activeSymbol)
  const result = activeSymbol ? data[activeSymbol] : null
  const investment = activeSymbol ? investments.find((i) => i.symbol === activeSymbol) : null

  return (
    <div className="research-tab">
      <div className="research-toolbar">
        <div className="fund-symbol-picker">
          {stockSymbols.map((symbol) => (
            <button
              key={symbol}
              type="button"
              className={`fund-chip${symbol === activeSymbol ? ' fund-chip--active' : ''}`}
              onClick={() => research(symbol)}
            >
              {symbol}
            </button>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); research(inputValue) }}>
            <label htmlFor="researchAddSymbol">Add symbol</label>
            <input
              id="researchAddSymbol"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); research(inputValue) } }}
            />
          </form>
        </div>

        <div className="research-view-toggle">
          <button type="button" aria-pressed={view === 'single'} onClick={() => setView('single')}>Single</button>
          <button type="button" aria-pressed={view === 'compare'} onClick={() => setView('compare')}>Compare</button>
        </div>
      </div>

      {view === 'compare' && (
        <button type="button" className="research-sector-toggle" onClick={() => setShowSectorBrowser((v) => !v)}>
          {showSectorBrowser ? 'Hide' : 'Browse by Sector'}
        </button>
      )}

      {view === 'compare' && showSectorBrowser && <SectorBrowser onAddToCompare={handleAddToCompare} />}

      {loadingSymbol && <p>Loading {loadingSymbol}…</p>}

      {view === 'single' && isEtf && (
        <div className="fund-etf-card">
          <p>No financials available for ETFs.</p>
          <a href={`https://etf.com/${activeSymbol}`} target="_blank" rel="noreferrer">ETF.com</a>
          <a href={`https://finance.yahoo.com/quote/${activeSymbol}`} target="_blank" rel="noreferrer">Yahoo Finance</a>
          <a href={`https://www.morningstar.com/etfs/xnas/${activeSymbol}/quote`} target="_blank" rel="noreferrer">Morningstar</a>
        </div>
      )}

      {view === 'single' && result && !isEtf && (
        <SymbolPanels
          symbol={activeSymbol}
          result={result}
          investment={investment}
          peers={peers[activeSymbol] ?? []}
          onResearchPeer={research}
        />
      )}

      {view === 'compare' && compareSymbols.length > 0 && (
        <CompareView symbols={compareSymbols} data={data} onRemove={handleRemoveFromCompare} />
      )}
    </div>
  )
}
```

Note: `CompareView` needs a `data-testid="compare-view"` wrapper for the
`ResearchTab.test.jsx` assertions above — add that to `CompareView.jsx`'s
root `<div className="compare-table-wrap" data-testid="compare-view">` in
this task (small addition to Task 4's component, discovered while wiring
the consumer — update `CompareView.jsx` directly).

- [ ] **Step 4: Add `data-testid="compare-view"` to `CompareView.jsx`'s root div**

```jsx
<div className="compare-table-wrap" data-testid="compare-view">
```

- [ ] **Step 5: Add `ResearchTab.css`**

Match `FinancialsTab.css`'s `.fin-toolbar`/`.fin-view-toggle` pattern for
`.research-toolbar`/`.research-view-toggle`; `.research-sector-toggle`
styled like a small secondary button (transparent bg, border, hover green).

- [ ] **Step 6: Wire into `AnalyzePage.jsx`**

Import `ResearchTab`, render it for `tab === 'research'`. Update the
placeholder condition to exclude `research` alongside `fundamentals` and
`financials`. In `AnalyzePage.test.jsx`, change the "Coming soon" test to
target `dcf` instead of `research`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- ResearchTab CompareView AnalyzePage`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/analysis/ResearchTab.jsx src/components/analysis/ResearchTab.css src/components/analysis/ResearchTab.test.jsx src/components/analysis/CompareView.jsx src/pages/AnalyzePage.jsx src/pages/AnalyzePage.test.jsx
git commit -m "feat: implement Research tab (Single/Compare views, Sector Browser integration)"
```

---

### Task 7: Full suite + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (308 existing + ~35 new from this plan).

- [ ] **Step 2: Restart dev server, manual smoke test**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

At `/analyze` → Research: research a real symbol in Single view, confirm
it looks identical to Fundamentals' single-symbol panels. Switch to
Compare, research 2-3 symbols, confirm they accumulate as columns with
correct best-value highlighting. Open Browse by Sector, check a few boxes
across different sectors, Add to Compare, confirm they merge into the
existing compare list. Remove a symbol from compare.

- [ ] **Step 3: Report completion**

No commit needed for this task unless smoke testing surfaces a bug — fix
as a new small commit and re-run Step 1.
