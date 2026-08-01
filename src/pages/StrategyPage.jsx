import { useState } from 'react'
import './StrategyPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { STRATEGY_CONTENT } from '../lib/strategyContent'
import StrategyArticle from '../components/strategy/StrategyArticle'
import Header from '../components/Header'

// Preserves the order strategies are declared in, within each group.
const GROUP_ORDER = ['Income', 'Directional', 'Neutral', 'Volatility', 'Protection']
const GROUPS = GROUP_ORDER
  .map((group) => [group, STRATEGY_CONTENT.filter((s) => s.group === group)])
  .filter(([, strategies]) => strategies.length > 0)

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

      {/* Grouped by what the strategy is for, so ten of them stay navigable
          and it is obvious which tool fits which situation. */}
      <div className="strategy-tabs">
        {GROUPS.map(([group, strategies]) => (
          <div className="strategy-tab-group" key={group}>
            <span className="strategy-tab-group-label">{group}</span>
            <div className="strategy-tab-row">
              {strategies.map((s) => (
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
          </div>
        ))}
      </div>

      <div className="strategy-page">
        <StrategyArticle strategy={strategy} />
      </div>
    </div>
  )
}
