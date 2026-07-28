import { pnlFor, tradeTypeLabel } from './tradeStats'

function winLossStats(pnls) {
  const wins = pnls.filter((p) => p > 0)
  const losses = pnls.filter((p) => p < 0)
  const totalPnl = pnls.reduce((sum, p) => sum + p, 0)
  const winRate = pnls.length ? (wins.length / pnls.length) * 100 : 0
  const avgWin = wins.length ? wins.reduce((sum, p) => sum + p, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((sum, p) => sum + p, 0) / losses.length : 0
  return { count: pnls.length, totalPnl, winRate, avgWin, avgLoss }
}

export function computeTradeStats(trades) {
  const closed = trades.filter((t) => pnlFor(t) !== null)
  const pnls = closed.map(pnlFor)
  const overall = winLossStats(pnls)

  let bestTrade = null
  let worstTrade = null
  for (const trade of closed) {
    const pnl = pnlFor(trade)
    if (!bestTrade || pnl > pnlFor(bestTrade)) bestTrade = trade
    if (!worstTrade || pnl < pnlFor(worstTrade)) worstTrade = trade
  }

  const typeGroups = new Map()
  for (const trade of closed) {
    const label = tradeTypeLabel(trade)
    if (!typeGroups.has(label)) typeGroups.set(label, [])
    typeGroups.get(label).push(trade)
  }
  const byType = [...typeGroups.entries()].map(([type, items]) => ({
    type, ...winLossStats(items.map(pnlFor)),
  }))

  const symbolTotals = new Map()
  for (const trade of closed) {
    const pnl = pnlFor(trade)
    const existing = symbolTotals.get(trade.symbol) ?? { symbol: trade.symbol, count: 0, totalPnl: 0 }
    existing.count += 1
    existing.totalPnl += pnl
    symbolTotals.set(trade.symbol, existing)
  }
  const bySymbol = [...symbolTotals.values()].sort((a, b) => b.totalPnl - a.totalPnl)

  const timeline = closed
    .map((t) => ({ date: t.exitDate, pnl: pnlFor(t) }))
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
    avgWin: overall.avgWin,
    avgLoss: overall.avgLoss,
    bestTrade,
    worstTrade,
    byType,
    bySymbol,
    equityCurve,
  }
}
