import { collateralFor } from './optionMath'
import { effectiveStrategyDef } from './optionStrategies'

function valueForPosition(position) {
  if (position.assetType === 'Stock') {
    const price = Number(position.currentPrice) || Number(position.avgCost) || 0
    const shares = Number(position.shares) || 0
    return price * shares
  }
  if (position.assetType === 'Option') {
    const strategyDef = effectiveStrategyDef(position)
    return Number(collateralFor(position, strategyDef)) || 0
  }
  return 0
}

function valueForSymbol(investments, symbol) {
  return investments
    .filter((i) => i.symbol === symbol)
    .reduce((sum, p) => sum + valueForPosition(p), 0)
}

export function computePositionWeights(investments, symbols) {
  if (symbols.length === 0) return []

  const values = symbols.map((symbol) => valueForSymbol(investments, symbol))
  const total = values.reduce((sum, v) => sum + v, 0)
  if (total <= 0) return symbols.map(() => 1 / symbols.length)

  return values.map((v) => v / total)
}

export function computePositionTotalValue(investments, symbols) {
  return symbols.reduce((sum, symbol) => sum + valueForSymbol(investments, symbol), 0)
}
