import { describe, it, expect } from 'vitest'
import { buildExportData } from './exportData'
import { computeInvestmentStats } from './investmentStats'

const closed = [
  { id: 'i1', status: 'closed', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 100, sellPrice: 150, sellDate: '2026-01-10', strategy: '', strike: '', expiry: '' },
  { id: 'i3', status: 'closed', assetType: 'Option', symbol: 'QQQ', shares: 2, avgCost: 1.5, sellPrice: 0.5, sellDate: '2026-01-12', strategy: 'cash_secured_put', strike: 380, expiry: '2026-01-17' },
]
const open = [
  { id: 'i2', status: 'open', assetType: 'Stock', symbol: 'MSFT', shares: 3, avgCost: 400, currentPrice: 420, strategy: '', strike: '', expiry: '' },
]

describe('buildExportData', () => {
  it('shapes overview, stock, and options figures from computeInvestmentStats', () => {
    const stats = computeInvestmentStats([...closed, ...open])
    const data = buildExportData({ stats, closedInvestments: closed, openInvestments: open, accountName: 'Main Account', startDate: '', endDate: '' })

    expect(data.overview.totalRealizedPnl).toBe(stats.totalRealizedPnl)
    expect(data.overview.totalClosed).toBe(2)
    expect(data.overview.totalOpen).toBe(1)
    expect(data.stock.count).toBe(1)
    expect(data.options.count).toBe(1)
  })

  it('maps closed rows with symbol, strategy label, and realized P&L', () => {
    const stats = computeInvestmentStats([...closed, ...open])
    const data = buildExportData({ stats, closedInvestments: closed, openInvestments: open, accountName: 'Main Account', startDate: '', endDate: '' })

    const aapl = data.closedRows.find((r) => r.symbol === 'AAPL')
    expect(aapl.realizedPnl).toBe(500)
    expect(aapl.strategyLabel).toBe('')

    const qqq = data.closedRows.find((r) => r.symbol === 'QQQ')
    expect(qqq.strategyLabel).toBe('Cash Secured Put')
    expect(qqq.realizedPnl).toBe(200)
  })

  it('maps open rows with unrealized P&L', () => {
    const stats = computeInvestmentStats([...closed, ...open])
    const data = buildExportData({ stats, closedInvestments: closed, openInvestments: open, accountName: 'Main Account', startDate: '', endDate: '' })

    const msft = data.openRows.find((r) => r.symbol === 'MSFT')
    expect(msft.unrealizedPnl).toBe(60)
  })

  it('labels the date range as "All time" when no bounds are set', () => {
    const stats = computeInvestmentStats([])
    const data = buildExportData({ stats, closedInvestments: [], openInvestments: [], accountName: 'Main Account', startDate: '', endDate: '' })
    expect(data.meta.dateRangeLabel).toBe('All time')
  })

  it('labels the date range with both bounds when both are set', () => {
    const stats = computeInvestmentStats([])
    const data = buildExportData({ stats, closedInvestments: [], openInvestments: [], accountName: 'Main Account', startDate: '2026-01-01', endDate: '2026-01-31' })
    expect(data.meta.dateRangeLabel).toBe('2026-01-01 – 2026-01-31')
  })

  it('labels the date range with just a start bound', () => {
    const stats = computeInvestmentStats([])
    const data = buildExportData({ stats, closedInvestments: [], openInvestments: [], accountName: 'Main Account', startDate: '2026-01-01', endDate: '' })
    expect(data.meta.dateRangeLabel).toBe('From 2026-01-01')
  })

  it('labels the date range with just an end bound', () => {
    const stats = computeInvestmentStats([])
    const data = buildExportData({ stats, closedInvestments: [], openInvestments: [], accountName: 'Main Account', startDate: '', endDate: '2026-01-31' })
    expect(data.meta.dateRangeLabel).toBe('Through 2026-01-31')
  })
})
