import { useState } from 'react'
import './AnalyzePage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'
import Header from '../components/Header'
import FinancialsTab from '../components/analysis/FinancialsTab'
import ResearchTab from '../components/analysis/ResearchTab'
import DCFTab from '../components/analysis/DCFTab'
import RiskTab from '../components/analysis/RiskTab'
import ScreenerTab from '../components/analysis/ScreenerTab'

const TABS = [
  { key: 'research', label: 'Research' },
  { key: 'financials', label: 'Financials' },
  { key: 'dcf', label: 'DCF' },
  { key: 'risk', label: 'Risk' },
  { key: 'screener', label: 'Screener' },
]

function AnalyzeTabPlaceholder({ label }) {
  return <p className="analyze-tab-placeholder">{label} — Coming soon.</p>
}

export default function AnalyzePage() {
  const { user, signOut } = useAuth()
  const { accounts, activeAccount, activeAccountId, switchAccount, createAccount, deleteAccount } = useAccounts(user?.id)
  const { investments } = useInvestments(activeAccountId)
  const [tab, setTab] = useState('research')

  return (
    <div data-testid="analyze-page">
      <Header
        accounts={accounts}
        activeAccount={activeAccount}
        switchAccount={switchAccount}
        createAccount={createAccount}
        deleteAccount={deleteAccount}
        onSignOut={signOut}
        showAddButton={false}
      />

      <div className="analyze-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'financials' && <FinancialsTab investments={investments} />}
      {tab === 'research' && <ResearchTab investments={investments} />}
      {tab === 'dcf' && <DCFTab investments={investments} />}
      {tab === 'risk' && <RiskTab investments={investments} />}
      {tab === 'screener' && <ScreenerTab accountId={activeAccountId} userId={user?.id} />}
      {!['financials', 'research', 'dcf', 'risk', 'screener'].includes(tab) && (
        <AnalyzeTabPlaceholder label={TABS.find((t) => t.key === tab).label} />
      )}
    </div>
  )
}
