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

export default function InvestmentRow({ investment, onClosePosition, onDelete }) {
  const isOption = investment.assetType === 'Option'
  const badge = isOption ? (strategyByValue(investment.strategy)?.label ?? 'Option') : investment.assetType
  const strikeDisplay = investment.strike2 ? `${investment.strike}/${investment.strike2}` : investment.strike

  async function handleDelete() {
    if (window.confirm(`Delete ${investment.symbol}?`)) {
      try {
        await onDelete(investment.id)
      } catch (err) {
        window.alert(err.message)
      }
    }
  }

  return (
    <li className="investment-row" data-testid="investment-row">
      <div className="investment-row-top">
        <span className="mono investment-symbol">{investment.symbol}</span>
        <span className="investment-badge">{badge}</span>
      </div>
      <div className="investment-row-meta mono">
        {isOption ? (
          <>
            <MetaItem label="Contracts" value={investment.shares} />
            <MetaItem label="Strike" value={strikeDisplay} />
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
      <div className="investment-row-actions">
        <button type="button" onClick={() => onClosePosition(investment.id)}>Close</button>
        <button type="button" className="danger" onClick={handleDelete}>Delete</button>
      </div>
    </li>
  )
}
