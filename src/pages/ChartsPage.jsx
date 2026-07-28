import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import './ChartsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useWatchlist } from '../hooks/useWatchlist'
import { buildLeaderboard } from '../lib/watchlistLeaderboard'
import TradingViewWidget from '../components/TradingViewWidget'
import Header from '../components/Header'

const STORAGE_KEY = 'bt_charts_symbol'

export default function ChartsPage() {
  const { user, signOut } = useAuth()
  const { accounts, activeAccount, switchAccount, createAccount, deleteAccount, renameAccount } = useAccounts(user?.id)
  const { entries } = useWatchlist(user?.id)
  const [searchParams] = useSearchParams()

  const paramSymbol = searchParams.get('symbol')
  const [symbol, setSymbol] = useState(() => {
    const initial = paramSymbol || localStorage.getItem(STORAGE_KEY) || 'AAPL'
    return initial.toUpperCase()
  })

  const leaderboard = buildLeaderboard(entries)

  useEffect(() => {
    if (paramSymbol) {
      setActiveSymbol(paramSymbol.toUpperCase())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramSymbol])

  function setActiveSymbol(next) {
    setSymbol(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  return (
    <div data-testid="charts-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        deleteAccount={deleteAccount}
        renameAccount={renameAccount}
        onSignOut={signOut}
        showAddButton={false}
      />

      <div className="charts-page">
        <aside className="charts-sidebar">
          <h2>Watchlist</h2>
          {leaderboard.length === 0 ? (
            <p className="charts-sidebar-empty">No watchlist symbols yet.</p>
          ) : (
            <ul>
              {leaderboard.map((row) => (
                <li key={row.symbol}>
                  <button
                    type="button"
                    data-testid="charts-sidebar-row"
                    className={row.symbol === symbol ? 'active' : undefined}
                    onClick={() => setActiveSymbol(row.symbol)}
                  >
                    <span className="charts-sidebar-symbol">{row.symbol}</span>
                    <span className="charts-sidebar-count">{row.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="charts-main">
          <div className="charts-widget-wrapper">
            <TradingViewWidget symbol={symbol} />
          </div>
        </main>
      </div>
    </div>
  )
}
