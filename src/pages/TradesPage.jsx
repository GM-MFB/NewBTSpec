import { useState } from 'react'
import './TradesPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useTrades } from '../hooks/useTrades'
import Header from '../components/Header'
import TradeRow from '../components/TradeRow'
import AddTradeModal from '../components/AddTradeModal'
import TradeDetailModal from '../components/TradeDetailModal'

export default function TradesPage() {
  const { user } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount } = useAccounts(user?.id)
  const { trades, error, reload, addTrade, updateTrade, closeTrade, deleteTrade } = useTrades(activeAccountId)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedTradeId, setSelectedTradeId] = useState(null)

  const selectedTrade = trades.find((t) => t.id === selectedTradeId) ?? null

  return (
    <div data-testid="trades-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        onAddTrade={() => setAddOpen(true)}
      />

      {error && (
        <div className="error-banner">
          <span>Couldn't load trades.</span>
          <button type="button" onClick={reload}>Retry</button>
        </div>
      )}

      {trades.length === 0 ? (
        <p className="empty-state">No open trades — add one to get started</p>
      ) : (
        <ul className="trade-list">
          {trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} onClick={setSelectedTradeId} onDelete={deleteTrade} />
          ))}
        </ul>
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

      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTradeId(null)}
          onUpdate={async (patch) => {
            await updateTrade(selectedTrade.id, patch)
            setSelectedTradeId(null)
          }}
          onCloseTrade={async (closeFields) => {
            await closeTrade(selectedTrade.id, closeFields)
            setSelectedTradeId(null)
          }}
          onDelete={async () => {
            await deleteTrade(selectedTrade.id)
            setSelectedTradeId(null)
          }}
        />
      )}
    </div>
  )
}
