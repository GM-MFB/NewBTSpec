import { useState } from 'react'
import './InvestmentsPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'
import Header from '../components/Header'
import InvestmentRow from '../components/InvestmentRow'
import AddInvestmentModal from '../components/AddInvestmentModal'
import InvestmentDetailModal from '../components/InvestmentDetailModal'

export default function InvestmentsPage() {
  const { user } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount } = useAccounts(user?.id)
  const { investments, error, reload, addInvestment, updateInvestment, closeInvestment, deleteInvestment } = useInvestments(activeAccountId)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const selected = investments.find((i) => i.id === selectedId) ?? null

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
        <ul className="investment-list">
          {investments.map((investment) => (
            <InvestmentRow key={investment.id} investment={investment} onClick={setSelectedId} />
          ))}
        </ul>
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

      {selected && (
        <InvestmentDetailModal
          investment={selected}
          onClose={() => setSelectedId(null)}
          onUpdate={async (patch) => {
            await updateInvestment(selected.id, patch)
            setSelectedId(null)
          }}
          onCloseInvestment={async (closeFields) => {
            await closeInvestment(selected.id, closeFields)
            setSelectedId(null)
          }}
          onDelete={async () => {
            await deleteInvestment(selected.id)
            setSelectedId(null)
          }}
        />
      )}
    </div>
  )
}
