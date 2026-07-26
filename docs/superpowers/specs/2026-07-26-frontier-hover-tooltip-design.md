# FrontierPanel Hoverable Curve Tooltip — Design

## Context

The Efficient Frontier chart's curve currently has `dot={false}` and a
plain `<Tooltip>` with no custom content. `chartData` only carries `{vol,
ret}` per point — the per-point weight vector that `extractFrontier`
already returns on each point is discarded when building `chartData`, so
there's no way to see what portfolio composition produced any given spot
on the curve. This closes that gap: hovering anywhere on the curve (or the
3 fixed reference dots) shows that point's per-symbol allocation.

## Changes (all within `src/components/analysis/FrontierPanel.jsx`)

- `chartData` keeps each frontier point's `weights` array:
  `simData.frontier.map((p) => ({ vol: p.vol * 100, ret: p.ret * 100, weights: p.weights }))`.
  No `efficientFrontier.js` changes — `extractFrontier`'s points already
  carry `weights`.
- The three reference `<Scatter>` data objects (Your Portfolio, Max
  Diversification, Max Sharpe) also gain a `weights` field (their existing
  `.weights` array) and a `label` field (their own name), so hovering them
  produces the same tooltip experience as hovering the curve, for
  consistency.
- `<Line>` gets `dot={{ r: 2, fill: '#898781' }}` (was `dot={false}`) so
  the curve visibly reads as a series of hoverable points.
- The existing `<Tooltip contentStyle=... itemStyle=... labelStyle=... />`
  is replaced with `<Tooltip content={FrontierHoverTooltip} />`, where
  `FrontierHoverTooltip` is a new subcomponent alongside `FrontierStatCard`
  — **exported** (unlike the other internal helpers) specifically so tests
  can render it directly with mock `payload` props, since simulating a
  real recharts hover interaction in jsdom is unreliable (recharts tooltips
  depend on measured SVG coordinates that jsdom doesn't compute):
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
  Called as `<Tooltip content={(props) => <FrontierHoverTooltip {...props} symbols={allSymbols} colorMap={colorMap} />} />`.
  Rows under 0.5% are hidden to keep the list short (matches the reference
  screenshot's tooltip which only lists meaningfully-weighted symbols).

## Out of scope

- Buy/sell delta math in the hover tooltip (stays only in the Rebalancing
  Plan table, per the scoping answer).
- Any change to the 3 stat cards or rebalancing table below the chart.

## Testing

- `FrontierPanel.test.jsx`: new tests for the exported `FrontierHoverTooltip`
  component directly — renders nothing when `active` is false or `payload`
  is empty; renders the point's Return/Vol header and a sorted,
  ≥0.5%-filtered symbol/percentage list, colored per `colorMap`; renders a
  title line only when `point.label` is present.
- Existing chart-related tests (3 reference points, rebalancing table)
  continue to pass unchanged — the underlying `chartData`/Scatter data
  changes are additive (new `weights`/`label` fields), not a shape change
  to what already exists.
