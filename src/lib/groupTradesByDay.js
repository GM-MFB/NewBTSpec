import { pnlFor } from './tradeStats'

export function groupTradesByDay(trades) {
  const groups = new Map()

  for (const trade of trades) {
    const date = trade.exitDate || trade.entryDate || 'No Date'
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date).push(trade)
  }

  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, items]) => {
      const pnls = items.map(pnlFor).filter((p) => p !== null)
      const totalPnl = pnls.length > 0 ? pnls.reduce((sum, p) => sum + p, 0) : null
      return { date, trades: items, totalPnl }
    })
}
