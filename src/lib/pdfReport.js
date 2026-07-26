import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import { formatCurrency } from './format'

const GREEN = [34, 197, 94]
const RED = [239, 68, 68]
const GRAY = [136, 136, 136]

function pnlColor(value) {
  return value >= 0 ? GREEN : RED
}

function roundMoney(value) {
  return typeof value === 'number' ? Math.round(value * 100) / 100 : value
}

function addHeader(doc, meta) {
  doc.setFontSize(18)
  doc.text('BT Speculation — Performance Report', 14, 18)
  doc.setFontSize(10)
  doc.text(meta.accountName, 14, 26)
  doc.text(`Generated: ${new Date(meta.generatedAt).toLocaleString()}`, 14, 32)
  doc.text(`Date range: ${meta.dateRangeLabel}`, 14, 38)
  return 46
}

function addKeyValueTable(doc, title, rows, startY) {
  doc.setFontSize(13)
  doc.text(title, 14, startY)
  autoTable(doc, {
    startY: startY + 4,
    head: [['Metric', 'Value']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 9 },
  })
  return doc.lastAutoTable.finalY + 10
}

async function addChartCardPage(doc, target) {
  let canvas
  try {
    canvas = await html2canvas(target)
  } catch {
    return
  }
  doc.addPage()
  const imgData = canvas.toDataURL('image/png')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const maxWidth = pageWidth - margin * 2
  const maxHeight = pageHeight - margin * 2
  let imgWidth = maxWidth
  let imgHeight = (canvas.height / canvas.width) * imgWidth
  if (imgHeight > maxHeight) {
    imgHeight = maxHeight
    imgWidth = (canvas.width / canvas.height) * imgHeight
  }
  doc.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight)
}

async function addChartsSection(doc, chartsElement) {
  if (!chartsElement) return
  let cards = chartsElement.querySelectorAll ? Array.from(chartsElement.querySelectorAll('.chart-card')) : []
  if (cards.length === 0) cards = [chartsElement]
  for (const card of cards) {
    await addChartCardPage(doc, card)
  }
}

function addRowsTable(doc, title, head, body, startY) {
  doc.setFontSize(13)
  doc.text(title, 14, startY)
  autoTable(doc, {
    startY: startY + 4,
    head: [head],
    body,
    theme: 'grid',
    styles: { fontSize: 8 },
    didParseCell(data) {
      if (data.section === 'body' && data.column.dataKey === head.length - 1) {
        const raw = data.cell.raw
        if (typeof raw === 'number') data.cell.styles.textColor = pnlColor(raw)
      }
    },
  })
  return doc.lastAutoTable.finalY + 10
}

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10)
  }
}

export async function generatePdfReport(exportData, chartsElement) {
  const doc = new jsPDF()
  let y = addHeader(doc, exportData.meta)

  y = addKeyValueTable(doc, 'Overview', [
    ['Total Realized P&L', formatCurrency(exportData.overview.totalRealizedPnl)],
    ['Win Rate', `${exportData.overview.winRate.toFixed(1)}%`],
    ['Closed Positions', String(exportData.overview.totalClosed)],
    ['Open Positions', String(exportData.overview.totalOpen)],
    ['Avg Win', formatCurrency(exportData.overview.avgWin)],
    ['Avg Loss', formatCurrency(exportData.overview.avgLoss)],
    ['Best Trade', exportData.overview.bestTradeSymbol || '—'],
    ['Worst Trade', exportData.overview.worstTradeSymbol || '—'],
  ], y)

  y = addKeyValueTable(doc, 'Stocks', [
    ['Closed Stock P&L', formatCurrency(exportData.stock.totalPnl)],
    ['Stock Win Rate', `${exportData.stock.winRate.toFixed(1)}%`],
    ['Stock Positions Closed', String(exportData.stock.count)],
  ], y)

  y = addKeyValueTable(doc, 'Options', [
    ['Closed Option P&L', formatCurrency(exportData.options.totalPnl)],
    ['Option Win Rate', `${exportData.options.winRate.toFixed(1)}%`],
    ['Option Positions Closed', String(exportData.options.count)],
    ['Total Premium Collected', formatCurrency(exportData.options.totalPremiumCollected)],
  ], y)

  if (chartsElement) {
    await addChartsSection(doc, chartsElement)
    doc.addPage()
    y = 20
  }

  if (exportData.byStrategy.length > 0) {
    y = addRowsTable(doc, 'By Strategy',
      ['Strategy', 'Trades', 'Win Rate', 'Total P&L'],
      exportData.byStrategy.map((r) => [r.label, r.count, `${r.winRate.toFixed(1)}%`, roundMoney(r.totalPnl)]),
      y)
  }

  if (exportData.bySymbol.length > 0) {
    y = addRowsTable(doc, 'By Symbol',
      ['Symbol', 'Trades', 'Total P&L'],
      exportData.bySymbol.map((r) => [r.symbol, r.count, roundMoney(r.totalPnl)]),
      y)
  }

  if (exportData.closedRows.length > 0) {
    y = addRowsTable(doc, 'Closed Investments',
      ['Symbol', 'Type', 'Strategy', 'Avg Cost', 'Sell Price', 'Sell Date', 'Realized P&L'],
      exportData.closedRows.map((r) => [r.symbol, r.assetType, r.strategyLabel, formatCurrency(r.avgCost), formatCurrency(r.sellPrice), r.sellDate, roundMoney(r.realizedPnl)]),
      y)
  }

  if (exportData.openRows.length > 0) {
    y = addRowsTable(doc, 'Open Positions',
      ['Symbol', 'Type', 'Strategy', 'Shares', 'Avg Cost', 'Current Price', 'Unrealized P&L'],
      exportData.openRows.map((r) => [r.symbol, r.assetType, r.strategyLabel, r.shares, formatCurrency(r.avgCost), r.currentPrice === '' ? '' : formatCurrency(r.currentPrice), roundMoney(r.unrealizedPnl)]),
      y)
  }

  addFooter(doc)

  const filename = `bt-speculation-report-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
