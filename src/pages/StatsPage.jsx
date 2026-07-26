import { useState } from 'react'
import '../pages/InvestmentsPage.css'
import './StatsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestmentsHistory } from '../hooks/useInvestmentsHistory'
import { computeInvestmentStats } from '../lib/investmentStats'
import { formatCurrency } from '../lib/format'
import { STRATEGIES, effectiveStrategyDef } from '../lib/optionStrategies'
import Header from '../components/Header'
import StatsCharts from '../components/StatsCharts'
import InvestmentRow from '../components/InvestmentRow'

function StatTile({ label, value, tone }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-label">{label}</span>
      <span className={`stat-tile-value mono ${tone ? `stat-tile-value--${tone}` : ''}`}>{value}</span>
    </div>
  )
}

export default function StatsPage() {
  const { user } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount } = useAccounts(user?.id)
  const { investments, loading, error, reload, deleteInvestment } = useInvestmentsHistory(activeAccountId)
  const [view, setView] = useState('numbers')

  const stats = computeInvestmentStats(investments)

  const closedInvestments = investments.filter((i) => i.status === 'closed')
  const closedStocks = closedInvestments.filter((i) => i.assetType === 'Stock')
  const closedOptions = closedInvestments.filter((i) => i.assetType === 'Option')

  const knownStrategyGroups = STRATEGIES
    .map((s) => ({ key: s.value, label: s.label, items: closedOptions.filter((i) => i.strategy === s.value) }))
    .filter((g) => g.items.length > 0)
  const categorizedOptionIds = new Set(knownStrategyGroups.flatMap((g) => g.items.map((i) => i.id)))
  const uncategorizedOptions = closedOptions.filter((i) => !categorizedOptionIds.has(i.id))

  const fallbackGroupsByLabel = new Map()
  const closedOtherInvestments = []
  for (const investment of uncategorizedOptions) {
    const def = effectiveStrategyDef(investment)
    if (!def) {
      closedOtherInvestments.push(investment)
      continue
    }
    const key = `fallback:${def.label}`
    if (!fallbackGroupsByLabel.has(key)) fallbackGroupsByLabel.set(key, { key, label: def.label, items: [] })
    fallbackGroupsByLabel.get(key).items.push(investment)
  }
  closedOtherInvestments.push(...closedInvestments.filter((i) => i.assetType !== 'Stock' && i.assetType !== 'Option'))

  const closedStrategyGroups = [...knownStrategyGroups, ...fallbackGroupsByLabel.values()]

  return (
    <div data-testid="stats-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        showAddButton={false}
      />

      <div className="stats-toolbar">
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

      {!loading && view === 'charts' && <StatsCharts stats={stats} />}

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
          </section>

          <section className="stats-section">
            <h2 className="stats-section-title">By Symbol</h2>
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
            {closedStocks.length > 0 && (
              <section className="investment-group">
                <h2 className="group-title">Stock</h2>
                <ul className="investment-list">
                  {closedStocks.map((investment) => (
                    <InvestmentRow key={investment.id} investment={investment} onDelete={deleteInvestment} />
                  ))}
                </ul>
              </section>
            )}

            {closedStrategyGroups.length > 0 && (
              <section className="investment-group">
                <h2 className="group-title">Option</h2>
                {closedStrategyGroups.map((group) => (
                  <div key={group.key} className="strategy-group">
                    <h3 className="strategy-title">{group.label}</h3>
                    <ul className="investment-list">
                      {group.items.map((investment) => (
                        <InvestmentRow key={investment.id} investment={investment} onDelete={deleteInvestment} />
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            {closedOtherInvestments.length > 0 && (
              <section className="investment-group">
                <h2 className="group-title">Other</h2>
                <ul className="investment-list">
                  {closedOtherInvestments.map((investment) => (
                    <InvestmentRow key={investment.id} investment={investment} onDelete={deleteInvestment} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
