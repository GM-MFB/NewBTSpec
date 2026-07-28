import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart,
} from 'recharts'
import './FrontierPanel.css'
import { generateEfficientFrontierData, generateCombinedFrontierData, getAssetParams } from '../../lib/efficientFrontier'
import { formatCurrency, formatLarge } from '../../lib/format'

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
      <p className="frontier-hover-tooltip-stats">Return {point.ret.toFixed(2)}% · Vol {point.vol.toFixed(2)}%</p>
      <ul className="frontier-hover-tooltip-list">
        {rows.map((r) => (
          <li key={r.symbol}>
            <span className="frontier-hover-tooltip-symbol" style={{ color: colorMap[r.symbol] }}>{r.symbol}</span>
            <span className="mono">{r.weight.toFixed(2)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function loadOverrides(storageKey) {
  const raw = localStorage.getItem(storageKey)
  return raw ? JSON.parse(raw) : {}
}

function loadCashRate(storageKey) {
  const raw = localStorage.getItem(`${storageKey}_cash_rate`)
  return raw ? Number(raw) : 0.03
}

export default function FrontierPanel({
  symbols, weights, storageKey, cash = 0, mode = 'portfolio', extraSymbols = [], priceMap = {}, nSim = 10000,
}) {
  const [overrides, setOverrides] = useState(() => loadOverrides(storageKey))
  const [cashRate, setCashRate] = useState(() => loadCashRate(storageKey))
  const [showAssumptions, setShowAssumptions] = useState(true)

  function setOverride(symbol, key, value) {
    const next = { ...overrides, [symbol]: { ...overrides[symbol], [key]: value } }
    setOverrides(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const paramsOverride = useMemo(() => {
    const result = {}
    for (const [symbol, o] of Object.entries(overrides)) {
      const base = getAssetParams(symbol)
      result[symbol] = { r: o.r ?? base.r, s: o.s ?? base.s }
    }
    return result
  }, [overrides])

  const simData = useMemo(() => {
    const cashOptions = cash > 0 ? { amount: cash, rate: cashRate } : null
    if (mode === 'combined') {
      return generateCombinedFrontierData(symbols, weights, extraSymbols, { nSim, cashOptions, paramsOverride })
    }
    return { ...generateEfficientFrontierData(symbols, { nSim, cashOptions, paramsOverride }), current: null }
  }, [symbols, weights, extraSymbols, mode, cash, cashRate, paramsOverride, nSim])

  const allSymbols = simData.symbols
  const currentPoint = mode === 'combined' ? simData.current : { ...simData.points[0], weights }
  const totalMV = allSymbols.reduce((sum, s, i) => {
    const price = priceMap[s] ?? 0
    return sum + (currentPoint.weights[i] ?? 0) * price
  }, 0)

  const chartData = simData.frontier.map((p) => ({ vol: p.vol * 100, ret: p.ret * 100, weights: p.weights }))
  const colorMap = assignSymbolColors(allSymbols, currentPoint.weights)

  return (
    <div className="frontier-panel">
      <div className="frontier-legend-caption">
        <span className="frontier-legend-key frontier-legend-key--portfolio">Your Portfolio</span>
        <span className="frontier-legend-key frontier-legend-key--maxdiv">Max Diversification</span>
        <span className="frontier-legend-key frontier-legend-key--maxsharpe">Max Sharpe</span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#262626" strokeDasharray="0" />
          <XAxis type="number" dataKey="vol" name="Volatility %" domain={['auto', 'auto']} tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#262626' }} tickLine={false} />
          <YAxis type="number" dataKey="ret" name="Return %" domain={['auto', 'auto']} tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#262626' }} tickLine={false} />
          <Tooltip content={(props) => <FrontierHoverTooltip {...props} symbols={allSymbols} colorMap={colorMap} />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#888' }} />
          <Line type="monotone" dataKey="ret" data={chartData} name="Efficient Frontier" stroke="#898781" strokeWidth={2} dot={{ r: 2, fill: '#898781' }} />
          <Scatter name="Your Portfolio" data={[{ vol: currentPoint.vol * 100, ret: currentPoint.ret * 100, weights: currentPoint.weights, label: 'Your Portfolio' }]} fill="#3987e5" />
          <Scatter name="Max Diversification" data={[{ vol: simData.maxDiversification.vol * 100, ret: simData.maxDiversification.ret * 100, weights: simData.maxDiversification.weights, label: 'Max Diversification' }]} fill="#d95926" />
          <Scatter name="Max Sharpe" data={[{ vol: simData.maxSharpe.vol * 100, ret: simData.maxSharpe.ret * 100, weights: simData.maxSharpe.weights, label: 'Max Sharpe' }]} fill="#199e70" />
        </ComposedChart>
      </ResponsiveContainer>

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

      <button type="button" onClick={() => setShowAssumptions((v) => !v)}>
        {showAssumptions ? 'Hide' : 'Adjust Expected Returns & Volatility'}
      </button>

      {showAssumptions && (
        <div className="frontier-assumptions">
          {allSymbols.filter((s) => s !== 'CASH').map((symbol) => {
            const base = getAssetParams(symbol)
            const o = overrides[symbol] ?? {}
            const r = o.r ?? base.r
            const s = o.s ?? base.s
            const impliedSharpe = s > 0 ? (r - 0.045) / s : 0
            const isNew = extraSymbols.includes(symbol) && !symbols.includes(symbol)
            return (
              <div key={symbol} className="frontier-assumption-row">
                <span className="frontier-assumption-symbol">{symbol}{isNew ? ' (new)' : ''}</span>
                <label htmlFor={`${symbol}-return`}>
                  {symbol} Return {(r * 100).toFixed(1)}%{o.r === undefined ? ' (default)' : ''}
                  <input
                    id={`${symbol}-return`}
                    type="range" min="0" max="200" step="0.5"
                    value={r * 100}
                    onChange={(e) => setOverride(symbol, 'r', Number(e.target.value) / 100)}
                  />
                </label>
                <label htmlFor={`${symbol}-vol`}>
                  {symbol} Volatility {(s * 100).toFixed(1)}%{o.s === undefined ? ' (default)' : ''}
                  <input
                    id={`${symbol}-vol`}
                    type="range" min="1" max="300" step="0.5"
                    value={s * 100}
                    onChange={(e) => setOverride(symbol, 's', Number(e.target.value) / 100)}
                  />
                </label>
                <span className="frontier-assumption-sharpe">Implied Sharpe: {impliedSharpe.toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      )}

      {cash > 0 && (
        <div className="frontier-cash-card">
          <label htmlFor="frontierCashRate">Cash annual return rate %</label>
          <input
            id="frontierCashRate"
            type="number"
            value={(cashRate * 100).toFixed(1)}
            onChange={(e) => {
              const rate = Number(e.target.value) / 100
              setCashRate(rate)
              localStorage.setItem(`${storageKey}_cash_rate`, String(rate))
            }}
          />
        </div>
      )}
    </div>
  )
}
