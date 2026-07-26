import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart,
} from 'recharts'
import './FrontierPanel.css'
import { generateEfficientFrontierData, generateCombinedFrontierData, getAssetParams } from '../../lib/efficientFrontier'

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

  function actionFor(targetWeight, symbol, currentWeight) {
    const price = priceMap[symbol]
    if (!price) return '—'
    const deltaShares = Math.round(((targetWeight - currentWeight) / 100) * totalMV / price)
    if (deltaShares === 0) return 'hold'
    return deltaShares > 0 ? `buy ${deltaShares}` : `sell ${Math.abs(deltaShares)}`
  }

  const chartData = simData.frontier.map((p) => ({ vol: p.vol * 100, ret: p.ret * 100 }))

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
          <XAxis dataKey="vol" name="Volatility %" tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#262626' }} tickLine={false} />
          <YAxis dataKey="ret" name="Return %" tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#262626' }} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#141414', border: '1px solid #262626', borderRadius: 6, fontSize: 12 }}
            itemStyle={{ color: '#e5e5e5' }}
            labelStyle={{ color: '#888' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#888' }} />
          <Line type="monotone" dataKey="ret" data={chartData} name="Efficient Frontier" stroke="#898781" strokeWidth={2} dot={false} />
          <Scatter name="Your Portfolio" data={[{ vol: currentPoint.vol * 100, ret: currentPoint.ret * 100 }]} fill="#3987e5" />
          <Scatter name="Max Diversification" data={[{ vol: simData.maxDiversification.vol * 100, ret: simData.maxDiversification.ret * 100 }]} fill="#d95926" />
          <Scatter name="Max Sharpe" data={[{ vol: simData.maxSharpe.vol * 100, ret: simData.maxSharpe.ret * 100 }]} fill="#199e70" />
        </ComposedChart>
      </ResponsiveContainer>

      <table className="frontier-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Current %</th>
            <th>Max-Div % / Action</th>
            <th>Max-Sharpe % / Action</th>
          </tr>
        </thead>
        <tbody>
          {allSymbols.map((symbol, i) => {
            const currentWeight = currentPoint.weights[i] * 100
            const maxDivWeight = simData.maxDiversification.weights[i] * 100
            const maxSharpeWeight = simData.maxSharpe.weights[i] * 100
            return (
              <tr key={symbol}>
                <th scope="row">{symbol}</th>
                <td className="mono">{currentWeight.toFixed(1)}%</td>
                <td className="mono">{maxDivWeight.toFixed(1)}% ({actionFor(maxDivWeight, symbol, currentWeight)})</td>
                <td className="mono">{maxSharpeWeight.toFixed(1)}% ({actionFor(maxSharpeWeight, symbol, currentWeight)})</td>
              </tr>
            )
          })}
        </tbody>
      </table>

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
