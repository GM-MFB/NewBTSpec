import { describe, it, expect } from 'vitest'
import { computePositionWeights, computePositionTotalValue } from './portfolioWeights'

describe('computePositionWeights', () => {
  it('weights each symbol by its market value (shares * currentPrice)', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 200 },
      { assetType: 'Stock', symbol: 'SPY', shares: 2, avgCost: 500, currentPrice: 500 },
    ]
    const weights = computePositionWeights(investments, ['AAPL', 'SPY'])
    // AAPL: 10*200=2000, SPY: 2*500=1000, total=3000
    expect(weights[0]).toBeCloseTo(2000 / 3000)
    expect(weights[1]).toBeCloseTo(1000 / 3000)
  })

  it('falls back to avgCost when currentPrice is blank', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: '' },
      { assetType: 'Stock', symbol: 'SPY', shares: 10, avgCost: 150, currentPrice: '' },
    ]
    const weights = computePositionWeights(investments, ['AAPL', 'SPY'])
    expect(weights[0]).toBeCloseTo(0.5)
    expect(weights[1]).toBeCloseTo(0.5)
  })

  it('sums multiple lots of the same symbol', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 5, avgCost: 150, currentPrice: 200 },
      { assetType: 'Stock', symbol: 'AAPL', shares: 5, avgCost: 150, currentPrice: 200 },
      { assetType: 'Stock', symbol: 'SPY', shares: 5, avgCost: 500, currentPrice: 500 },
    ]
    const weights = computePositionWeights(investments, ['AAPL', 'SPY'])
    // AAPL: 10*200=2000, SPY: 5*500=2500
    expect(weights[0]).toBeCloseTo(2000 / 4500)
    expect(weights[1]).toBeCloseTo(2500 / 4500)
  })

  it('weights a short cash-secured put by its collateral (strike * 100 * contracts)', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 200 },
      { assetType: 'Option', symbol: 'QQQ', shares: 2, avgCost: 3, strategy: 'cash_secured_put', optionType: 'put', optionDirection: 'short', strike: 400 },
    ]
    // AAPL: 2000, QQQ collateral: 400*100*2=80000, total=82000
    const weights = computePositionWeights(investments, ['AAPL', 'QQQ'])
    expect(weights[0]).toBeCloseTo(2000 / 82000)
    expect(weights[1]).toBeCloseTo(80000 / 82000)
  })

  it('weights a credit spread by its width collateral', () => {
    const investments = [
      { assetType: 'Option', symbol: 'SPY', shares: 1, avgCost: 1.2, strategy: 'put_credit_spread', optionType: 'put', optionDirection: 'short', strike: 40, strike2: 35 },
    ]
    // width 5 * 100 * 1 = 500
    const weights = computePositionWeights(investments, ['SPY'])
    expect(weights[0]).toBeCloseTo(1)
  })

  it('contributes 0 for a long option or covered call (no cash collateral tied up)', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 200 },
      { assetType: 'Option', symbol: 'NVDA', shares: 2, avgCost: 5, strategy: 'call', optionType: 'call', optionDirection: 'long', strike: 130 },
    ]
    const weights = computePositionWeights(investments, ['AAPL', 'NVDA'])
    expect(weights[0]).toBeCloseTo(1)
    expect(weights[1]).toBeCloseTo(0)
  })

  it('falls back to equal weight when total value is 0', () => {
    const weights = computePositionWeights([], ['AAPL', 'SPY', 'TLT'])
    expect(weights[0]).toBeCloseTo(1 / 3)
    expect(weights[1]).toBeCloseTo(1 / 3)
    expect(weights[2]).toBeCloseTo(1 / 3)
  })

  it('returns an empty array for no symbols', () => {
    expect(computePositionWeights([], [])).toEqual([])
  })
})

describe('computePositionTotalValue', () => {
  it('sums market value (shares * currentPrice) across the given symbols', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 200 },
      { assetType: 'Stock', symbol: 'SPY', shares: 2, avgCost: 500, currentPrice: 500 },
    ]
    expect(computePositionTotalValue(investments, ['AAPL', 'SPY'])).toBe(3000)
  })

  it('falls back to avgCost when currentPrice is blank', () => {
    const investments = [{ assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: '' }]
    expect(computePositionTotalValue(investments, ['AAPL'])).toBe(1500)
  })

  it('includes option collateral and ignores unrelated symbols', () => {
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 200 },
      { assetType: 'Option', symbol: 'AAPL', shares: 2, avgCost: 3, strategy: 'cash_secured_put', optionType: 'put', optionDirection: 'short', strike: 190 },
      { assetType: 'Stock', symbol: 'TSLA', shares: 100, avgCost: 250, currentPrice: 260 },
    ]
    // AAPL stock: 2000, AAPL put collateral: 190*100*2=38000
    expect(computePositionTotalValue(investments, ['AAPL'])).toBe(40000)
  })

  it('returns 0 for no investments', () => {
    expect(computePositionTotalValue([], ['AAPL'])).toBe(0)
  })
})
