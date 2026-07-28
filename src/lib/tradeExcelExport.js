import * as XLSX from 'xlsx'
import { pnlFor, tradeTypeLabel } from './tradeStats'

function blankable(value) {
  return value === '' || value === undefined || value === null ? '' : value
}

export function generateTradeExcelWorkbook(trades) {
  const workbook = XLSX.utils.book_new()

  const rows = [
    [
      'Date', 'Symbol', 'Type', 'Direction', 'Quantity',
      'Entry Price', 'Exit Price', 'Ticks', 'Tick Value',
      'Fees', 'P&L', 'Notes', 'Chart Link',
    ],
    ...trades.map((trade) => [
      trade.exitDate || trade.entryDate || '',
      trade.symbol,
      tradeTypeLabel(trade),
      trade.direction,
      blankable(trade.quantity),
      trade.type === 'futures' ? '' : blankable(trade.entryPrice),
      trade.type === 'futures' ? '' : blankable(trade.exitPrice),
      trade.type === 'futures' ? blankable(trade.ticks) : '',
      trade.type === 'futures' ? blankable(trade.tickValue) : '',
      blankable(trade.fees),
      pnlFor(trade),
      blankable(trade.notes),
      blankable(trade.chartLink),
    ]),
  ]

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'Trades')

  const filename = `bt-speculation-trades-export-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(workbook, filename)
}
