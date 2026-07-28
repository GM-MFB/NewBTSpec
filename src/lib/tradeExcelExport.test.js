import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateTradeExcelWorkbook } from './tradeExcelExport'
import * as XLSX from 'xlsx'

vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
    aoa_to_sheet: vi.fn((rows) => ({ __rows: rows })),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

const trades = [
  {
    id: 't1', type: 'stock', symbol: 'AAPL', direction: 'long', quantity: 10,
    entryPrice: 100, exitPrice: 110, entryDate: '2026-07-01', exitDate: '2026-07-01',
    fees: 1, notes: 'Morning breakout', chartLink: 'https://www.tradingview.com/chart/?symbol=AAPL',
  },
  {
    id: 't2', type: 'option', symbol: 'SPY', optionType: 'call', direction: 'long', quantity: 5,
    entryPrice: 3.2, exitPrice: 4.1, entryDate: '2026-07-06', exitDate: '2026-07-06',
    fees: 2, notes: '', chartLink: '',
  },
  {
    id: 't3', type: 'futures', symbol: 'MES', direction: 'long', quantity: 3,
    ticks: -8, tickValue: 1.25, entryDate: '2026-07-14', exitDate: '2026-07-14',
    fees: 3, notes: '', chartLink: '',
  },
]

describe('generateTradeExcelWorkbook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a single Trades sheet', () => {
    generateTradeExcelWorkbook(trades)
    const sheetNames = XLSX.utils.book_append_sheet.mock.calls.map((c) => c[2])
    expect(sheetNames).toEqual(['Trades'])
  })

  it('writes a header row and one row per trade with computed P&L and type label', () => {
    generateTradeExcelWorkbook(trades)
    const rows = XLSX.utils.aoa_to_sheet.mock.calls[0][0]

    expect(rows[0]).toEqual([
      'Date', 'Symbol', 'Type', 'Direction', 'Quantity',
      'Entry Price', 'Exit Price', 'Ticks', 'Tick Value',
      'Fees', 'P&L', 'Notes', 'Chart Link',
    ])
    expect(rows).toHaveLength(4) // header + 3 trades

    const [, aaplRow] = rows
    expect(aaplRow).toEqual([
      '2026-07-01', 'AAPL', 'Stock', 'long', 10, 100, 110, '', '', 1, 99, 'Morning breakout',
      'https://www.tradingview.com/chart/?symbol=AAPL',
    ])

    const mesRow = rows[3]
    expect(mesRow).toEqual([
      '2026-07-14', 'MES', 'Futures', 'long', 3, '', '', -8, 1.25, 3, -33, '', '',
    ])
  })

  it('calls writeFile with the expected filename', () => {
    generateTradeExcelWorkbook(trades)
    expect(XLSX.writeFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^bt-speculation-trades-export-\d{4}-\d{2}-\d{2}\.xlsx$/)
    )
  })
})
