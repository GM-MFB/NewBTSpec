import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateExcelWorkbook } from './excelExport'
import * as XLSX from 'xlsx'

vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
    aoa_to_sheet: vi.fn((rows) => ({ __rows: rows })),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

const exportData = {
  meta: { accountName: 'Main Account', generatedAt: '2026-01-20T00:00:00.000Z', dateRangeLabel: 'All time' },
  overview: { totalRealizedPnl: 500, winRate: 100, totalClosed: 1, totalOpen: 0, avgWin: 500, avgLoss: 0, bestTradeSymbol: 'AAPL', worstTradeSymbol: '' },
  stock: { totalPnl: 500, winRate: 100, count: 1 },
  options: { totalPnl: 0, winRate: 0, count: 0, totalPremiumCollected: 0 },
  byStrategy: [{ label: 'Cash Secured Put', count: 1, winRate: 100, totalPnl: 200 }],
  bySymbol: [{ symbol: 'AAPL', count: 1, totalPnl: 500 }],
  closedRows: [{ symbol: 'AAPL', assetType: 'Stock', strategyLabel: '', avgCost: 100, sellPrice: 150, sellDate: '2026-01-10', realizedPnl: 500 }],
  openRows: [{ symbol: 'MSFT', assetType: 'Stock', strategyLabel: '', shares: 3, avgCost: 400, currentPrice: 420, unrealizedPnl: 60 }],
}

describe('generateExcelWorkbook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates five sheets with the expected names', () => {
    generateExcelWorkbook(exportData)
    const sheetNames = XLSX.utils.book_append_sheet.mock.calls.map((c) => c[2])
    expect(sheetNames).toEqual(['Overview', 'Closed Investments', 'Open Investments', 'By Strategy', 'By Symbol'])
  })

  it('writes the closed investment row data into the Closed Investments sheet', () => {
    generateExcelWorkbook(exportData)
    const closedSheetRows = XLSX.utils.aoa_to_sheet.mock.calls[1][0]
    expect(closedSheetRows).toEqual(expect.arrayContaining([
      expect.arrayContaining(['AAPL', 'Stock']),
    ]))
  })

  it('calls writeFile with the expected filename', () => {
    generateExcelWorkbook(exportData)
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^bt-speculation-export-\d{4}-\d{2}-\d{2}\.xlsx$/))
  })
})
