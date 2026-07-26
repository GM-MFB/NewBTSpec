import { useState } from 'react'
import './AnalyzePage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'
import Header from '../components/Header'
import FundamentalsTab from '../components/analysis/FundamentalsTab'

const TABS = [
  { key: 'fundamentals', label: 'Fundamentals' },
  { key: 'financials', label: 'Financials' },
  { key: 'research', label: 'Research' },
  { key: 'dcf', label: 'DCF' },
  { key: 'frontier', label: 'Frontier' },
  { key: 'optimizer', label: 'Optimizer' },
  { key: 'risk', label: 'Risk' },
  { key: 'wheel', label: 'Wheel' },
  { key: 'screener', label: 'Screener' },
]

function AnalyzeTabPlaceholder({ label }) {
  return <p className="analyze-tab-placeholder">{label} — Coming soon.</p>
}

export default function AnalyzePage() {
  const { user } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount } = useAccounts(user?.id)
  const { investments } = useInvestments(activeAccountId)
  const [tab, setTab] = useState('fundamentals')

  return (
    <div data-testid="analyze-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        showAddButton={false}
      />

      <div className="analyze-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fundamentals' ? (
        <FundamentalsTab investments={investments} />
      ) : (
        <AnalyzeTabPlaceholder label={TABS.find((t) => t.key === tab).label} />
      )}
    </div>
  )
}
