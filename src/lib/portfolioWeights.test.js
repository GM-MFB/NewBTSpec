import { describe, it, expect } from 'vitest'
import { computeStockWeights, computeStockTotalValue } from './portfolioWeights'

describe('computeStockWeights', () => {
  it('weights each symbol by its market value (shares * currentPrice)', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 200 },
      { assetType: 'Stock', symbol: 'SPY', shares: 2, avgCost: 500, currentPrice: 500 },
    ]
    const weights = computeStockWeights(investments, ['AAPL', 'SPY'])
    // AAPL: 10*200=2000, SPY: 2*500=1000, total=3000
    expect(weights[0]).toBeCloseTo(2000 / 3000)
    expect(weights[1]).toBeCloseTo(1000 / 3000)
  })

  it('falls back to avgCost when currentPrice is blank', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: '' },
      { assetType: 'Stock', symbol: 'SPY', shares: 10, avgCost: 150, currentPrice: '' },
    ]
    const weights = computeStockWeights(investments, ['AAPL', 'SPY'])
    expect(weights[0]).toBeCloseTo(0.5)
    expect(weights[1]).toBeCloseTo(0.5)
  })

  it('sums multiple lots of the same symbol', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 5, avgCost: 150, currentPrice: 200 },
      { assetType: 'Stock', symbol: 'AAPL', shares: 5, avgCost: 150, currentPrice: 200 },
      { assetType: 'Stock', symbol: 'SPY', shares: 5, avgCost: 500, currentPrice: 500 },
    ]
    const weights = computeStockWeights(investments, ['AAPL', 'SPY'])
    // AAPL: 10*200=2000, SPY: 5*500=2500
    expect(weights[0]).toBeCloseTo(2000 / 4500)
    expect(weights[1]).toBeCloseTo(2500 / 4500)
  })

  it('ignores non-Stock investments (options)', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 200 },
      { assetType: 'Option', symbol: 'AAPL', shares: 2, avgCost: 5, strike: 200 },
    ]
    const weights = computeStockWeights(investments, ['AAPL'])
    expect(weights[0]).toBeCloseTo(1)
  })

  it('falls back to equal weight when total value is 0', () => {
    const weights = computeStockWeights([], ['AAPL', 'SPY', 'TLT'])
    expect(weights[0]).toBeCloseTo(1 / 3)
    expect(weights[1]).toBeCloseTo(1 / 3)
    expect(weights[2]).toBeCloseTo(1 / 3)
  })

  it('returns an empty array for no symbols', () => {
    expect(computeStockWeights([], [])).toEqual([])
  })
})

describe('computeStockTotalValue', () => {
  it('sums market value (shares * currentPrice) across the given symbols', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 200 },
      { assetType: 'Stock', symbol: 'SPY', shares: 2, avgCost: 500, currentPrice: 500 },
    ]
    expect(computeStockTotalValue(investments, ['AAPL', 'SPY'])).toBe(3000)
  })

  it('falls back to avgCost when currentPrice is blank', () => {
    const investments = [{ assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: '' }]
    expect(computeStockTotalValue(investments, ['AAPL'])).toBe(1500)
  })

  it('ignores non-Stock investments and unrelated symbols', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 200 },
      { assetType: 'Option', symbol: 'AAPL', shares: 2, avgCost: 5, strike: 200 },
      { assetType: 'Stock', symbol: 'TSLA', shares: 100, avgCost: 250, currentPrice: 260 },
    ]
    expect(computeStockTotalValue(investments, ['AAPL'])).toBe(2000)
  })

  it('returns 0 for no investments', () => {
    expect(computeStockTotalValue([], ['AAPL'])).toBe(0)
  })
})
