import './InvestmentRow.css'
import { strategyByValue } from '../lib/optionStrategies'
import { formatCurrency, formatCurrencyWhole, formatCurrencyAuto } from '../lib/format'
import { collateralFor, potentialPnlFor } from '../lib/optionMath'

function daysLeftLabel(expiry) {
  if (!expiry) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expiry)
  if (Number.isNaN(exp.getTime())) return ''
  const diff = Math.round((exp - today) / 86400000)
  return diff < 0 ? 'Expired' : `${diff}d`
}

function isBlank(value) {
  return value === '' || value === undefined || value === null
}

function unrealizedPnlFor(investment) {
  if (isBlank(investment.currentPrice)) return ''
  return (Number(investment.currentPrice) - Number(investment.avgCost)) * Number(investment.shares)
}

function priceFavorability(investment, strategyDef) {
  if (isBlank(investment.currentPrice) || !strategyDef) return null
  const strike = Number(investment.strike)
  const currentPrice = Number(investment.currentPrice)
  const wantsAbove = (strategyDef.optionType === 'call') === (strategyDef.optionDirection === 'long')
  const favorable = wantsAbove ? currentPrice > strike : currentPrice < strike
  return favorable ? 'price-favorable' : 'price-unfavorable'
}

function MetaItem({ field, label, value, colorClass }) {
  if (isBlank(value)) return null
  return (
    <span className={`meta-item meta-item--${field}`}>
      <span className="meta-label">{label}:</span>
      <span className={`meta-value ${colorClass ?? ''}`}>{value}</span>
    </span>
  )
}

function StrikeMeta({ investment, strategyDef, strikeDisplay }) {
  const currentPriceDisplay = formatCurrency(investment.currentPrice)
  const favorability = priceFavorability(investment, strategyDef)

  return (
    <span className="meta-item meta-item--strike">
      <span className="meta-label">Strike:</span>
      <span className="meta-value">{strikeDisplay}</span>
      {currentPriceDisplay && (
        <>
          <span className="meta-separator">|</span>
          <span className={`meta-value ${favorability}`}>{currentPriceDisplay}</span>
        </>
      )}
    </span>
  )
}

export default function InvestmentRow({ investment, onClosePosition, onDelete, coveredShares }) {
  const isOption = investment.assetType === 'Option'
  const strategyDef = strategyByValue(investment.strategy)
  const strikeDisplay = investment.strike2
    ? `${formatCurrencyAuto(investment.strike)}/${formatCurrencyAuto(investment.strike2)}`
    : formatCurrencyAuto(investment.strike)
  const collateral = isOption ? formatCurrencyWhole(collateralFor(investment, strategyDef)) : ''
  const potentialPnl = isOption ? formatCurrency(potentialPnlFor(investment, strategyDef)) : ''
  const sharesDisplay = coveredShares ? `${investment.shares}/${coveredShares}` : investment.shares

  const currentPriceClass = !isBlank(investment.currentPrice)
    ? (Number(investment.currentPrice) > Number(investment.avgCost) ? 'price-favorable' : 'price-unfavorable')
    : ''
  const unrealizedPnlRaw = unrealizedPnlFor(investment)
  const unrealizedPnlClass = !isBlank(unrealizedPnlRaw) ? (unrealizedPnlRaw >= 0 ? 'price-favorable' : 'price-unfavorable') : ''

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
      </div>
      <div className="investment-row-meta mono">
        {isOption ? (
          <>
            <MetaItem field="contracts" label="Contracts" value={investment.shares} />
            <StrikeMeta investment={investment} strategyDef={strategyDef} strikeDisplay={strikeDisplay} />
            <MetaItem field="expires" label="Expires" value={investment.expiry} />
            <MetaItem field="days-left" label="Days Left" value={daysLeftLabel(investment.expiry)} />
            <MetaItem field="avg-price" label="Avg Price" value={formatCurrency(investment.avgCost)} />
            <MetaItem field="collateral" label="Collateral" value={collateral} />
            <MetaItem field="pnl" label="P&L" value={potentialPnl} />
          </>
        ) : (
          <>
            <MetaItem field="shares" label="Shares" value={sharesDisplay} />
            <MetaItem field="avg-cost" label="Avg Cost" value={formatCurrency(investment.avgCost)} />
            <MetaItem field="current-price" label="Current Price" value={formatCurrency(investment.currentPrice)} colorClass={currentPriceClass} />
            <MetaItem field="unrealized-pnl" label="Unrealized P&L" value={formatCurrency(unrealizedPnlRaw)} colorClass={unrealizedPnlClass} />
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
