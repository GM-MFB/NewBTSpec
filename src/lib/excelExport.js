import * as XLSX from 'xlsx'

function addSheet(workbook, name, rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, name)
}

export function generateExcelWorkbook(exportData) {
  const workbook = XLSX.utils.book_new()

  addSheet(workbook, 'Overview', [
    ['Metric', 'Value'],
    ['Account', exportData.meta.accountName],
    ['Generated', exportData.meta.generatedAt],
    ['Date Range', exportData.meta.dateRangeLabel],
    ['Total Realized P&L', exportData.overview.totalRealizedPnl],
    ['Win Rate (%)', exportData.overview.winRate],
    ['Closed Positions', exportData.overview.totalClosed],
    ['Open Positions', exportData.overview.totalOpen],
    ['Avg Win', exportData.overview.avgWin],
    ['Avg Loss', exportData.overview.avgLoss],
    ['Best Trade', exportData.overview.bestTradeSymbol],
    ['Worst Trade', exportData.overview.worstTradeSymbol],
    ['Closed Stock P&L', exportData.stock.totalPnl],
    ['Stock Win Rate (%)', exportData.stock.winRate],
    ['Closed Option P&L', exportData.options.totalPnl],
    ['Option Win Rate (%)', exportData.options.winRate],
    ['Total Premium Collected', exportData.options.totalPremiumCollected],
  ])

  addSheet(workbook, 'Closed Investments', [
    ['Symbol', 'Type', 'Strategy', 'Avg Cost', 'Sell Price', 'Sell Date', 'Realized P&L'],
    ...exportData.closedRows.map((r) => [r.symbol, r.assetType, r.strategyLabel, r.avgCost, r.sellPrice, r.sellDate, r.realizedPnl]),
  ])

  addSheet(workbook, 'Open Investments', [
    ['Symbol', 'Type', 'Strategy', 'Shares', 'Avg Cost', 'Current Price', 'Unrealized P&L'],
    ...exportData.openRows.map((r) => [r.symbol, r.assetType, r.strategyLabel, r.shares, r.avgCost, r.currentPrice, r.unrealizedPnl]),
  ])

  addSheet(workbook, 'By Strategy', [
    ['Strategy', 'Trades', 'Win Rate (%)', 'Total P&L'],
    ...exportData.byStrategy.map((r) => [r.label, r.count, r.winRate, r.totalPnl]),
  ])

  addSheet(workbook, 'By Symbol', [
    ['Symbol', 'Trades', 'Total P&L'],
    ...exportData.bySymbol.map((r) => [r.symbol, r.count, r.totalPnl]),
  ])

  const filename = `bt-speculation-export-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(workbook, filename)
}
