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

export default function InvestmentRow({ investment, onClick }) {
  const isOption = investment.assetType === 'Option'
  const badge = isOption ? (strategyByValue(investment.strategy)?.label ?? 'Option') : investment.assetType

  return (
    <li
      className={`investment-row ${isOption ? 'investment-row--option' : 'investment-row--stock'}`}
      data-testid="investment-row"
      onClick={() => onClick(investment.id)}
    >
      <span className="mono investment-symbol">{investment.symbol}</span>
      <span className="investment-badge">{badge}</span>
      {isOption ? (
        <>
          <span className="mono">{investment.strike}</span>
          <span className="mono">{investment.expiry}</span>
          <span className="mono">{daysLeftLabel(investment.expiry)}</span>
          <span className="mono">{investment.avgCost}</span>
        </>
      ) : (
        <>
          <span className="mono">{investment.shares}</span>
          <span className="mono">{investment.avgCost}</span>
        </>
      )}
    </li>
  )
}

export function InvestmentRowHeader({ variant }) {
  return (
    <li className={`investment-row investment-row-header investment-row--${variant}`} aria-hidden="true">
      <span>Symbol</span>
      <span>{variant === 'option' ? 'Strategy' : 'Type'}</span>
      {variant === 'option' ? (
        <>
          <span>Strike</span>
          <span>Expires</span>
          <span>Days Left</span>
          <span>Avg Price</span>
        </>
      ) : (
        <>
          <span>Shares</span>
          <span>Avg Cost</span>
        </>
      )}
    </li>
  )
}
