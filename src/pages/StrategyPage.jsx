import { useState } from 'react'
import './StrategyPage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { STRATEGY_CONTENT } from '../lib/strategyContent'
import StrategyArticle from '../components/strategy/StrategyArticle'
import StrategyCalculator from '../components/strategy/StrategyCalculator'
import Header from '../components/Header'

// Preserves the order strategies are declared in, within each group.
const GROUP_ORDER = ['Income', 'Directional', 'Neutral', 'Volatility', 'Protection', 'Hedge Fund', 'Concepts']
const GROUPS = GROUP_ORDER
  .map((group) => [group, STRATEGY_CONTENT.filter((s) => s.group === group)])
  .filter(([, strategies]) => strategies.length > 0)

export default function StrategyPage() {
  const { user, signOut } = useAuth()
  const { accounts, activeAccount, switchAccount, createAccount, deleteAccount, renameAccount } = useAccounts(user?.id)
  const [activeId, setActiveId] = useState(STRATEGY_CONTENT[0].id)

  const strategy = STRATEGY_CONTENT.find((s) => s.id === activeId) ?? STRATEGY_CONTENT[0]
  // The group follows the selection rather than being its own state, so the two
  // rows can never disagree about what is showing.
  const activeGroup = strategy.group
  const groupStrategies = STRATEGY_CONTENT.filter((s) => s.group === activeGroup)

  function selectGroup(group) {
    const first = STRATEGY_CONTENT.find((s) => s.group === group)
    if (first) setActiveId(first.id)
  }

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

      {/* Two levels rather than every strategy at once: pick the purpose, then
          the tool. Nineteen strategies in one list was a wall on any screen. */}
      <nav className="strategy-nav" aria-label="Strategies">
        <div className="strategy-nav-row strategy-nav-row--groups" data-testid="strategy-groups">
          {GROUPS.map(([group]) => (
            <button
              key={group}
              type="button"
              className="strategy-group-btn"
              aria-pressed={group === activeGroup}
              onClick={() => selectGroup(group)}
            >
              {group}
            </button>
          ))}
        </div>

        <div className="strategy-nav-row strategy-nav-row--strategies" data-testid="strategy-tabs">
          {groupStrategies.map((s) => (
            <button
              key={s.id}
              type="button"
              className="strategy-btn"
              aria-pressed={s.id === activeId}
              onClick={() => setActiveId(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </nav>

      {/* Article and calculator sit side by side on a wide screen, so the page
          uses the width instead of leaving half of it empty. */}
      <div className="strategy-page">
        <div className="strategy-layout">
          <StrategyArticle strategy={strategy} />
          {strategy.calculator && (
            <div className="strategy-aside">
              <StrategyCalculator kind={strategy.calculator} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
