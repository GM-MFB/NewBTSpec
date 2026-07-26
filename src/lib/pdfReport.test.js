import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generatePdfReport } from './pdfReport'

const saveMock = vi.fn()
const addImageMock = vi.fn()
const textMock = vi.fn()
const setFontSizeMock = vi.fn()
const setTextColorMock = vi.fn()
const setPageMock = vi.fn()
const jsPdfInstance = {
  save: saveMock,
  addImage: addImageMock,
  text: textMock,
  setFontSize: setFontSizeMock,
  setTextColor: setTextColorMock,
  setPage: setPageMock,
  internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 }, getNumberOfPages: () => 1 },
  lastAutoTable: { finalY: 40 },
}

vi.mock('jspdf', () => ({ jsPDF: vi.fn(function jsPDF() { return jsPdfInstance }) }))
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }))
vi.mock('html2canvas', () => ({ default: vi.fn().mockResolvedValue({ toDataURL: () => 'data:image/png;base64,fake', width: 800, height: 400 }) }))

const exportData = {
  meta: { accountName: 'Main Account', generatedAt: '2026-01-20T00:00:00.000Z', dateRangeLabel: 'All time' },
  overview: { totalRealizedPnl: 500, winRate: 100, totalClosed: 1, totalOpen: 0, avgWin: 500, avgLoss: 0, bestTradeSymbol: 'AAPL', worstTradeSymbol: '' },
  stock: { totalPnl: 500, winRate: 100, count: 1 },
  options: { totalPnl: 0, winRate: 0, count: 0, totalPremiumCollected: 0 },
  byStrategy: [],
  bySymbol: [{ symbol: 'AAPL', count: 1, totalPnl: 500 }],
  closedRows: [{ symbol: 'AAPL', assetType: 'Stock', strategyLabel: '', avgCost: 100, sellPrice: 150, sellDate: '2026-01-10', realizedPnl: 500 }],
  openRows: [],
}

describe('generatePdfReport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves a PDF with the expected filename', async () => {
    await generatePdfReport(exportData, null)
    expect(saveMock).toHaveBeenCalledWith(expect.stringMatching(/^bt-speculation-report-\d{4}-\d{2}-\d{2}\.pdf$/))
  })

  it('writes the account name and date range into the header', async () => {
    await generatePdfReport(exportData, null)
    const allTextCalls = textMock.mock.calls.map((c) => c[0]).join(' ')
    expect(allTextCalls).toContain('Main Account')
    expect(allTextCalls).toContain('All time')
  })

  it('skips chart capture when no charts element is provided', async () => {
    await generatePdfReport(exportData, null)
    expect(addImageMock).not.toHaveBeenCalled()
  })

  it('captures chart images when a charts element is provided', async () => {
    const fakeElement = {}
    await generatePdfReport(exportData, fakeElement)
    expect(addImageMock).toHaveBeenCalled()
  })
})
