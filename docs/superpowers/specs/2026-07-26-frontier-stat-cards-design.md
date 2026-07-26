# FrontierPanel Stat Cards & Rebalancing Table Redesign — Design

## Context

`FrontierPanel.jsx` currently renders the frontier chart plus a single
compact table (Symbol / Current % / Max-Div % + Action / Max-Sharpe % +
Action). A reference screenshot from the original app shows a richer
presentation: three per-point stat cards (Your Portfolio / Max
Diversification / Max Sharpe) each with headline stats and a colored
"Suggested Allocation" bar list, plus a more detailed Rebalancing Plan
table (colored symbol dots, price, share counts, colored buy/sell actions
with % deltas). This phase redesigns `FrontierPanel`'s presentation layer
only — the underlying data (`generateEfficientFrontierData`/
`generateCombinedFrontierData`, `simData.maxDiversification`,
`simData.maxSharpe`, `currentPoint`) is unchanged.

Out of scope (per discussion): on-chart point labels (text directly next
to dots on the curve) and a "How this works" info tooltip — the existing
external legend caption stays as the only labeling for the three
reference points.

## Per-symbol color assignment

A new helper, `assignSymbolColors(symbols, weights)`, in `FrontierPanel.jsx`
(not exported — internal to this component):
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
```
Called once per render with `allSymbols`/`currentPoint.weights` (the "Your
Portfolio" point) as the ordering basis — stable regardless of which card
or table row is being drawn. A symbol's color never changes based on which
point's weights are currently being displayed.

## Stat cards

A new private subcomponent inside `FrontierPanel.jsx` (not a separate
file — only used here, three times):
```jsx
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
Rendered three times: `title="Your Portfolio" subtitle="Current allocation"`,
`title="Max Diversification" subtitle="Best correlation spread"`,
`title="Max Sharpe" subtitle="Best risk-adjusted return"`, each passed its
respective point (`currentPoint`, `simData.maxDiversification`,
`simData.maxSharpe`).

## Rebalancing table redesign

Replaces the existing `.frontier-table`. Adds:
- A header line above the table: `Based on total portfolio value of
  {formatLarge(totalMV)}` (reusing the already-computed `totalMV`).
- Symbol cell: colored dot (`colorMap[symbol]`) + symbol name on one line,
  price (`priceMap[symbol]`, formatted, or `—` if unknown) dimmed
  underneath. A `(new)` badge appended to the symbol name when
  `extraSymbols.includes(symbol) && !symbols.includes(symbol)` (the same
  "new position" check already used by the assumptions editor).
- New **Shares** column: `currentWeight/100 * totalMV / price`, formatted
  to 2 decimals when the result is under 1 (fractional-share assets like
  BTC), otherwise a whole number — reuses the existing rounding convention
  from `actionFor`, extracted into a small `formatShares(n)` helper.
- **Action** cells (Max-Div and Max-Sharpe columns) redesigned: a colored
  ▲/▼ + "Buy N"/"Sell N"/"Hold" line (green ▲ buy, red ▼ sell, dim "Hold"),
  with a second smaller line showing the %Δ (`(targetWeight -
  currentWeight).toFixed(1)}%`, colored to match (green positive, red
  negative).

## Testing

- `assignSymbolColors`: stable order by descending weight, cycles through
  the 8-color palette, same symbol always gets the same color regardless
  of input order.
- `FrontierPanel.test.jsx`: new tests — each of the 3 stat cards renders
  with its title/subtitle and the correct Exp. Return/Vol/Sharpe numbers;
  allocation bars render one row per symbol per card, sorted by that
  card's own weight; the rebalancing table shows a colored dot, price, and
  share count per row; a "(new)" badge appears for a combined-mode
  extra-symbol row; Action cells show the correct Buy/Sell/Hold wording
  and %Δ sign.
- Existing `FrontierPanel.test.jsx` tests (3-reference-point rendering,
  rebalancing row-per-symbol, assumptions editor, cash rate card) continue
  to pass unchanged — this is a presentation-layer addition, not a data
  contract change.
