export function collateralFor(investment, strategyDef) {
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

export function potentialPnlFor(investment, strategyDef) {
  const contracts = Number(investment.shares)
  const price = Number(investment.avgCost)
  if (!strategyDef || strategyDef.optionDirection !== 'short' || !contracts || !price) return ''
  return contracts * price * 100
}
