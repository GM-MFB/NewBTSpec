import { strategyByValue } from './optionStrategies'
import { collateralFor, potentialPnlFor } from './optionMath'

export function computeSummary(investments) {
  let totalCollateral = 0
  let potentialPremium = 0
  let unrealizedStockPnl = 0

  for (const investment of investments) {
    if (investment.assetType === 'Option') {
      const strategyDef = strategyByValue(investment.strategy)
      const collateral = collateralFor(investment, strategyDef)
      const pnl = potentialPnlFor(investment, strategyDef)
      if (collateral !== '') totalCollateral += collateral
      if (pnl !== '') potentialPremium += pnl
    } else if (investment.assetType === 'Stock') {
      const currentPrice = Number(investment.currentPrice)
      const avgCost = Number(investment.avgCost)
      const shares = Number(investment.shares)
      if (investment.currentPrice !== '' && investment.currentPrice !== undefined && investment.currentPrice !== null) {
        unrealizedStockPnl += (currentPrice - avgCost) * shares
      }
    }
  }

  return { totalCollateral, potentialPremium, unrealizedStockPnl }
}
