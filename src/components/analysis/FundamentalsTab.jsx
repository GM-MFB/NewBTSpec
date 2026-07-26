import { useState } from 'react'
import { Link } from 'react-router-dom'
import './FundamentalsTab.css'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFundamentals, fetchPeers } from '../../lib/fetchFundamentals'
import { KNOWN_ETFS } from '../../lib/knownEtfs'
import SymbolPanels from './SymbolPanels'

export default function FundamentalsTab({ investments }) {
  const { user } = useAuth()
  const { finnhubKey, loading: settingsLoading } = useUserSettings(user?.id)
  const [data, setData] = useState({})
  const [peers, setPeers] = useState({})
  const [activeSymbol, setActiveSymbol] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [loadingSymbol, setLoadingSymbol] = useState(null)

  const stockSymbols = [...new Set(investments.filter((i) => i.assetType === 'Stock').map((i) => i.symbol))]

  async function research(rawSymbol) {
    const symbol = rawSymbol.trim().toUpperCase()
    if (!symbol) return
    setActiveSymbol(symbol)
    setInputValue('')
    if (KNOWN_ETFS.has(symbol) || data[symbol]) return

    setLoadingSymbol(symbol)
    const [result, peerList] = await Promise.all([
      fetchFundamentals(symbol, finnhubKey),
      fetchPeers(symbol, finnhubKey),
    ])
    setData((prev) => ({ ...prev, [symbol]: result }))
    setPeers((prev) => ({ ...prev, [symbol]: peerList }))
    setLoadingSymbol(null)

    const cacheRaw = localStorage.getItem('bt_fundamentals_cache')
    const cache = cacheRaw ? JSON.parse(cacheRaw) : {}
    cache[symbol] = { profile: result.profile, metrics: result.metrics, quote: result.quote }
    localStorage.setItem('bt_fundamentals_cache', JSON.stringify(cache))
  }

  if (!settingsLoading && !finnhubKey) {
    return (
      <div className="fund-key-required">
        <p>Key Required</p>
        <p>Add your Finnhub API key in Settings to research fundamentals.</p>
        <Link to="/settings">Go to Settings</Link>
      </div>
    )
  }

  const isEtf = activeSymbol && KNOWN_ETFS.has(activeSymbol)
  const result = activeSymbol ? data[activeSymbol] : null
  const investment = activeSymbol ? investments.find((i) => i.symbol === activeSymbol) : null

  return (
    <div className="fundamentals-tab">
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
          <label htmlFor="fundAddSymbol">Add symbol</label>
          <input
            id="fundAddSymbol"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); research(inputValue) } }}
          />
        </form>
      </div>

      {isEtf && (
        <div className="fund-etf-card">
          <p>No financials available for ETFs.</p>
          <a href={`https://etf.com/${activeSymbol}`} target="_blank" rel="noreferrer">ETF.com</a>
          <a href={`https://finance.yahoo.com/quote/${activeSymbol}`} target="_blank" rel="noreferrer">Yahoo Finance</a>
          <a href={`https://www.morningstar.com/etfs/xnas/${activeSymbol}/quote`} target="_blank" rel="noreferrer">Morningstar</a>
        </div>
      )}

      {loadingSymbol && loadingSymbol === activeSymbol && <p>Loading {activeSymbol}…</p>}

      {result && !isEtf && (
        <SymbolPanels
          symbol={activeSymbol}
          result={result}
          investment={investment}
          peers={peers[activeSymbol] ?? []}
          onResearchPeer={research}
        />
      )}
    </div>
  )
}
