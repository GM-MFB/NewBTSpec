import { strategyByValue, STRATEGIES } from './optionStrategies'

function toNum(value) {
  return value === '' || value === undefined || value === null ? 0 : Number(value)
}

export function realizedPnlFor(investment) {
  if (investment.status !== 'closed') return null
  const shares = toNum(investment.shares)
  const avgCost = toNum(investment.avgCost)
  const sellPrice = toNum(investment.sellPrice)

  if (investment.assetType === 'Stock') {
    return (sellPrice - avgCost) * shares
  }

  const strategyDef = strategyByValue(investment.strategy)
  if (strategyDef?.optionDirection === 'short') {
    return (avgCost - sellPrice) * shares * 100
  }
  return (sellPrice - avgCost) * shares * 100
}

function winLossStats(items) {
  const pnls = items.map(realizedPnlFor).filter((p) => p !== null)
  const wins = pnls.filter((p) => p > 0)
  const losses = pnls.filter((p) => p < 0)
  const totalPnl = pnls.reduce((sum, p) => sum + p, 0)
  const winRate = pnls.length ? (wins.length / pnls.length) * 100 : 0
  const avgWin = wins.length ? wins.reduce((sum, p) => sum + p, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((sum, p) => sum + p, 0) / losses.length : 0
  return { count: pnls.length, totalPnl, winRate, avgWin, avgLoss }
}

export function computeInvestmentStats(investments) {
  const closed = investments.filter((i) => i.status === 'closed')
  const open = investments.filter((i) => i.status === 'open')
  const closedStocks = closed.filter((i) => i.assetType === 'Stock')
  const closedOptions = closed.filter((i) => i.assetType === 'Option')

  const overall = winLossStats(closed)

  let bestTrade = null
  let worstTrade = null
  for (const investment of closed) {
    const pnl = realizedPnlFor(investment)
    if (pnl === null) continue
    if (!bestTrade || pnl > realizedPnlFor(bestTrade)) bestTrade = investment
    if (!worstTrade || pnl < realizedPnlFor(worstTrade)) worstTrade = investment
  }

  const stockStats = winLossStats(closedStocks)
  const optionStats = winLossStats(closedOptions)
  const totalPremiumCollected = closedOptions.reduce((sum, i) => {
    const strategyDef = strategyByValue(i.strategy)
    if (strategyDef?.optionDirection !== 'short') return sum
    return sum + toNum(i.avgCost) * toNum(i.shares) * 100
  }, 0)

  const byStrategy = STRATEGIES
    .map((s) => {
      const items = closedOptions.filter((i) => i.strategy === s.value)
      return { strategy: s.value, label: s.label, ...winLossStats(items) }
    })
    .filter((g) => g.count > 0)

  const symbolTotals = new Map()
  for (const investment of closed) {
    const pnl = realizedPnlFor(investment)
    if (pnl === null) continue
    const existing = symbolTotals.get(investment.symbol) ?? { symbol: investment.symbol, count: 0, totalPnl: 0 }
    existing.count += 1
    existing.totalPnl += pnl
    symbolTotals.set(investment.symbol, existing)
  }
  const bySymbol = [...symbolTotals.values()].sort((a, b) => b.totalPnl - a.totalPnl)

  const timeline = closed
    .filter((i) => i.sellDate)
    .map((i) => ({ date: i.sellDate, pnl: realizedPnlFor(i) }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  let cumulative = 0
  const equityCurve = timeline.map(({ date, pnl }) => {
    cumulative += pnl
    return { date, cumulative }
  })

  return {
    totalRealizedPnl: overall.totalPnl,
    winRate: overall.winRate,
    totalClosed: closed.length,
    totalOpen: open.length,
    avgWin: overall.avgWin,
    avgLoss: overall.avgLoss,
    bestTrade,
    worstTrade,
    stock: stockStats,
    options: { ...optionStats, totalPremiumCollected },
    byStrategy,
    bySymbol,
    equityCurve,
  }
}
