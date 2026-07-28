import { pnlFor } from './tradeStats'

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function buildMonthGrid(trades, year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startDay = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const pnlByDate = new Map()
  for (const trade of trades) {
    if (!trade.exitDate) continue
    const pnl = pnlFor(trade)
    if (pnl === null) continue
    pnlByDate.set(trade.exitDate, (pnlByDate.get(trade.exitDate) ?? 0) + pnl)
  }

  const cells = []

  for (let i = 0; i < startDay; i++) {
    cells.push({ date: null, dayNum: prevMonthDays - startDay + 1 + i, inMonth: false, pnl: null })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${pad2(month + 1)}-${pad2(d)}`
    cells.push({ date, dayNum: d, inMonth: true, pnl: pnlByDate.get(date) ?? null })
  }

  let nextDay = 1
  while (cells.length < 42) {
    cells.push({ date: null, dayNum: nextDay, inMonth: false, pnl: null })
    nextDay += 1
  }

  const rows = []
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7))
  }
  return rows
}
