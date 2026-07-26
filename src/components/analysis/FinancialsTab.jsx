import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './FinancialsTab.css'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFinancials, fetchEpsHistory } from '../../lib/fetchFinancials'
import { getSharedCache, saveSharedCache } from '../../lib/financialsSharedCache'
import { pctChange } from '../../lib/pctChange'
import { formatLarge } from '../../lib/format'
import FinancialsCharts from './FinancialsCharts'

const INCOME_ROWS = [
  ['revenue', 'Revenue'], ['cogs', 'COGS'], ['grossProfit', 'Gross Profit'],
  ['rd', 'R&D'], ['sga', 'SG&A'], ['operatingIncome', 'Operating Income'],
  ['ebitda', 'EBITDA'], ['netIncome', 'Net Income'],
]
const BALANCE_ROWS = [
  ['cash', 'Cash'], ['cashAndShortTerm', 'Cash & Short-Term Investments'],
  ['currentAssets', 'Current Assets'], ['totalAssets', 'Total Assets'],
  ['currentLiabilities', 'Current Liabilities'], ['longTermDebt', 'Long-Term Debt'],
  ['totalLiabilities', 'Total Liabilities'], ['equity', 'Equity'],
  ['retainedEarnings', 'Retained Earnings'],
]
const CASH_FLOW_ROWS = [
  ['operatingCF', 'Operating CF'], ['capex', 'CapEx'], ['freeCF', 'Free Cash Flow'],
  ['depreciation', 'Depreciation'], ['dividendsPaid', 'Dividends Paid'],
  ['investingCF', 'Investing CF'], ['financingCF', 'Financing CF'],
]

function StatementTable({ title, rows, periods }) {
  const mostRecentFirst = [...periods].reverse()
  return (
    <section className="fin-section">
      <h2>{title}</h2>
      <div className="fin-table-wrap">
        <table className="fin-table">
          <thead>
            <tr>
              <th className="fin-sticky-col">Metric</th>
              {mostRecentFirst.map((p) => <th key={p.date}>{p.date}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, label]) => (
              <tr key={key}>
                <td className="fin-sticky-col">{label}</td>
                {mostRecentFirst.map((p, idx) => {
                  const prior = mostRecentFirst[idx + 1]
                  const change = prior ? pctChange(p[key], prior[key]) : null
                  return (
                    <td key={p.date} className="mono">
                      {p[key] === null ? '—' : formatLarge(p[key])}
                      {change !== null && (
                        <span className={`fin-badge ${change >= 0 ? 'fin-badge--up' : 'fin-badge--down'}`}>
                          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function FinancialsTab({ investments }) {
  const { user } = useAuth()
  const { avKey, loading: settingsLoading } = useUserSettings(user?.id)
  const [data, setData] = useState({})
  const [activeSymbol, setActiveSymbol] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [frequency, setFrequency] = useState('annual')
  const [loadingSymbol, setLoadingSymbol] = useState(null)
  const [view, setView] = useState('numbers')
  const [epsData, setEpsData] = useState({})
  const [epsLoading, setEpsLoading] = useState(false)

  const stockSymbols = [...new Set(investments.filter((i) => i.assetType === 'Stock').map((i) => i.symbol))]

  async function research(rawSymbol) {
    const symbol = rawSymbol.trim().toUpperCase()
    if (!symbol) return
    setActiveSymbol(symbol)
    setInputValue('')
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

  async function handleFetchEps() {
    if (!activeSymbol) return
    setEpsLoading(true)
    const result = await fetchEpsHistory(activeSymbol, avKey)
    setEpsData((prev) => ({ ...prev, [activeSymbol]: result }))
    setEpsLoading(false)
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
        <p>Add your Alpha Vantage API key in Settings to research financial statements.</p>
        <Link to="/settings">Go to Settings</Link>
      </div>
    )
  }

  const result = activeSymbol ? data[activeSymbol] : null
  const periods = result ? result[frequency] : []
  const eps = activeSymbol && epsData[activeSymbol] ? epsData[activeSymbol][frequency] : null

  return (
    <div className="financials-tab">
      <div className="fin-toolbar">
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
            <label htmlFor="finAddSymbol">Add symbol</label>
            <input
              id="finAddSymbol"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); research(inputValue) } }}
            />
          </form>
        </div>

        {result && (
          <div className="fin-view-toggle">
            <button type="button" aria-pressed={view === 'numbers'} onClick={() => setView('numbers')}>Numbers</button>
            <button type="button" aria-pressed={view === 'charts'} onClick={() => setView('charts')}>Charts</button>
          </div>
        )}
      </div>

      {result && (
        <div className="fin-header">
          <span className="fin-symbol" data-testid="fin-active-symbol">{activeSymbol}</span>
        </div>
      )}

      {result && (
        <div className="fin-frequency-toggle">
          <button type="button" aria-pressed={frequency === 'annual'} onClick={() => setFrequency('annual')}>Annual</button>
          <button type="button" aria-pressed={frequency === 'quarterly'} onClick={() => setFrequency('quarterly')}>Quarterly</button>
        </div>
      )}

      {loadingSymbol && loadingSymbol === activeSymbol && <p>Loading {activeSymbol}…</p>}

      {result && periods.length > 0 && view === 'numbers' && (
        <div className="fin-panels">
          <StatementTable title="Income Statement" rows={INCOME_ROWS} periods={periods} />
          <StatementTable title="Balance Sheet" rows={BALANCE_ROWS} periods={periods} />
          <StatementTable title="Cash Flow" rows={CASH_FLOW_ROWS} periods={periods} />
        </div>
      )}

      {result && periods.length > 0 && view === 'charts' && (
        <FinancialsCharts periods={periods} eps={eps} onFetchEps={handleFetchEps} epsLoading={epsLoading} />
      )}
    </div>
  )
}
