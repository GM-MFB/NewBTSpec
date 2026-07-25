import './InvestmentRow.css'
import { strategyByValue } from '../lib/optionStrategies'

export default function InvestmentRow({ investment, onClick }) {
  const isOption = investment.assetType === 'Option'
  const badge = isOption ? (strategyByValue(investment.strategy)?.label ?? 'Option') : investment.assetType

  return (
    <li className="investment-row" data-testid="investment-row" onClick={() => onClick(investment.id)}>
      <span className="mono investment-symbol">{investment.symbol}</span>
      <span className="investment-badge">{badge}</span>
      {isOption ? (
        <>
          <span className="mono">{investment.strike}</span>
          <span className="mono">{investment.expiry}</span>
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
