import { strategyByValue, effectiveStrategyDef } from './optionStrategies'
import { collateralFor, potentialPnlFor, optionsCapitalAtRisk } from './optionMath'

const PRICED_ASSET_TYPES = ['Stock', 'ETF', 'Crypto']

// What the account is worth right now: free cash, plus the market value of
// anything held outright, plus what each option position ties up.
//
// Stock is valued at market value rather than unrealized P&L — the P&L alone
// omits the cost basis, which understates the total by whatever was paid for
// the shares.
//
// optionsCapitalAtRisk gives collateral for short puts and credit spreads,
// premium paid for long calls and puts, and zero for covered calls. Zero is
// correct there: the shares backing a covered call are already counted as
// stock, so charging for it again would double count.
//
// `cash` is FREE cash. A cash-secured put's collateral is also cash sitting in
// the account, so counting restricted cash here as well would double count it.
export function computePortfolioWorth(investments, cash) {
  let holdings = 0

  for (const investment of investments) {
    if (investment.assetType === 'Option') {
      holdings += optionsCapitalAtRisk(investment, effectiveStrategyDef(investment))
    } else if (PRICED_ASSET_TYPES.includes(investment.assetType)) {
      const price = Number(investment.currentPrice) || Number(investment.avgCost) || 0
      holdings += price * (Number(investment.shares) || 0)
    }
  }

  return (Number(cash) || 0) + holdings
}

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
