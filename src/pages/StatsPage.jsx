import { useRef, useState } from 'react'
import '../pages/InvestmentsPage.css'
import './StatsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestmentsHistory } from '../hooks/useInvestmentsHistory'
import { computeInvestmentStats } from '../lib/investmentStats'
import { formatCurrency } from '../lib/format'
import { isWithinDateRange } from '../lib/dateRange'
import { groupClosedByDateAndStrategy } from '../lib/groupClosedInvestments'
import { buildExportData } from '../lib/exportData'
import { generatePdfReport } from '../lib/pdfReport'
import { generateExcelWorkbook } from '../lib/excelExport'
import Header from '../components/Header'
import StatsCharts from '../components/StatsCharts'
import InvestmentRow from '../components/InvestmentRow'
import AddInvestmentModal from '../components/AddInvestmentModal'

function StatTile({ label, value, tone }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-label">{label}</span>
      <span className={`stat-tile-value mono ${tone ? `stat-tile-value--${tone}` : ''}`}>{value}</span>
    </div>
  )
}

function formatCloseDate(date) {
  if (date === 'No Date') return 'No Close Date'
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export default function StatsPage() {
  const { user, signOut } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount, deleteAccount, renameAccount } = useAccounts(user?.id)
  const { investments, loading, error, reload, deleteInvestment, updateInvestment } = useInvestmentsHistory(activeAccountId)
  const [view, setView] = useState('numbers')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [editing, setEditing] = useState(null)
  const chartsRef = useRef(null)

  const filteredInvestments = investments.filter((i) =>
    i.status === 'closed'
      ? isWithinDateRange(i.sellDate, startDate, endDate)
      : isWithinDateRange(i.buyDate, startDate, endDate)
  )

  const stats = computeInvestmentStats(filteredInvestments)

  const closedInvestments = filteredInvestments.filter((i) => i.status === 'closed')
  const openInvestments = filteredInvestments.filter((i) => i.status === 'open')
  const closedByDate = groupClosedByDateAndStrategy(closedInvestments)

  async function handleExportPdf() {
    const data = buildExportData({ stats, closedInvestments, openInvestments, accountName: activeAccount?.name ?? '', startDate, endDate })
    await generatePdfReport(data, chartsRef.current)
  }

  function handleExportExcel() {
    const data = buildExportData({ stats, closedInvestments, openInvestments, accountName: activeAccount?.name ?? '', startDate, endDate })
    generateExcelWorkbook(data)
  }

  return (
    <div data-testid="stats-page">
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

      <div className="stats-toolbar">
        <div className="date-range-filter">
          <label htmlFor="statsStartDate">From</label>
          <input id="statsStartDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <label htmlFor="statsEndDate">To</label>
          <input id="statsEndDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          {(startDate || endDate) && (
            <button type="button" onClick={() => { setStartDate(''); setEndDate('') }}>Clear</button>
          )}
        </div>

        <div className="export-buttons">
          <button type="button" onClick={handleExportPdf} disabled={loading}>Export PDF</button>
          <button type="button" onClick={handleExportExcel} disabled={loading}>Export Excel</button>
        </div>

        <div className="view-toggle">
          <button type="button" aria-pressed={view === 'numbers'} onClick={() => setView('numbers')}>Numbers</button>
          <button type="button" aria-pressed={view === 'charts'} onClick={() => setView('charts')}>Charts</button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>Couldn't load stats.</span>
          <button type="button" onClick={reload}>Retry</button>
        </div>
      )}

      {!loading && (
        <div ref={chartsRef} className={view === 'charts' ? '' : 'stats-charts-hidden'}>
          <StatsCharts stats={stats} />
        </div>
      )}

      {!loading && view === 'numbers' && (
        <div className="stats-numbers">
          <section className="stats-section">
            <h2 className="stats-section-title">Overview</h2>
            <div className="stat-tile-grid">
              <StatTile label="Total Realized P&L" value={formatCurrency(stats.totalRealizedPnl)} tone={stats.totalRealizedPnl >= 0 ? 'positive' : 'negative'} />
              <StatTile label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
              <StatTile label="Closed Positions" value={stats.totalClosed} />
              <StatTile label="Open Positions" value={stats.totalOpen} />
              <StatTile label="Avg Win" value={formatCurrency(stats.avgWin)} tone="positive" />
              <StatTile label="Avg Loss" value={formatCurrency(stats.avgLoss)} tone="negative" />
              <StatTile label="Best Trade" value={stats.bestTrade ? stats.bestTrade.symbol : '—'} tone="positive" />
              <StatTile label="Worst Trade" value={stats.worstTrade ? stats.worstTrade.symbol : '—'} tone="negative" />
            </div>
          </section>

          <section className="stats-section">
            <h2 className="stats-section-title">Stocks</h2>
            <div className="stat-tile-grid">
              <StatTile label="Closed Stock P&L" value={formatCurrency(stats.stock.totalPnl)} tone={stats.stock.totalPnl >= 0 ? 'positive' : 'negative'} />
              <StatTile label="Stock Win Rate" value={`${stats.stock.winRate.toFixed(1)}%`} />
              <StatTile label="Stock Positions Closed" value={stats.stock.count} />
            </div>
          </section>

          <section className="stats-section">
            <h2 className="stats-section-title">Options</h2>
            <div className="stat-tile-grid">
              <StatTile label="Closed Option P&L" value={formatCurrency(stats.options.totalPnl)} tone={stats.options.totalPnl >= 0 ? 'positive' : 'negative'} />
              <StatTile label="Option Win Rate" value={`${stats.options.winRate.toFixed(1)}%`} />
              <StatTile label="Option Positions Closed" value={stats.options.count} />
              <StatTile label="Total Premium Collected" value={formatCurrency(stats.options.totalPremiumCollected)} tone="positive" />
            </div>
          </section>

          <section className="stats-section">
            <h2 className="stats-section-title">By Strategy</h2>
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr><th>Strategy</th><th>Trades</th><th>Win Rate</th><th>Total P&L</th></tr>
                </thead>
                <tbody>
                  {stats.byStrategy.map((row) => (
                    <tr key={row.strategy}>
                      <td>{row.label}</td>
                      <td className="mono">{row.count}</td>
                      <td className="mono">{row.winRate.toFixed(1)}%</td>
                      <td className={`mono ${row.totalPnl >= 0 ? 'stat-tile-value--positive' : 'stat-tile-value--negative'}`}>{formatCurrency(row.totalPnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="stats-section">
            <h2 className="stats-section-title">By Symbol</h2>
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr><th>Symbol</th><th>Trades</th><th>Total P&L</th></tr>
                </thead>
                <tbody>
                  {stats.bySymbol.map((row) => (
                    <tr key={row.symbol}>
                      <td>{row.symbol}</td>
                      <td className="mono">{row.count}</td>
                      <td className={`mono ${row.totalPnl >= 0 ? 'stat-tile-value--positive' : 'stat-tile-value--negative'}`}>{formatCurrency(row.totalPnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {!loading && closedInvestments.length > 0 && (
        <div className="closed-investments-section">
          <div className="closed-investments-header">
            <h2 className="stats-section-title">Closed Investments</h2>
            <span className="closed-investments-count">{closedInvestments.length}</span>
          </div>

          <div className="investment-groups">
            {closedByDate.map((day) => (
              <details key={day.date} className="investment-group closed-day-group" open>
                <summary className="group-title">
                  {formatCloseDate(day.date)}
                  <span className="group-count">{day.count}</span>
                  {day.totalPnl !== null && (
                    <span className={`closed-day-pnl mono ${day.totalPnl >= 0 ? 'price-favorable' : 'price-unfavorable'}`}>
                      {formatCurrency(day.totalPnl)}
                    </span>
                  )}
                </summary>
                {day.groups.map((group) => (
                  <details key={group.key} className="strategy-group" open>
                    <summary className="strategy-title">{group.label}<span className="group-count">{group.items.length}</span></summary>
                    <ul className="investment-list">
                      {group.items.map((investment) => (
                        <InvestmentRow key={investment.id} investment={investment} onEdit={setEditing} onDelete={deleteInvestment} />
                      ))}
                    </ul>
                  </details>
                ))}
              </details>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <AddInvestmentModal
          initialValues={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (fields) => {
            await updateInvestment(editing.id, fields)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
