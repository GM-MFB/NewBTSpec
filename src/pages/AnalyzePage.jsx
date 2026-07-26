import { useState } from 'react'
import './AnalyzePage.css'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'
import Header from '../components/Header'
import FinancialsTab from '../components/analysis/FinancialsTab'
import ResearchTab from '../components/analysis/ResearchTab'
import DCFTab from '../components/analysis/DCFTab'
import FrontierTab from '../components/analysis/FrontierTab'
import OptimizerTab from '../components/analysis/OptimizerTab'
import RiskTab from '../components/analysis/RiskTab'

const TABS = [
  { key: 'research', label: 'Research' },
  { key: 'financials', label: 'Financials' },
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
  const [tab, setTab] = useState('research')
  const [customSymbols, setCustomSymbols] = useState(null)

  function handleSendToFrontier(symbols) {
    setCustomSymbols(symbols)
    setTab('frontier')
  }

  function handleSendToOptimizer(symbols) {
    setCustomSymbols(symbols)
    setTab('optimizer')
  }

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

      {tab === 'financials' && <FinancialsTab investments={investments} />}
      {tab === 'research' && (
        <ResearchTab investments={investments} onSendToFrontier={handleSendToFrontier} onSendToOptimizer={handleSendToOptimizer} />
      )}
      {tab === 'dcf' && <DCFTab investments={investments} />}
      {tab === 'frontier' && <FrontierTab investments={investments} incomingSymbols={customSymbols} />}
      {tab === 'optimizer' && <OptimizerTab investments={investments} incomingSymbols={customSymbols} />}
      {tab === 'risk' && <RiskTab investments={investments} />}
      {!['financials', 'research', 'dcf', 'frontier', 'optimizer', 'risk'].includes(tab) && (
        <AnalyzeTabPlaceholder label={TABS.find((t) => t.key === tab).label} />
      )}
    </div>
  )
}
