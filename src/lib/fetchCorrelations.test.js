import { describe, it, expect } from 'vitest'
import { computeAssetParams, pearson } from './fetchCorrelations'

describe('computeAssetParams', () => {
  it('annualizes weekly mean and stddev', () => {
    const returns = [0.01, -0.02, 0.015, 0.005, -0.01, 0.02]
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
    const stddev = Math.sqrt(variance)

    const result = computeAssetParams(returns)
    expect(result.r).toBeCloseTo(mean * 52, 6)
    expect(result.s).toBeCloseTo(stddev * Math.sqrt(52), 6)
  })
})

describe('pearson', () => {
  it('returns 1 for perfectly correlated series', () => {
    expect(pearson([1, 2, 3, 4, 5, 6, 7, 8], [2, 4, 6, 8, 10, 12, 14, 16])).toBeCloseTo(1, 5)
  })

  it('returns -1 for perfectly anti-correlated series', () => {
    expect(pearson([1, 2, 3, 4, 5, 6, 7, 8], [8, 7, 6, 5, 4, 3, 2, 1])).toBeCloseTo(-1, 5)
  })

  it('uses the overlapping tail when arrays differ in length', () => {
    const a = [100, 1, 2, 3, 4, 5, 6, 7, 8]
    const b = [2, 4, 6, 8, 10, 12, 14, 16]
    expect(pearson(a, b)).toBeCloseTo(1, 5)
  })

  it('returns null when the overlap is under 8 points', () => {
    expect(pearson([1, 2, 3], [1, 2, 3])).toBeNull()
  })
})
