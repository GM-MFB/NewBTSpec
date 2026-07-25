import './InvestmentRow.css'
import { strategyByValue } from '../lib/optionStrategies'

function daysLeftLabel(expiry) {
  if (!expiry) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expiry)
  if (Number.isNaN(exp.getTime())) return ''
  const diff = Math.round((exp - today) / 86400000)
  return diff < 0 ? 'Expired' : `${diff}d`
}

function MetaItem({ label, value }) {
  if (value === '' || value === undefined || value === null) return null
  return (
    <span className="meta-item">
      <span className="meta-label">{label}:</span> {value}
    </span>
  )
}

export default function InvestmentRow({ investment, onClick }) {
  const isOption = investment.assetType === 'Option'
  const badge = isOption ? (strategyByValue(investment.strategy)?.label ?? 'Option') : investment.assetType

  return (
    <li className="investment-row" data-testid="investment-row" onClick={() => onClick(investment.id)}>
      <div className="investment-row-top">
        <span className="mono investment-symbol">{investment.symbol}</span>
        <span className="investment-badge">{badge}</span>
      </div>
      <div className="investment-row-meta mono">
        {isOption ? (
          <>
            <MetaItem label="Contracts" value={investment.shares} />
            <MetaItem label="Strike" value={investment.strike} />
            <MetaItem label="Expires" value={investment.expiry} />
            <MetaItem label="Days Left" value={daysLeftLabel(investment.expiry)} />
            <MetaItem label="Avg Price" value={investment.avgCost} />
          </>
        ) : (
          <>
            <MetaItem label="Shares" value={investment.shares} />
            <MetaItem label="Avg Cost" value={investment.avgCost} />
          </>
        )}
      </div>
    </li>
  )
}
