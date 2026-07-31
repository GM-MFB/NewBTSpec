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
export function computeWorthBreakdown(investments, cash) {
  let stockValue = 0
  let optionCollateral = 0
  let longOptionPremium = 0

  for (const investment of investments) {
    if (investment.assetType === 'Option') {
      const strategyDef = effectiveStrategyDef(investment)
      const value = optionsCapitalAtRisk(investment, strategyDef)
      // A covered call is short with a value of zero, so it lands in
      // collateral and contributes nothing — which is what we want.
      if (strategyDef?.optionDirection === 'short') optionCollateral += value
      else longOptionPremium += value
    } else if (PRICED_ASSET_TYPES.includes(investment.assetType)) {
      const price = Number(investment.currentPrice) || Number(investment.avgCost) || 0
      stockValue += price * (Number(investment.shares) || 0)
    }
  }

  const freeCash = Number(cash) || 0
  return {
    cash: freeCash,
    stockValue,
    optionCollateral,
    longOptionPremium,
    total: freeCash + stockValue + optionCollateral + longOptionPremium,
  }
}

// Derived from the breakdown so the headline figure and the allocation rows
// behind it can never disagree.
export function computePortfolioWorth(investments, cash) {
  return computeWorthBreakdown(investments, cash).total
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
