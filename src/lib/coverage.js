export function coveredSharesFor(stockInvestment, allInvestments) {
  const total = allInvestments
    .filter((i) => i.assetType === 'Option' && i.strategy === 'covered_call' && i.symbol === stockInvestment.symbol)
    .reduce((sum, i) => sum + Number(i.shares || 0) * 100, 0)

  return total || ''
}
