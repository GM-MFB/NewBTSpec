import { useEffect, useState } from 'react'
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

  function handleClearAll() {
    setCompareSymbols([])
  }

  useEffect(() => {
    if (finnhubKey && !activeSymbol && stockSymbols.length > 0) {
      research(stockSymbols[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finnhubKey, stockSymbols.length])

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
          {stockSymbols.map((symbol) => {
            const isActive = view === 'compare' ? compareSymbols.includes(symbol) : symbol === activeSymbol
            return (
              <button
                key={symbol}
                type="button"
                className={`fund-chip${isActive ? ' fund-chip--active' : ''}`}
                onClick={() => research(symbol)}
              >
                {symbol}
              </button>
            )
          })}
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
        <div className="research-compare-actions">
          <button type="button" className="research-sector-toggle" onClick={() => setShowSectorBrowser((v) => !v)}>
            {showSectorBrowser ? 'Hide' : 'Browse by Sector'}
          </button>
          {compareSymbols.length > 0 && (
            <button type="button" className="research-clear-all" onClick={handleClearAll}>Clear All</button>
          )}
        </div>
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
