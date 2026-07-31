import { useState } from 'react'
import './StrategyPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { STRATEGY_CONTENT } from '../lib/strategyContent'
import StrategyArticle from '../components/strategy/StrategyArticle'
import Header from '../components/Header'

export default function StrategyPage() {
  const { user, signOut } = useAuth()
  const { accounts, activeAccount, switchAccount, createAccount, deleteAccount, renameAccount } = useAccounts(user?.id)
  const [activeId, setActiveId] = useState(STRATEGY_CONTENT[0].id)

  const strategy = STRATEGY_CONTENT.find((s) => s.id === activeId) ?? STRATEGY_CONTENT[0]

  return (
    <div data-testid="strategy-page">
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

      <div className="strategy-tabs">
        {STRATEGY_CONTENT.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === activeId}
            onClick={() => setActiveId(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="strategy-page">
        <StrategyArticle strategy={strategy} />
      </div>
    </div>
  )
}
