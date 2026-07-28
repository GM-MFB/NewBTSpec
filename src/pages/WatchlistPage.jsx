import { useEffect, useState } from 'react'
import './WatchlistPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useUserSettings } from '../hooks/useUserSettings'
import { useWatchlist } from '../hooks/useWatchlist'
import { buildLeaderboard } from '../lib/watchlistLeaderboard'
import { fetchWatchlistQuote } from '../lib/fetchWatchlistQuotes'
import { assignColors } from '../lib/colorAssignment'
import { formatCurrency } from '../lib/format'
import Header from '../components/Header'

export default function WatchlistPage() {
  const { user, signOut } = useAuth()
  const { accounts, activeAccount, switchAccount, createAccount, deleteAccount, renameAccount } = useAccounts(user?.id)
  const { finnhubKey, displayName } = useUserSettings(user?.id)
  const { entries, addEntry, removeEntry } = useWatchlist(user?.id)
  const [symbolInput, setSymbolInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [quotes, setQuotes] = useState({})

  const leaderboard = buildLeaderboard(entries)
  const uniqueSymbols = [...new Set(entries.map((e) => e.symbol))]

  useEffect(() => {
    if (!finnhubKey) return
    for (const symbol of uniqueSymbols) {
      if (quotes[symbol]) continue
      fetchWatchlistQuote(symbol, finnhubKey)
        .then((q) => setQuotes((prev) => ({ ...prev, [symbol]: q })))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finnhubKey, uniqueSymbols.join(',')])

  const myEntry = (symbol) => entries.find((e) => e.userId === user?.id && e.symbol === symbol)

  async function handleAdd(e) {
    e.preventDefault()
    const symbol = symbolInput.trim().toUpperCase()
    if (!symbol) return
    if (myEntry(symbol)) return
    await addEntry(symbol, noteInput.trim(), displayName || user?.email || '')
    setSymbolInput('')
    setNoteInput('')
  }

  function renderQuote(symbol) {
    const q = quotes[symbol]
    if (!finnhubKey || !q) return <span className="watchlist-quote-empty">—</span>
    const sign = q.changePct >= 0 ? '+' : ''
    const cls = q.changePct >= 0 ? 'watchlist-change-up' : 'watchlist-change-down'
    return (
      <span className="watchlist-quote">
        <span className="mono">{formatCurrency(q.price)}</span>
        <span className={`mono ${cls}`}>{sign}{q.changePct.toFixed(2)}%</span>
      </span>
    )
  }

  const byPerson = new Map()
  for (const entry of entries) {
    if (!byPerson.has(entry.userId)) byPerson.set(entry.userId, { displayName: entry.displayName, items: [] })
    byPerson.get(entry.userId).items.push(entry)
  }

  const symbolColors = assignColors(leaderboard.map((r) => r.symbol))
  const personColors = assignColors([...byPerson.values()].map((g) => g.displayName))

  const podium = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)

  function renderLeaderboardCard(row, rank, isPodium) {
    return (
      <li
        key={row.symbol}
        data-testid="leaderboard-row"
        className={isPodium ? 'watchlist-podium-card' : 'watchlist-list-row'}
        style={{ borderColor: symbolColors[row.symbol] }}
      >
        <span className="watchlist-rank" style={{ color: symbolColors[row.symbol] }}>#{rank}</span>
        <span className="watchlist-symbol">{row.symbol}</span>
        {renderQuote(row.symbol)}
        <span className="watchlist-count">{row.count} {row.count === 1 ? 'person' : 'people'} — {row.people.join(', ')}</span>
      </li>
    )
  }

  return (
    <div data-testid="watchlist-page">
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

      <div className="watchlist-page">
        <form className="watchlist-add-form" onSubmit={handleAdd}>
          <label htmlFor="watchlistSymbol">Symbol</label>
          <input id="watchlistSymbol" value={symbolInput} onChange={(e) => setSymbolInput(e.target.value)} />
          <label htmlFor="watchlistNote">Note (optional)</label>
          <input id="watchlistNote" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
          <button type="submit">Add to Watchlist</button>
        </form>

        <section className="watchlist-leaderboard">
          <h2>Most Watched</h2>
          {podium.length > 0 && (
            <ol className="watchlist-podium">
              {podium.map((row, i) => renderLeaderboardCard(row, i + 1, true))}
            </ol>
          )}
          {rest.length > 0 && (
            <ol className="watchlist-list" start={4}>
              {rest.map((row, i) => renderLeaderboardCard(row, i + 4, false))}
            </ol>
          )}
        </section>

        <section className="watchlist-by-person">
          <h2>Individual Watchlists</h2>
          <div className="watchlist-person-grid">
            {[...byPerson.entries()].map(([userId, group]) => (
              <div key={userId} className="watchlist-person-card" style={{ borderColor: personColors[group.displayName] }}>
                <div className="watchlist-person-header">
                  <span className="watchlist-avatar" style={{ background: personColors[group.displayName] }}>
                    {group.displayName.charAt(0).toUpperCase()}
                  </span>
                  <h3>{group.displayName}</h3>
                </div>
                <ul>
                  {group.items.map((entry) => (
                    <li key={entry.id}>
                      <span className="watchlist-symbol-dot" style={{ background: symbolColors[entry.symbol] }} />
                      <span className="watchlist-symbol">{entry.symbol}</span>
                      {renderQuote(entry.symbol)}
                      {entry.note && <span className="watchlist-note">{entry.note}</span>}
                      {entry.userId === user?.id && (
                        <button type="button" className="watchlist-remove" aria-label={`Remove ${entry.symbol}`} onClick={() => removeEntry(entry.id)}>
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
