import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import './FinancialsTab.css'
import './DCFTab.css'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFinancials } from '../../lib/fetchFinancials'
import { getSharedCache, saveSharedCache } from '../../lib/financialsSharedCache'
import { deriveDcfInputs, runDcf, marginOfSafety, buildSensitivityGrid, parseShorthandNumber } from '../../lib/dcf'
import { formatLarge, formatCurrency } from '../../lib/format'

function getFundamentalsCacheEntry(symbol) {
  const raw = localStorage.getItem('bt_fundamentals_cache')
  if (!raw) return null
  return JSON.parse(raw)[symbol] ?? null
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function buildFcfChartData(financialsData, years) {
  const historical = (financialsData.annual ?? []).map((p) => ({ date: p.date, historicalFCF: p.freeCF, projectedFCF: null }))
  const projected = years.map((y) => ({ date: `Year ${y.year}`, historicalFCF: null, projectedFCF: y.fcf }))
  return [...historical, ...projected]
}

export default function DCFTab({ investments }) {
  const { user } = useAuth()
  const { avKey, loading: settingsLoading } = useUserSettings(user?.id)
  const [data, setData] = useState({})
  const [activeSymbol, setActiveSymbol] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [loadingSymbol, setLoadingSymbol] = useState(null)
  const [overrides, setOverrides] = useState({})

  const stockSymbols = [...new Set(investments.filter((i) => i.assetType === 'Stock' || i.assetType === 'Option').map((i) => i.symbol))]

  async function research(rawSymbol) {
    const symbol = rawSymbol.trim().toUpperCase()
    if (!symbol) return
    setActiveSymbol(symbol)
    setInputValue('')
    setOverrides({})
    if (data[symbol]) return

    const cacheRaw = localStorage.getItem('bt_financials_cache')
    const localCache = cacheRaw ? JSON.parse(cacheRaw) : {}
    if (localCache[symbol]) {
      setData((prev) => ({ ...prev, [symbol]: localCache[symbol] }))
      return
    }

    const shared = await getSharedCache(symbol)
    if (shared) {
      setData((prev) => ({ ...prev, [symbol]: shared }))
      localCache[symbol] = shared
      localStorage.setItem('bt_financials_cache', JSON.stringify(localCache))
      return
    }

    if (!avKey) return
    setLoadingSymbol(symbol)
    const result = await fetchFinancials(symbol, avKey)
    setData((prev) => ({ ...prev, [symbol]: result }))
    setLoadingSymbol(null)

    localCache[symbol] = result
    localStorage.setItem('bt_financials_cache', JSON.stringify(localCache))
    await saveSharedCache(symbol, result, user?.id)
  }

  useEffect(() => {
    if (avKey && !activeSymbol && stockSymbols.length > 0) {
      research(stockSymbols[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avKey, stockSymbols.length])

  if (!settingsLoading && !avKey) {
    return (
      <div className="fin-key-required">
        <p>Key Required</p>
        <p>Add your Alpha Vantage API key in Settings to run a DCF valuation.</p>
        <Link to="/settings">Go to Settings</Link>
      </div>
    )
  }

  const financialsData = activeSymbol ? data[activeSymbol] : null
  const investment = activeSymbol ? investments.find((i) => i.symbol === activeSymbol) : null
  const fundamentalsCacheEntry = activeSymbol ? getFundamentalsCacheEntry(activeSymbol) : null

  const derived = financialsData
    ? deriveDcfInputs({ financialsData, fundamentalsCacheEntry, investment })
    : { baseFCF: null, netCash: null, impliedGrowthPct: null, sharesOutstanding: null, currentPrice: null }

  const baseFCF = overrides.baseFCF ?? derived.baseFCF ?? 0
  const netCash = overrides.netCash ?? derived.netCash ?? 0
  const sharesOutstanding = overrides.sharesOutstanding ?? derived.sharesOutstanding
  const currentPrice = overrides.currentPrice ?? derived.currentPrice
  const growthRatePct = overrides.growthRatePct ?? clamp(derived.impliedGrowthPct ?? 10, -30, 60)
  const terminalRatePct = overrides.terminalRatePct ?? 3
  const discountRatePct = overrides.discountRatePct ?? 10

  const result = financialsData
    ? runDcf({ baseFCF, growthRatePct, terminalRatePct, discountRatePct, netCash, sharesOutstanding })
    : null
  const margin = result ? marginOfSafety(result.intrinsicValue, currentPrice) : null
  const grid = financialsData
    ? buildSensitivityGrid({ baseFCF, growthRatePct, terminalRatePct, netCash, sharesOutstanding, currentPrice })
    : []

  function setOverride(key, value) {
    setOverrides((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="dcf-tab">
      <div className="fin-symbol-picker">
        {stockSymbols.map((symbol) => (
          <button
            key={symbol}
            type="button"
            className={`fin-chip${symbol === activeSymbol ? ' fin-chip--active' : ''}`}
            onClick={() => research(symbol)}
          >
            {symbol}
          </button>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); research(inputValue) }}>
          <label htmlFor="dcfAddSymbol">Add symbol</label>
          <input
            id="dcfAddSymbol"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); research(inputValue) } }}
          />
        </form>
      </div>

      {loadingSymbol && <p>Loading {loadingSymbol}…</p>}

      {financialsData && result && (
        <div className="dcf-panels">
          <section className="dcf-inputs">
            <h2>Inputs</h2>
            <div className="dcf-input-grid">
              <label>
                Base FCF
                <input value={overrides.baseFcfText ?? formatLarge(baseFCF)} onChange={(e) => {
                  setOverride('baseFcfText', e.target.value)
                  const parsed = parseShorthandNumber(e.target.value)
                  if (parsed !== null) setOverride('baseFCF', parsed)
                }} />
              </label>
              <label>
                Net Cash/Debt
                <input value={overrides.netCashText ?? formatLarge(netCash)} onChange={(e) => {
                  setOverride('netCashText', e.target.value)
                  const parsed = parseShorthandNumber(e.target.value)
                  if (parsed !== null) setOverride('netCash', parsed)
                }} />
              </label>
              <label>
                Shares Outstanding
                <input value={sharesOutstanding ?? ''} onChange={(e) => setOverride('sharesOutstanding', Number(e.target.value) || null)} />
              </label>
              <label>
                Current Price
                <input value={currentPrice ?? ''} onChange={(e) => setOverride('currentPrice', Number(e.target.value) || null)} />
              </label>
              <label>
                FCF Growth Rate Yr1-5: {growthRatePct.toFixed(1)}%
                <input type="range" min="-30" max="60" value={growthRatePct} onChange={(e) => setOverride('growthRatePct', Number(e.target.value))} />
              </label>
              <label>
                Terminal Growth Rate: {terminalRatePct.toFixed(1)}%
                <input type="range" min="0" max="6" step="0.1" value={terminalRatePct} onChange={(e) => setOverride('terminalRatePct', Number(e.target.value))} />
              </label>
              <label>
                Discount Rate (WACC): {discountRatePct.toFixed(1)}%
                <input type="range" min="5" max="20" step="0.5" value={discountRatePct} onChange={(e) => setOverride('discountRatePct', Number(e.target.value))} />
              </label>
            </div>
          </section>

          <section className="dcf-results">
            <h2>Intrinsic Value</h2>
            <div className="dcf-result-tiles">
              <div className="dcf-result-tile">
                <span className="dcf-result-label">Intrinsic Value / Share</span>
                <span className="dcf-result-value mono" data-testid="intrinsic-value">
                  {result.intrinsicValue !== null ? formatCurrency(result.intrinsicValue) : '—'}
                </span>
              </div>
              <div className="dcf-result-tile">
                <span className="dcf-result-label">Current Price</span>
                <span className="dcf-result-value mono">{currentPrice ? formatCurrency(currentPrice) : '—'}</span>
              </div>
              <div className="dcf-result-tile">
                <span className="dcf-result-label">Margin of Safety</span>
                <span className={`dcf-result-value mono ${margin !== null ? (margin >= 0 ? 'dcf-positive' : 'dcf-negative') : ''}`}>
                  {margin !== null ? `${margin.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
          </section>

          <section className="dcf-years">
            <h2>Year-by-Year FCF</h2>
            <div className="dcf-table-wrap">
              <table className="dcf-table">
                <thead><tr><th>Year</th><th>Projected FCF</th><th>PV</th></tr></thead>
                <tbody>
                  {result.years.map((y) => (
                    <tr key={y.year}>
                      <td>Year {y.year}</td>
                      <td className="mono">{formatLarge(y.fcf)}</td>
                      <td className="mono">{formatLarge(y.discounted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="dcf-chart-section">
            <h2>FCF History & Projection</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={buildFcfChartData(financialsData, result.years)} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#262626" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#262626' }} tickLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#262626' }} tickLine={false} tickFormatter={(v) => formatLarge(v)} width={70} />
                <Tooltip
                  contentStyle={{ background: '#141414', border: '1px solid #262626', borderRadius: 6, fontSize: 12 }}
                  itemStyle={{ color: '#e5e5e5' }}
                  labelStyle={{ color: '#888' }}
                  formatter={(v) => formatLarge(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#888' }} />
                <Line type="monotone" dataKey="historicalFCF" name="Historical FCF" stroke="#3987e5" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                <Line type="monotone" dataKey="projectedFCF" name="Projected FCF" stroke="#3987e5" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="dcf-sensitivity">
            <h2>Sensitivity Grid</h2>
            <div className="dcf-table-wrap">
              <table className="dcf-table">
                <thead>
                  <tr>
                    <th>Discount \ Growth</th>
                    {[...new Set(grid.map((c) => c.growthRatePct))].map((g) => <th key={g}>{g.toFixed(0)}%</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...new Set(grid.map((c) => c.discountRatePct))].map((d) => (
                    <tr key={d}>
                      <td>{d}%</td>
                      {grid.filter((c) => c.discountRatePct === d).map((c) => (
                        <td key={c.growthRatePct} data-testid="sensitivity-cell" className={`dcf-cell-${c.bucket}`}>
                          {c.marginOfSafetyPct !== null ? `${c.marginOfSafetyPct.toFixed(0)}%` : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="dcf-breakdown">
            <h2>Math Breakdown</h2>
            <p>Base FCF: {formatLarge(baseFCF)}, grown at {growthRatePct.toFixed(1)}%/yr for 5 years, discounted at {discountRatePct.toFixed(1)}% (mid-year convention).</p>
            <p>Terminal Value: Year 5 FCF × (1 + {terminalRatePct.toFixed(1)}%) / ({discountRatePct.toFixed(1)}% − {terminalRatePct.toFixed(1)}%) = {formatLarge(result.terminalValue)}, discounted to {formatLarge(result.pvTerminal)}.</p>
            <p>Total Equity Value = Σ PV(FCF) + PV(Terminal) + Net Cash = {formatLarge(result.totalEquityValue)}.</p>
            <p>Intrinsic Value / Share = Total Equity Value ÷ Shares Outstanding{sharesOutstanding ? ` (${sharesOutstanding.toLocaleString()})` : ' (unknown — enter shares outstanding above)'}.</p>
          </section>
        </div>
      )}
    </div>
  )
}
