export function coverageFor(investment, stockInvestments) {
  if (investment.strategy !== 'covered_call') return null

  const required = Number(investment.shares) * 100
  const owned = stockInvestments
    .filter((s) => s.symbol === investment.symbol)
    .reduce((sum, s) => sum + Number(s.shares || 0), 0)

  return { owned, required, ratio: required ? owned / required : 0 }
}
