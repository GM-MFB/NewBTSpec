import { describe, it, expect } from 'vitest'
import { computeTradeStats } from './tradeStatsSummary'

const trades = [
  { id: 't1', type: 'stock', symbol: 'AAPL', direction: 'long', quantity: 10, entryPrice: 100, exitPrice: 110, exitDate: '2026-01-05', fees: 0 },
  { id: 't2', type: 'stock', symbol: 'AAPL', direction: 'long', quantity: 10, entryPrice: 50, exitPrice: 45, exitDate: '2026-01-10', fees: 0 },
  { id: 't3', type: 'option', optionType: 'call', symbol: 'SPY', direction: 'long', quantity: 1, entryPrice: 1, exitPrice: 2, exitDate: '2026-01-12', fees: 0 },
  { id: 't4', type: 'stock', symbol: 'MSFT', direction: 'long', quantity: 1, entryPrice: 100, exitPrice: '', exitDate: '', fees: 0 }, // legacy open
]

describe('computeTradeStats', () => {
  it('excludes legacy open trades from totalClosed', () => {
    const stats = computeTradeStats(trades)
    expect(stats.totalClosed).toBe(3)
  })

  it('computes totalRealizedPnl as the sum of all closed trades P&L', () => {
    const stats = computeTradeStats(trades)
    // t1: +100, t2: -50, t3: +100
    expect(stats.totalRealizedPnl).toBe(150)
  })

  it('computes win rate as a percentage of winning closed trades', () => {
    const stats = computeTradeStats(trades)
    expect(stats.winRate).toBeCloseTo((2 / 3) * 100)
  })

  it('finds best and worst trade by P&L', () => {
    const stats = computeTradeStats(trades)
    expect(stats.bestTrade.id).toBe('t1')
    expect(stats.worstTrade.id).toBe('t2')
  })

  it('groups by type label', () => {
    const stats = computeTradeStats(trades)
    const stockGroup = stats.byType.find((g) => g.type === 'Stock')
    const callGroup = stats.byType.find((g) => g.type === 'Call')
    expect(stockGroup.count).toBe(2)
    expect(stockGroup.totalPnl).toBe(50)
    expect(callGroup.count).toBe(1)
    expect(callGroup.totalPnl).toBe(100)
  })

  it('groups by symbol, sorted by totalPnl descending', () => {
    const stats = computeTradeStats(trades)
    expect(stats.bySymbol.map((s) => s.symbol)).toEqual(['SPY', 'AAPL'])
    expect(stats.bySymbol[1].totalPnl).toBe(50) // AAPL: +100 - 50
  })

  it('builds an equity curve sorted by exit date with running totals', () => {
    const stats = computeTradeStats(trades)
    expect(stats.equityCurve).toEqual([
      { date: '2026-01-05', cumulative: 100 },
      { date: '2026-01-10', cumulative: 50 },
      { date: '2026-01-12', cumulative: 150 },
    ])
  })

  it('returns zeroed stats for an empty list', () => {
    const stats = computeTradeStats([])
    expect(stats.totalClosed).toBe(0)
    expect(stats.totalRealizedPnl).toBe(0)
    expect(stats.bestTrade).toBeNull()
    expect(stats.worstTrade).toBeNull()
    expect(stats.byType).toEqual([])
    expect(stats.bySymbol).toEqual([])
    expect(stats.equityCurve).toEqual([])
  })
})
