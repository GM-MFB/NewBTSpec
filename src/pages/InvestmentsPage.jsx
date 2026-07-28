import { useState } from 'react'
import { Link } from 'react-router-dom'
import './InvestmentsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'
import { useUserSettings } from '../hooks/useUserSettings'
import { STRATEGIES } from '../lib/optionStrategies'
import { coveredSharesFor } from '../lib/coverage'
import { computeSummary } from '../lib/portfolioSummary'
import { formatCurrency } from '../lib/format'
import { fetchQuote } from '../lib/finnhub'
import { currentWeekValue } from '../lib/isoWeek'
import { premiumForWeek } from '../lib/weeklyPremium'
import Header from '../components/Header'
import InvestmentRow from '../components/InvestmentRow'
import AddInvestmentModal from '../components/AddInvestmentModal'
import ClosePositionModal from '../components/ClosePositionModal'

export default function InvestmentsPage() {
  const { user, signOut } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount, deleteAccount, renameAccount } = useAccounts(user?.id)
  const { investments, error, reload, addInvestment, closeInvestment, updateInvestment, deleteInvestment } = useInvestments(activeAccountId)
  const { finnhubKey } = useUserSettings(user?.id)
  const [addOpen, setAddOpen] = useState(false)
  const [closingId, setClosingId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [missingKey, setMissingKey] = useState(false)
  const [refreshFailedSymbols, setRefreshFailedSymbols] = useState([])
  const [weekValue, setWeekValue] = useState(currentWeekValue())

  const stockInvestments = investments.filter((i) => i.assetType === 'Stock')
  const strategyGroups = STRATEGIES
    .map((s) => ({ ...s, items: investments.filter((i) => i.assetType === 'Option' && i.strategy === s.value) }))
    .filter((g) => g.items.length > 0)
  const categorizedIds = new Set([
    ...stockInvestments.map((i) => i.id),
    ...strategyGroups.flatMap((g) => g.items.map((i) => i.id)),
  ])
  const otherInvestments = investments.filter((i) => !categorizedIds.has(i.id))
  const summary = computeSummary(investments)

  async function handleRefresh() {
    if (!finnhubKey) {
      setMissingKey(true)
      return
    }
    setMissingKey(false)
    setRefreshFailedSymbols([])
    setRefreshing(true)

    const symbols = [...new Set(investments.map((i) => i.symbol).filter(Boolean))]
    const failed = []
    for (const symbol of symbols) {
      try {
        const price = await fetchQuote(symbol, finnhubKey)
        const matches = investments.filter((i) => i.symbol === symbol)
        for (const match of matches) {
          await updateInvestment(match.id, { currentPrice: price })
        }
      } catch {
        failed.push(symbol)
      }
    }

    setRefreshFailedSymbols(failed)
    setRefreshing(false)
  }

  return (
    <div data-testid="investments-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        deleteAccount={deleteAccount}
        renameAccount={renameAccount}
        onSignOut={signOut}
        onAddTrade={() => setAddOpen(true)}
        addLabel="+ Add Investment"
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {error && (
        <div className="error-banner">
          <span>Couldn't load investments.</span>
          <button type="button" onClick={reload}>Retry</button>
        </div>
      )}

      {missingKey && (
        <div className="error-banner">
          <span>Add your Finnhub API key in Settings to enable price refresh.</span>
          <Link to="/settings">Go to Settings</Link>
        </div>
      )}

      {refreshFailedSymbols.length > 0 && (
        <div className="error-banner">
          <span>Couldn't refresh {refreshFailedSymbols.join(', ')}</span>
        </div>
      )}

      {investments.length > 0 && (
        <div className="portfolio-summary">
          <div className="summary-stat">
            <span className="summary-label">Total Collateral Deployed</span>
            <span className="summary-value mono">{formatCurrency(summary.totalCollateral)}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-label">Outstanding Option Premium</span>
            <span className="summary-value mono">{formatCurrency(summary.potentialPremium)}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-label">Unrealized Stock P&L</span>
            <span className={`summary-value mono ${summary.unrealizedStockPnl < 0 ? 'summary-value--negative' : 'summary-value--positive'}`}>
              {formatCurrency(summary.unrealizedStockPnl)}
            </span>
          </div>
          <div className="summary-stat summary-stat--week">
            <label htmlFor="weekSelect" className="summary-label">Premium for week</label>
            <div className="week-premium-inline">
              <input id="weekSelect" type="week" value={weekValue} onChange={(e) => setWeekValue(e.target.value)} />
              <span className="summary-value mono">{formatCurrency(premiumForWeek(investments, weekValue))}</span>
            </div>
          </div>
        </div>
      )}

      {investments.length === 0 ? (
        <p className="empty-state">No open investments — add one to get started</p>
      ) : (
        <div className="investment-groups">
          {stockInvestments.length > 0 && (
            <section className="investment-group">
              <h2 className="group-title">Stock</h2>
              <ul className="investment-list">
                {stockInvestments.map((investment) => (
                  <InvestmentRow
                    key={investment.id}
                    investment={investment}
                    onClosePosition={setClosingId}
                    onEdit={setEditing}
                    onDelete={deleteInvestment}
                    coveredShares={coveredSharesFor(investment, investments)}
                  />
                ))}
              </ul>
            </section>
          )}

          {strategyGroups.length > 0 && (
            <section className="investment-group">
              <h2 className="group-title">Option</h2>
              {strategyGroups.map((group) => (
                <div key={group.value} className="strategy-group">
                  <h3 className="strategy-title">{group.label}</h3>
                  <ul className="investment-list">
                    {group.items.map((investment) => (
                      <InvestmentRow
                        key={investment.id}
                        investment={investment}
                        onClosePosition={setClosingId}
                        onEdit={setEditing}
                        onDelete={deleteInvestment}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {otherInvestments.length > 0 && (
            <section className="investment-group">
              <h2 className="group-title">Other</h2>
              <ul className="investment-list">
                {otherInvestments.map((investment) => (
                  <InvestmentRow key={investment.id} investment={investment} onClosePosition={setClosingId} onEdit={setEditing} onDelete={deleteInvestment} />
                ))}
              </ul>
            </section>
          )}
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

      {addOpen && (
        <AddInvestmentModal
          onClose={() => setAddOpen(false)}
          onSubmit={async (investment) => {
            await addInvestment(investment, user.id)
            setAddOpen(false)
          }}
        />
      )}

      {closingId && (
        <ClosePositionModal
          onClose={() => setClosingId(null)}
          onConfirm={async (closeFields) => {
            await closeInvestment(closingId, closeFields)
            setClosingId(null)
          }}
        />
      )}
    </div>
  )
}
