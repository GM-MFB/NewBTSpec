import { strategyByValue } from './optionStrategies'
import { potentialPnlFor } from './optionMath'
import { weekRangeFromValue, isDateInRange } from './isoWeek'

export function premiumForWeek(investments, weekValue) {
  const { start, end } = weekRangeFromValue(weekValue)
  let total = 0

  for (const investment of investments) {
    if (investment.assetType !== 'Option') continue
    if (!isDateInRange(investment.expiry, start, end)) continue
    const strategyDef = strategyByValue(investment.strategy)
    const pnl = potentialPnlFor(investment, strategyDef)
    if (pnl !== '') total += pnl
  }

  return total
}
