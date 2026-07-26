import { useEffect, useState } from 'react'
import './FrontierTab.css'
import FrontierPanel from './FrontierPanel'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchQuote } from '../../lib/finnhub'
import { fetchCorrelations } from '../../lib/fetchCorrelations'
import { setRealCorrelations, setComputedParams } from '../../lib/efficientFrontier'
import { formatCurrency } from '../../lib/format'

export default function FrontierTab({ investments, incomingSymbols = null }) {
  const { user } = useAuth()
  const { finnhubKey } = useUserSettings(user?.id)
  const [mode, setMode] = useState(incomingSymbols && incomingSymbols.length > 0 ? 'custom' : 'portfolio')
  const [customSymbols, setCustomSymbols] = useState(incomingSymbols ?? [])
  const [customInput, setCustomInput] = useState('')
  const [customPrices, setCustomPrices] = useState({})
  const [fetchErrors, setFetchErrors] = useState({})

  useEffect(() => {
    if (incomingSymbols && incomingSymbols.length > 0) {
      setCustomSymbols(incomingSymbols)
      setMode('custom')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSymbols])

  const portfolioPositions = investments.filter((i) => ['Stock', 'ETF', 'Crypto'].includes(i.assetType))
  const portfolioSymbols = portfolioPositions.map((p) => p.symbol)
  const symbols = mode === 'custom' ? customSymbols : portfolioSymbols

  useEffect(() => {
    if (symbols.length < 2) return
    fetchCorrelations(symbols).then(({ corrMap, paramsMap }) => {
      setRealCorrelations(corrMap)
      setComputedParams(paramsMap)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')])

  function addCustomSymbol(rawSymbol) {
    const symbol = rawSymbol.trim().toUpperCase()
    if (!symbol) return
    setCustomSymbols((prev) => (prev.includes(symbol) ? prev : [...prev, symbol]))
    setCustomInput('')
  }

  function removeCustomSymbol(symbol) {
    setCustomSymbols((prev) => prev.filter((s) => s !== symbol))
  }

  async function handleFetchPrices() {
    setFetchErrors({})
    for (const symbol of customSymbols) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const quote = await fetchQuote(symbol, finnhubKey)
        setCustomPrices((prev) => ({ ...prev, [symbol]: quote.c }))
      } catch {
        setFetchErrors((prev) => ({ ...prev, [symbol]: true }))
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  let weights
  let priceMap
  if (mode === 'custom') {
    weights = customSymbols.map(() => (customSymbols.length > 0 ? 1 / customSymbols.length : 0))
    priceMap = customPrices
  } else {
    const totalMV = portfolioPositions.reduce((sum, p) => sum + p.shares * p.currentPrice, 0)
    weights = portfolioPositions.map((p) => (totalMV > 0 ? (p.shares * p.currentPrice) / totalMV : 0))
    priceMap = Object.fromEntries(portfolioPositions.map((p) => [p.symbol, p.currentPrice]))
  }

  return (
    <div className="frontier-tab">
      <div className="frontier-mode-toggle">
        <button type="button" aria-pressed={mode === 'portfolio'} onClick={() => setMode('portfolio')}>My Portfolio</button>
        <button type="button" aria-pressed={mode === 'custom'} onClick={() => setMode('custom')}>Custom Set</button>
      </div>

      {mode === 'custom' && (
        <div className="frontier-custom-picker">
          <div className="frontier-custom-chips">
            {customSymbols.map((symbol) => (
              <span key={symbol} className="frontier-custom-chip">
                {symbol}
                <button type="button" aria-label={`Remove ${symbol}`} onClick={() => removeCustomSymbol(symbol)}>×</button>
              </span>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); addCustomSymbol(customInput) }}>
            <label htmlFor="frontierAddSymbol">Add symbol</label>
            <input
              id="frontierAddSymbol"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSymbol(customInput) } }}
            />
          </form>
          <button type="button" onClick={handleFetchPrices}>Fetch</button>

          {customSymbols.length > 0 && (
            <table className="frontier-price-table">
              <thead><tr><th>Symbol</th><th>Price</th></tr></thead>
              <tbody>
                {customSymbols.map((symbol) => (
                  <tr key={symbol}>
                    <th scope="row">{symbol}</th>
                    <td className="mono">
                      {fetchErrors[symbol] ? 'error' : (customPrices[symbol] ? formatCurrency(customPrices[symbol]) : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {symbols.length < 2 ? (
        <div className="frontier-empty">
          <p>
            {mode === 'custom'
              ? 'Add at least 2 symbols to see the Efficient Frontier.'
              : 'Add at least 2 open positions to see your Efficient Frontier.'}
          </p>
        </div>
      ) : (
        <FrontierPanel
          symbols={symbols}
          weights={weights}
          storageKey={mode === 'custom' ? 'bt_ef_custom_params' : 'bt_ef_params'}
          priceMap={priceMap}
        />
      )}
    </div>
  )
}
