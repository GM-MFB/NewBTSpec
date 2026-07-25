import './InvestmentRow.css'
import { strategyByValue } from '../lib/optionStrategies'
import { formatCurrency, formatCurrencyWhole, formatCurrencyAuto } from '../lib/format'

function daysLeftLabel(expiry) {
  if (!expiry) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expiry)
  if (Number.isNaN(exp.getTime())) return ''
  const diff = Math.round((exp - today) / 86400000)
  return diff < 0 ? 'Expired' : `${diff}d`
}

function collateralFor(investment, strategyDef) {
  const contracts = Number(investment.shares)
  const strike = Number(investment.strike)
  if (!strategyDef || strategyDef.optionDirection !== 'short' || !contracts || !strike) return ''
  if (strategyDef.isSpread) {
    const strike2 = Number(investment.strike2)
    if (!strike2) return ''
    return Math.abs(strike - strike2) * 100 * contracts
  }
  return strike * 100 * contracts
}

function potentialPnlFor(investment, strategyDef) {
  const contracts = Number(investment.shares)
  const price = Number(investment.avgCost)
  if (!strategyDef || strategyDef.optionDirection !== 'short' || !contracts || !price) return ''
  return contracts * price * 100
}

function MetaItem({ field, label, value }) {
  if (value === '' || value === undefined || value === null) return null
  return (
    <span className={`meta-item meta-item--${field}`}>
      <span className="meta-label">{label}:</span>
      <span className="meta-value">{value}</span>
    </span>
  )
}

export default function InvestmentRow({ investment, onClosePosition, onDelete }) {
  const isOption = investment.assetType === 'Option'
  const strategyDef = strategyByValue(investment.strategy)
  const badge = isOption ? (strategyDef?.label ?? 'Option') : investment.assetType
  const strikeDisplay = investment.strike2
    ? `${formatCurrencyAuto(investment.strike)}/${formatCurrencyAuto(investment.strike2)}`
    : formatCurrencyAuto(investment.strike)
  const collateral = isOption ? formatCurrencyWhole(collateralFor(investment, strategyDef)) : ''
  const potentialPnl = isOption ? formatCurrency(potentialPnlFor(investment, strategyDef)) : ''

  async function handleDelete() {
    try {
      await onDelete(investment.id)
    } catch (err) {
      window.alert(err.message)
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
            <MetaItem field="contracts" label="Contracts" value={investment.shares} />
            <MetaItem field="strike" label="Strike" value={strikeDisplay} />
            <MetaItem field="expires" label="Expires" value={investment.expiry} />
            <MetaItem field="days-left" label="Days Left" value={daysLeftLabel(investment.expiry)} />
            <MetaItem field="avg-price" label="Avg Price" value={formatCurrency(investment.avgCost)} />
            <MetaItem field="collateral" label="Collateral" value={collateral} />
            <MetaItem field="pnl" label="P&L" value={potentialPnl} />
          </>
        ) : (
          <>
            <MetaItem field="shares" label="Shares" value={investment.shares} />
            <MetaItem field="avg-cost" label="Avg Cost" value={formatCurrency(investment.avgCost)} />
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
