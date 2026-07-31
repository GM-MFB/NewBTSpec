import { describe, it, expect } from 'vitest'
import { computeSummary, computePortfolioWorth, computeWorthBreakdown } from './portfolioSummary'

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

describe('computePortfolioWorth', () => {
  it('values stock at market value, not unrealized P&L', () => {
    // 100 shares bought at 150, now 165: worth 16,500 — not the 1,500 gain.
    const investments = [{ assetType: 'Stock', symbol: 'AAPL', shares: 100, avgCost: 150, currentPrice: 165 }]
    expect(computePortfolioWorth(investments, 0)).toBe(16500)
  })

  it('adds free cash on top of holdings', () => {
    const investments = [{ assetType: 'Stock', symbol: 'AAPL', shares: 100, avgCost: 150, currentPrice: 165 }]
    expect(computePortfolioWorth(investments, 10000)).toBe(26500)
  })

  it('counts a short cash secured put at its collateral', () => {
    const investments = [{ assetType: 'Option', strategy: 'cash_secured_put', shares: 2, strike: 380, avgCost: 1.5 }]
    expect(computePortfolioWorth(investments, 0)).toBe(76000)
  })

  it('counts a long call at the premium paid', () => {
    const investments = [{ assetType: 'Option', strategy: 'call', shares: 3, strike: 200, avgCost: 2.5 }]
    expect(computePortfolioWorth(investments, 0)).toBe(750)
  })

  it('does not double count a covered call, whose shares are already valued as stock', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 100, avgCost: 150, currentPrice: 165 },
      { assetType: 'Option', symbol: 'AAPL', strategy: 'covered_call', shares: 1, strike: 200, avgCost: 1.2 },
    ]
    expect(computePortfolioWorth(investments, 0)).toBe(16500)
  })

  it('falls back to avg cost when a stock has no current price', () => {
    const investments = [{ assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: '' }]
    expect(computePortfolioWorth(investments, 0)).toBe(1500)
  })

  it('combines cash, stock and options into one total', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 100, avgCost: 150, currentPrice: 165 },
      { assetType: 'Option', strategy: 'cash_secured_put', shares: 1, strike: 380, avgCost: 1.5 },
      { assetType: 'Option', strategy: 'call', shares: 2, strike: 200, avgCost: 3 },
    ]
    // 16,500 stock + 38,000 collateral + 600 premium + 10,000 cash
    expect(computePortfolioWorth(investments, 10000)).toBe(65100)
  })

  it('treats missing or blank cash as zero', () => {
    const investments = [{ assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 100, currentPrice: 100 }]
    expect(computePortfolioWorth(investments, null)).toBe(1000)
    expect(computePortfolioWorth(investments, '')).toBe(1000)
  })
})

describe('computeWorthBreakdown', () => {
  const holdings = [
    { assetType: 'Stock', symbol: 'AAPL', shares: 100, avgCost: 150, currentPrice: 165 },
    { assetType: 'Option', strategy: 'cash_secured_put', shares: 1, strike: 380, avgCost: 1.5 },
    { assetType: 'Option', strategy: 'call', shares: 2, strike: 200, avgCost: 3 },
  ]

  it('splits the total into cash, stock, option collateral and long premium', () => {
    const b = computeWorthBreakdown(holdings, 10000)
    expect(b.cash).toBe(10000)
    expect(b.stockValue).toBe(16500)
    expect(b.optionCollateral).toBe(38000)
    expect(b.longOptionPremium).toBe(600)
  })

  it('has parts that sum to the total, and a total matching computePortfolioWorth', () => {
    const b = computeWorthBreakdown(holdings, 10000)
    expect(b.cash + b.stockValue + b.optionCollateral + b.longOptionPremium).toBe(b.total)
    expect(b.total).toBe(computePortfolioWorth(holdings, 10000))
  })

  it('counts a covered call as collateral of zero, not as long premium', () => {
    const covered = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 100, avgCost: 150, currentPrice: 165 },
      { assetType: 'Option', symbol: 'AAPL', strategy: 'covered_call', shares: 1, strike: 200, avgCost: 1.2 },
    ]
    const b = computeWorthBreakdown(covered, 0)
    expect(b.optionCollateral).toBe(0)
    expect(b.longOptionPremium).toBe(0)
    expect(b.total).toBe(16500)
  })

  it('reports zero parts for an empty portfolio without dividing by anything', () => {
    const b = computeWorthBreakdown([], 0)
    expect(b).toEqual({ cash: 0, stockValue: 0, optionCollateral: 0, longOptionPremium: 0, total: 0 })
  })
})
