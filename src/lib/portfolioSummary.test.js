import { describe, it, expect } from 'vitest'
import { computeSummary } from './portfolioSummary'

describe('computeSummary', () => {
  it('sums collateral and potential premium across short option positions', () => {
    const investments = [
      { assetType: 'Option', strategy: 'cash_secured_put', shares: 2, strike: 380, avgCost: 1.5 },
      { assetType: 'Option', strategy: 'put_credit_spread', shares: 1, strike: 36, strike2: 35, avgCost: 1.2 },
      { assetType: 'Option', strategy: 'call', shares: 1, strike: 300, avgCost: 5 },
    ]
    const summary = computeSummary(investments)
    expect(summary.totalCollateral).toBe(76100)
    expect(summary.potentialPremium).toBe(420)
  })

  it('excludes covered calls from collateral (covered by shares, not cash) but still counts their premium', () => {
    const investments = [
      { assetType: 'Option', strategy: 'covered_call', shares: 1, strike: 450, avgCost: 3.5 },
    ]
    const summary = computeSummary(investments)
    expect(summary.totalCollateral).toBe(0)
    expect(summary.potentialPremium).toBe(350)
  })

  it('sums unrealized stock P&L using current price minus avg cost, times shares', () => {
    const investments = [
      { assetType: 'Stock', shares: 10, avgCost: 150, currentPrice: 165 },
      { assetType: 'Stock', shares: 5, avgCost: 100, currentPrice: 90 },
    ]
    const summary = computeSummary(investments)
    expect(summary.unrealizedStockPnl).toBe(100)
  })

  it('ignores stock positions with no current price set', () => {
    const investments = [
      { assetType: 'Stock', shares: 10, avgCost: 150, currentPrice: '' },
    ]
    const summary = computeSummary(investments)
    expect(summary.unrealizedStockPnl).toBe(0)
  })

  it('returns zeros for an empty portfolio', () => {
    expect(computeSummary([])).toEqual({ totalCollateral: 0, potentialPremium: 0, unrealizedStockPnl: 0 })
  })
})
