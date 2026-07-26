import { useState } from 'react'
import './OptimizerTab.css'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchQuote } from '../../lib/finnhub'
import { findOptimalSubset, findOptimalSubsetForSymbols, getCorrVersion } from '../../lib/efficientFrontier'
import { formatCurrency } from '../../lib/format'

const SIM_LEVELS = [
  { key: 'fast', label: 'Fast', nSim: 3000 },
  { key: 'standard', label: 'Standard', nSim: 6000 },
  { key: 'high', label: 'High', nSim: 15000 },
  { key: 'max', label: 'Max', nSim: 40000 },
]

export default function OptimizerTab({ investments, incomingSymbols = null }) {
  const { user } = useAuth()
  const { finnhubKey } = useUserSettings(user?.id)
  const [mode, setMode] = useState(incomingSymbols ? 'custom' : 'portfolio')
  const [simLevel, setSimLevel] = useState('standard')
  const [priceOverrides, setPriceOverrides] = useState({})
  const [fetchErrors, setFetchErrors] = useState({})
  const [totalToInvest, setTotalToInvest] = useState('')
  const [result, setResult] = useState(null)
  const [ranWithVersion, setRanWithVersion] = useState(null)

  const portfolioSymbols = investments.filter((i) => ['Stock', 'ETF', 'Crypto'].includes(i.assetType)).map((i) => i.symbol)
  const symbols = mode === 'custom' ? (incomingSymbols ?? []) : portfolioSymbols

  function priceFor(symbol) {
    if (priceOverrides[symbol] !== undefined) return priceOverrides[symbol]
    const inv = investments.find((i) => i.symbol === symbol)
    return inv?.currentPrice ?? null
  }

  async function handleFetchPrices() {
    setFetchErrors({})
    for (const symbol of symbols) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const quote = await fetchQuote(symbol, finnhubKey)
        setPriceOverrides((prev) => ({ ...prev, [symbol]: quote.c }))
      } catch {
        setFetchErrors((prev) => ({ ...prev, [symbol]: true }))
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  function handleRun() {
    const nSim = SIM_LEVELS.find((l) => l.key === simLevel).nSim
    const runFn = mode === 'custom' ? findOptimalSubsetForSymbols : findOptimalSubset
    setResult(runFn(symbols, nSim))
    setRanWithVersion(getCorrVersion())
  }

  const isStale = ranWithVersion !== null && ranWithVersion !== getCorrVersion()

  return (
    <div className="optimizer-tab">
      <div className="optimizer-mode-toggle">
        <button type="button" aria-pressed={mode === 'portfolio'} onClick={() => setMode('portfolio')}>Portfolio</button>
        <button type="button" aria-pressed={mode === 'custom'} onClick={() => setMode('custom')}>Custom</button>
      </div>

      {mode === 'custom' && (
        <label htmlFor="optimizerTotalToInvest">
          Total to invest
          <input id="optimizerTotalToInvest" value={totalToInvest} onChange={(e) => setTotalToInvest(e.target.value)} />
        </label>
      )}

      <div className="optimizer-sim-selector">
        {SIM_LEVELS.map((level) => (
          <button key={level.key} type="button" aria-pressed={simLevel === level.key} onClick={() => setSimLevel(level.key)}>
            {level.label}
          </button>
        ))}
      </div>

      <section className="optimizer-assumptions">
        <h2>Assumptions</h2>
        <button type="button" onClick={handleFetchPrices}>Fetch</button>
        <table className="optimizer-table">
          <thead><tr><th>Symbol</th><th>Price</th></tr></thead>
          <tbody>
            {symbols.map((symbol) => (
              <tr key={symbol}>
                <th scope="row">{symbol}</th>
                <td className="mono">
                  {fetchErrors[symbol] ? 'error' : (priceFor(symbol) ? formatCurrency(priceFor(symbol)) : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <button type="button" onClick={handleRun}>Run Optimizer</button>
      {isStale && <p className="optimizer-stale-badge">Correlation data has been refreshed — re-run for updated results.</p>}

      {result && (
        <section className="optimizer-trail">
          <h2>Elimination Trail</h2>
          {result.steps.map((step, idx) => (
            <div key={idx} className="optimizer-trail-row">
              {result.fullSymbols.map((symbol) => (
                <span key={symbol} className={step.symbols.includes(symbol) ? 'optimizer-kept' : 'optimizer-dropped'}>
                  {symbol}
                </span>
              ))}
              <span className="mono">Sharpe {step.sharpe.toFixed(2)}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
