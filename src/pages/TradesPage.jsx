import { useState } from 'react'
import './TradesPage.css'
import '../pages/StatsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useTrades } from '../hooks/useTrades'
import { computeTradeStats } from '../lib/tradeStatsSummary'
import { groupTradesByDay } from '../lib/groupTradesByDay'
import { generateTradeExcelWorkbook } from '../lib/tradeExcelExport'
import { isWithinDateRange } from '../lib/dateRange'
import { formatCurrency } from '../lib/format'
import Header from '../components/Header'
import TradeRow from '../components/TradeRow'
import AddTradeModal from '../components/AddTradeModal'
import TradeCalendar from '../components/TradeCalendar'
import TradeStatsCharts from '../components/TradeStatsCharts'

const TABS = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'stats', label: 'Stats' },
]

function formatDayHeading(dateStr) {
  if (dateStr === 'No Date') return dateStr
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function StatTile({ label, value, tone }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-label">{label}</span>
      <span className={`stat-tile-value mono ${tone ? `stat-tile-value--${tone}` : ''}`}>{value}</span>
    </div>
  )
}

export default function TradesPage() {
  const { user, signOut } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount, deleteAccount, renameAccount } = useAccounts(user?.id)
  const { trades, error, reload, addTrade, updateTrade, deleteTrade } = useTrades(activeAccountId)
  const [tab, setTab] = useState('calendar')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const filteredTrades = trades.filter((t) => isWithinDateRange(t.exitDate, startDate, endDate))
  const stats = computeTradeStats(filteredTrades)

  return (
    <div data-testid="trades-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        deleteAccount={deleteAccount}
        renameAccount={renameAccount}
        onSignOut={signOut}
        onAddTrade={() => setAddOpen(true)}
      />

      <div className="trades-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
        <button
          type="button"
          className="trades-export-btn"
          onClick={() => generateTradeExcelWorkbook(trades)}
        >
          Export Excel
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span>Couldn't load trades.</span>
          <button type="button" onClick={reload}>Retry</button>
        </div>
      )}

      {tab === 'calendar' && (
        <>
          <TradeCalendar trades={trades} />

          {trades.length === 0 ? (
            <p className="empty-state">No trades yet — add one to get started</p>
          ) : (
            <div className="trade-day-groups">
              {groupTradesByDay(trades).map((group) => (
                <section key={group.date} className="trade-day-group">
                  <h2 className="trade-day-heading" data-testid="trade-day-heading">
                    <span>{formatDayHeading(group.date)}</span>
                    {group.totalPnl !== null && (
                      <span className={`mono ${group.totalPnl >= 0 ? 'price-favorable' : 'price-unfavorable'}`}>
                        {formatCurrency(group.totalPnl)}
                      </span>
                    )}
                  </h2>
                  <ul className="trade-list">
                    {group.trades.map((trade) => (
                      <TradeRow key={trade.id} trade={trade} onEdit={setEditing} onDelete={deleteTrade} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'stats' && (
        <div className="stats-numbers">
          <div className="stats-toolbar">
            <div className="date-range-filter">
              <label htmlFor="tradesStartDate">From</label>
              <input id="tradesStartDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <label htmlFor="tradesEndDate">To</label>
              <input id="tradesEndDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              {(startDate || endDate) && (
                <button type="button" onClick={() => { setStartDate(''); setEndDate('') }}>Clear</button>
              )}
            </div>
          </div>

          <section className="stats-section">
            <h2 className="stats-section-title">Overview</h2>
            <div className="stat-tile-grid">
              <StatTile label="Total Realized P&L" value={formatCurrency(stats.totalRealizedPnl)} tone={stats.totalRealizedPnl >= 0 ? 'positive' : 'negative'} />
              <StatTile label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
              <StatTile label="Total Trades" value={stats.totalClosed} />
              <StatTile label="Avg Win" value={formatCurrency(stats.avgWin)} tone="positive" />
              <StatTile label="Avg Loss" value={formatCurrency(stats.avgLoss)} tone="negative" />
              <StatTile label="Best Trade" value={stats.bestTrade ? stats.bestTrade.symbol : '—'} tone="positive" />
              <StatTile label="Worst Trade" value={stats.worstTrade ? stats.worstTrade.symbol : '—'} tone="negative" />
            </div>
          </section>

          <TradeStatsCharts stats={stats} />
        </div>
      )}

      {addOpen && (
        <AddTradeModal
          onClose={() => setAddOpen(false)}
          onSubmit={async (trade) => {
            await addTrade(trade, user.id)
            setAddOpen(false)
          }}
        />
      )}

      {editing && (
        <AddTradeModal
          initialValues={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (fields) => {
            await updateTrade(editing.id, fields)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
