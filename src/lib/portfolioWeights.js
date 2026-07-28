function valueForSymbol(investments, symbol) {
  const positions = investments.filter((i) => i.assetType === 'Stock' && i.symbol === symbol)
  return positions.reduce((sum, p) => {
    const price = Number(p.currentPrice) || Number(p.avgCost) || 0
    const shares = Number(p.shares) || 0
    return sum + price * shares
  }, 0)
}

export function computeStockWeights(investments, symbols) {
  if (symbols.length === 0) return []

  const values = symbols.map((symbol) => valueForSymbol(investments, symbol))
  const total = values.reduce((sum, v) => sum + v, 0)
  if (total <= 0) return symbols.map(() => 1 / symbols.length)

  return values.map((v) => v / total)
}

export function computeStockTotalValue(investments, symbols) {
  return symbols.reduce((sum, symbol) => sum + valueForSymbol(investments, symbol), 0)
}
