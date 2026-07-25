import { useState } from 'react'
import './InvestmentsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'
import { STRATEGIES } from '../lib/optionStrategies'
import { coveredSharesFor } from '../lib/coverage'
import Header from '../components/Header'
import InvestmentRow from '../components/InvestmentRow'
import AddInvestmentModal from '../components/AddInvestmentModal'
import ClosePositionModal from '../components/ClosePositionModal'

export default function InvestmentsPage() {
  const { user } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount } = useAccounts(user?.id)
  const { investments, error, reload, addInvestment, closeInvestment, deleteInvestment } = useInvestments(activeAccountId)
  const [addOpen, setAddOpen] = useState(false)
  const [closingId, setClosingId] = useState(null)

  const stockInvestments = investments.filter((i) => i.assetType === 'Stock')
  const strategyGroups = STRATEGIES
    .map((s) => ({ ...s, items: investments.filter((i) => i.assetType === 'Option' && i.strategy === s.value) }))
    .filter((g) => g.items.length > 0)
  const categorizedIds = new Set([
    ...stockInvestments.map((i) => i.id),
    ...strategyGroups.flatMap((g) => g.items.map((i) => i.id)),
  ])
  const otherInvestments = investments.filter((i) => !categorizedIds.has(i.id))

  return (
    <div data-testid="investments-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        onAddTrade={() => setAddOpen(true)}
        addLabel="+ Add Investment"
      />

      {error && (
        <div className="error-banner">
          <span>Couldn't load investments.</span>
          <button type="button" onClick={reload}>Retry</button>
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
                  <InvestmentRow key={investment.id} investment={investment} onClosePosition={setClosingId} onDelete={deleteInvestment} />
                ))}
              </ul>
            </section>
          )}
        </div>
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
