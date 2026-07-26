import { describe, it, expect } from 'vitest'
import { realizedPnlFor, computeInvestmentStats, unrealizedPnlFor } from './investmentStats'

describe('unrealizedPnlFor', () => {
  it('computes unrealized P&L for a stock with a current price set', () => {
    const investment = { assetType: 'Stock', shares: 10, avgCost: 100, currentPrice: 165 }
    expect(unrealizedPnlFor(investment)).toBe(650)
  })

  it('returns blank when current price is not set', () => {
    const investment = { assetType: 'Stock', shares: 10, avgCost: 100, currentPrice: '' }
    expect(unrealizedPnlFor(investment)).toBe('')
  })
})

describe('realizedPnlFor', () => {
  it('computes stock realized P&L', () => {
    const investment = { status: 'closed', assetType: 'Stock', shares: 10, avgCost: 100, sellPrice: 150 }
    expect(realizedPnlFor(investment)).toBe(500)
  })

  it('computes long option realized P&L (x100 multiplier)', () => {
    const investment = { status: 'closed', assetType: 'Option', strategy: 'call', shares: 1, avgCost: 5, sellPrice: 8 }
    expect(realizedPnlFor(investment)).toBe(300)
  })

  it('computes short option realized P&L when bought back at a price', () => {
    const investment = { status: 'closed', assetType: 'Option', strategy: 'cash_secured_put', shares: 1, avgCost: 2, sellPrice: 0.5 }
    expect(realizedPnlFor(investment)).toBe(150)
  })

  it('treats a blank sellPrice as 0 for a short option (expired worthless = full premium)', () => {
    const investment = { status: 'closed', assetType: 'Option', strategy: 'cash_secured_put', shares: 1, avgCost: 2, sellPrice: '' }
    expect(realizedPnlFor(investment)).toBe(200)
  })

  it('returns null for an open investment', () => {
    const investment = { status: 'open', assetType: 'Stock', shares: 10, avgCost: 100, sellPrice: '' }
    expect(realizedPnlFor(investment)).toBeNull()
  })

  it('falls back to option_direction for the short/long P&L formula when strategy is blank', () => {
    const investment = { status: 'closed', assetType: 'Option', strategy: '', optionDirection: 'short', shares: 1, avgCost: 2, sellPrice: 0.5 }
    expect(realizedPnlFor(investment)).toBe(150)
  })
})

describe('computeInvestmentStats', () => {
  const investments = [
    { status: 'closed', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 100, sellPrice: 150, sellDate: '2026-01-10' },
    { status: 'closed', assetType: 'Stock', symbol: 'TSLA', shares: 5, avgCost: 300, sellPrice: 250, sellDate: '2026-01-05' },
    { status: 'closed', assetType: 'Option', symbol: 'AAPL', strategy: 'cash_secured_put', shares: 2, avgCost: 1.5, sellPrice: '', sellDate: '2026-01-20' },
    { status: 'open', assetType: 'Stock', symbol: 'MSFT', shares: 3, avgCost: 400, sellPrice: '', sellDate: '' },
  ]

  it('computes overview totals and win rate', () => {
    const stats = computeInvestmentStats(investments)
    expect(stats.totalRealizedPnl).toBe(550)
    expect(stats.totalClosed).toBe(3)
    expect(stats.totalOpen).toBe(1)
    expect(stats.winRate).toBeCloseTo(66.67, 1)
  })

  it('identifies the best and worst closed trade', () => {
    const stats = computeInvestmentStats(investments)
    expect(stats.bestTrade.symbol).toBe('AAPL')
    expect(stats.worstTrade.symbol).toBe('TSLA')
  })

  it('splits stock vs option stats', () => {
    const stats = computeInvestmentStats(investments)
    expect(stats.stock.count).toBe(2)
    expect(stats.stock.totalPnl).toBe(250)
    expect(stats.options.count).toBe(1)
    expect(stats.options.totalPnl).toBe(300)
    expect(stats.options.totalPremiumCollected).toBe(300)
  })

  it('groups by strategy', () => {
    const stats = computeInvestmentStats(investments)
    expect(stats.byStrategy).toEqual([
      expect.objectContaining({ strategy: 'cash_secured_put', count: 1, totalPnl: 300 }),
    ])
  })

  it('groups a closed option with no strategy under a fallback label from option_type/option_direction', () => {
    const withLegacy = [
      ...investments,
      { status: 'closed', assetType: 'Option', symbol: 'TSLA', strategy: '', optionType: 'put', optionDirection: 'short', shares: 1, avgCost: 2, sellPrice: 0.5, sellDate: '2026-01-18' },
    ]
    const stats = computeInvestmentStats(withLegacy)
    expect(stats.byStrategy).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Short Put', count: 1, totalPnl: 150 }),
    ]))
    expect(stats.options.totalPremiumCollected).toBe(500)
  })

  it('groups by symbol, sorted by totalPnl descending', () => {
    const stats = computeInvestmentStats(investments)
    expect(stats.bySymbol[0]).toEqual(expect.objectContaining({ symbol: 'AAPL', totalPnl: 800 }))
    expect(stats.bySymbol[1]).toEqual(expect.objectContaining({ symbol: 'TSLA', totalPnl: -250 }))
  })

  it('builds a chronological equity curve of cumulative P&L', () => {
    const stats = computeInvestmentStats(investments)
    expect(stats.equityCurve).toEqual([
      { date: '2026-01-05', cumulative: -250 },
      { date: '2026-01-10', cumulative: 250 },
      { date: '2026-01-20', cumulative: 550 },
    ])
  })
})
