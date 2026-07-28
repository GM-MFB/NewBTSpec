import { describe, it, expect } from 'vitest'
import {
  getAssetParams, getCorrelation, setRealCorrelations, setComputedParams, getCorrVersion,
  portfolioStats, randomWeights, generateEfficientFrontierData, extractFrontier,
  generateCombinedFrontierData, runBackwardElimination, findOptimalSubset, findOptimalSubsetForSymbols,
  getCorrelationMatrix, getCorrelationMatrixForSymbols, getPortfolioRiskMetrics, getRiskContribution,
  getStressTests,
} from './efficientFrontier'

describe('getAssetParams', () => {
  it('returns the static table entry for a known ticker', () => {
    const params = getAssetParams('AAPL')
    expect(params.r).toBe(0.15)
    expect(params.s).toBe(0.27)
    expect(params.cat).toBe('tech')
  })

  it('returns the default for an unknown ticker', () => {
    const params = getAssetParams('ZZZZ')
    expect(params).toEqual({ r: 0.12, s: 0.28, cat: 'other' })
  })

  it('overrides r/s with computed params while keeping the static category', () => {
    setComputedParams({ AAPL: { r: 0.20, s: 0.30 } })
    const params = getAssetParams('AAPL')
    expect(params.r).toBe(0.20)
    expect(params.s).toBe(0.30)
    expect(params.cat).toBe('tech')
  })
})

describe('getCorrelation', () => {
  it('returns 1 for identical symbols', () => {
    expect(getCorrelation('AAPL', 'AAPL')).toBe(1)
  })

  it('returns 0 when either symbol is CASH', () => {
    expect(getCorrelation('AAPL', 'CASH')).toBe(0)
    expect(getCorrelation('CASH', 'AAPL')).toBe(0)
  })

  it('prefers a real correlation override when present', () => {
    setRealCorrelations({ AAPL: { MSFT: 0.99 } })
    expect(getCorrelation('AAPL', 'MSFT')).toBe(0.99)
    expect(getCorrelation('MSFT', 'AAPL')).toBe(0.99)
  })

  it('falls back to the category table when no real correlation exists', () => {
    expect(getCorrelation('AAPL', 'NVDA')).toBe(0.65)
  })

  it('defaults to 0.50 for an unknown category pair', () => {
    expect(getCorrelation('ZZZZ1', 'ZZZZ2')).toBe(0.50)
  })

  it('bumps corrVersion when setRealCorrelations or setComputedParams is called', () => {
    const before = getCorrVersion()
    setRealCorrelations({ AAPL: { QQQ: 0.5 } })
    expect(getCorrVersion()).toBe(before + 1)
    setComputedParams({ AAPL: { r: 0.1, s: 0.2 } })
    expect(getCorrVersion()).toBe(before + 2)
  })
})

describe('portfolioStats', () => {
  it('computes return/vol/sharpe for a hand-computed 2-asset example', () => {
    setComputedParams({
      ASSET_A: { r: 0.10, s: 0.20 },
      ASSET_B: { r: 0.20, s: 0.30 },
    })
    setRealCorrelations({ ASSET_A: { ASSET_B: 0.5 } })

    const { ret, vol, sharpe } = portfolioStats(['ASSET_A', 'ASSET_B'], [0.5, 0.5])

    const expectedRet = 0.5 * 0.10 + 0.5 * 0.20
    const variance = (0.5 ** 2) * (0.20 ** 2) + (0.5 ** 2) * (0.30 ** 2) + 2 * 0.5 * 0.5 * 0.20 * 0.30 * 0.5
    const expectedVol = Math.sqrt(variance)

    expect(ret).toBeCloseTo(expectedRet, 6)
    expect(vol).toBeCloseTo(expectedVol, 6)
    expect(sharpe).toBeCloseTo((expectedRet - 0.045) / expectedVol, 6)
  })
})

describe('randomWeights', () => {
  it('sums to 1 and all values are positive', () => {
    const weights = randomWeights(5)
    expect(weights).toHaveLength(5)
    expect(weights.every((w) => w > 0)).toBe(true)
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })
})

describe('extractFrontier', () => {
  it('keeps only monotonically-increasing-return points across vol buckets', () => {
    const points = [
      { ret: 0.05, vol: 0.10 },
      { ret: 0.08, vol: 0.15 },
      { ret: 0.06, vol: 0.20 },
      { ret: 0.12, vol: 0.25 },
    ]
    const frontier = extractFrontier(points)
    const returns = frontier.map((p) => p.ret)
    expect(returns).toEqual([...returns].sort((a, b) => a - b))
    expect(frontier.some((p) => p.ret === 0.06)).toBe(false)
  })

  it('returns an empty array for no points', () => {
    expect(extractFrontier([])).toEqual([])
  })
})

describe('generateEfficientFrontierData', () => {
  it('runs the requested number of simulations and returns a non-empty frontier', () => {
    const result = generateEfficientFrontierData(['AAPL', 'SPY', 'TLT'], { nSim: 500 })
    expect(result.points).toHaveLength(500)
    expect(result.frontier.length).toBeGreaterThan(0)
    expect(result.maxSharpe).toBeDefined()
    expect(result.maxDiversification).toBeDefined()
  })

  it('adds CASH as a near-risk-free asset when cashOptions.amount > 0', () => {
    const result = generateEfficientFrontierData(['AAPL', 'SPY'], { nSim: 200, cashOptions: { amount: 1000, rate: 0.03 } })
    expect(result.symbols).toContain('CASH')
    expect(result.points[0].weights).toHaveLength(3)
  })
})

describe('generateCombinedFrontierData', () => {
  it('unions portfolio and new symbols, with 0 weight for new ones in the current point', () => {
    const result = generateCombinedFrontierData(['AAPL', 'SPY'], [0.6, 0.4], ['TLT'], { nSim: 200 })
    expect(result.symbols).toEqual(['AAPL', 'SPY', 'TLT'])
    expect(result.current.weights).toEqual([0.6, 0.4, 0])
  })

  it('excludes an extra symbol already held from the new-symbols union', () => {
    const result = generateCombinedFrontierData(['AAPL', 'SPY'], [0.5, 0.5], ['AAPL'], { nSim: 200 })
    expect(result.symbols).toEqual(['AAPL', 'SPY'])
  })

  it('pads the current point with a 0 weight for CASH when cashOptions.amount > 0', () => {
    const result = generateCombinedFrontierData(['AAPL', 'SPY'], [0.6, 0.4], ['TLT'], {
      nSim: 200, cashOptions: { amount: 5000, rate: 0.03 },
    })
    expect(result.symbols).toEqual(['AAPL', 'SPY', 'TLT', 'CASH'])
    expect(result.current.weights).toEqual([0.6, 0.4, 0, 0])
  })
})

describe('runBackwardElimination', () => {
  it('drops a clearly-bad symbol and stops at the floor of 2 when no further improvement is possible', () => {
    setComputedParams({
      GOOD_A: { r: 0.15, s: 0.15 },
      GOOD_B: { r: 0.14, s: 0.16 },
      BAD: { r: 0.02, s: 0.40 },
    })
    setRealCorrelations({
      GOOD_A: { GOOD_B: 0.1, BAD: 0.1 },
      GOOD_B: { BAD: 0.1 },
    })

    const result = runBackwardElimination(['GOOD_A', 'GOOD_B', 'BAD'], 2000)

    expect(result.dropped).toEqual(['BAD'])
    expect(result.optimalSymbols.sort()).toEqual(['GOOD_A', 'GOOD_B'])
    expect(result.improved).toBe(true)
    expect(result.optimalSharpe).toBeGreaterThan(result.fullSharpe)
    expect(result.steps.length).toBe(2)
  })

  it('stops immediately when removing any symbol does not improve Sharpe', () => {
    setComputedParams({
      A: { r: 0.10, s: 0.10 },
      B: { r: 0.10, s: 0.10 },
    })
    setRealCorrelations({ A: { B: 0.0 } })

    const result = runBackwardElimination(['A', 'B'], 2000)

    expect(result.steps.length).toBe(1)
    expect(result.dropped).toEqual([])
    expect(result.optimalSymbols).toEqual(['A', 'B'])
  })

  it('findOptimalSubset and findOptimalSubsetForSymbols both delegate to runBackwardElimination', () => {
    const a = findOptimalSubset(['A', 'B'], 500)
    const b = findOptimalSubsetForSymbols(['A', 'B'], 500)
    expect(a.fullSymbols).toEqual(b.fullSymbols)
  })
})

describe('getCorrelationMatrix', () => {
  it('returns a symmetric matrix with 1 on the diagonal', () => {
    const matrix = getCorrelationMatrix(['AAPL', 'MSFT', 'SPY'])
    expect(matrix).toHaveLength(3)
    expect(matrix[0][0]).toBe(1)
    expect(matrix[1][1]).toBe(1)
    expect(matrix[0][1]).toBe(matrix[1][0])
  })

  it('getCorrelationMatrixForSymbols is equivalent to getCorrelationMatrix', () => {
    expect(getCorrelationMatrixForSymbols(['AAPL', 'SPY'])).toEqual(getCorrelationMatrix(['AAPL', 'SPY']))
  })
})

describe('getPortfolioRiskMetrics', () => {
  const positions = [
    { symbol: 'AAPL', weight: 0.6, marketValue: 6000, currentPrice: 200, stopLoss: 180, shares: 30 },
    { symbol: 'SPY', weight: 0.4, marketValue: 4000, currentPrice: 500, stopLoss: null, shares: 8 },
  ]

  it('computes HHI and diversification score', () => {
    const metrics = getPortfolioRiskMetrics(positions)
    const hhi = 0.6 ** 2 + 0.4 ** 2
    expect(metrics.hhi).toBeCloseTo(hhi, 6)
    expect(metrics.diversificationScore).toBe(Math.round((1 - hhi) * 100))
  })

  it('computes stop coverage and dollar at risk only counting positions with a stop below price', () => {
    const metrics = getPortfolioRiskMetrics(positions)
    expect(metrics.stopCoveragePct).toBe(50)
    expect(metrics.dollarAtRisk).toBeCloseTo((200 - 180) * 30, 6)
  })

  it('computes totalMV as the sum of market values', () => {
    const metrics = getPortfolioRiskMetrics(positions)
    expect(metrics.totalMV).toBe(10000)
  })

  it('excludes option positions from the stop-coverage denominator', () => {
    const withOption = [
      ...positions,
      { symbol: 'MSFT', assetType: 'Option', weight: 0, marketValue: 0, currentPrice: undefined, stopLoss: null, shares: undefined },
    ]
    const metrics = getPortfolioRiskMetrics(withOption)
    expect(metrics.stopCoveragePct).toBe(50)
  })

  it('includes option positions in HHI, beta and totalMV rather than ignoring them', () => {
    const stockOnly = [
      { symbol: 'AAPL', weight: 0.6, marketValue: 6000, currentPrice: 200, stopLoss: 180, shares: 30 },
      { symbol: 'SPY', weight: 0.4, marketValue: 4000, currentPrice: 500, stopLoss: null, shares: 8 },
    ]
    const withOption = [
      { symbol: 'AAPL', weight: 0.4, marketValue: 6000, currentPrice: 200, stopLoss: 180, shares: 30 },
      { symbol: 'SPY', weight: 0.27, marketValue: 4000, currentPrice: 500, stopLoss: null, shares: 8 },
      { symbol: 'TSLA', assetType: 'Option', weight: 0.33, marketValue: 5000, currentPrice: undefined, stopLoss: null, shares: undefined },
    ]

    const stockMetrics = getPortfolioRiskMetrics(stockOnly)
    const optionMetrics = getPortfolioRiskMetrics(withOption)

    expect(optionMetrics.totalMV).toBe(15000)
    expect(optionMetrics.totalMV).not.toBe(stockMetrics.totalMV)
    expect(optionMetrics.hhi).not.toBeCloseTo(stockMetrics.hhi, 6)
    expect(optionMetrics.beta).not.toBeCloseTo(stockMetrics.beta, 6)
  })
})

describe('getRiskContribution', () => {
  it('flags a position as outsized when its risk% exceeds its weight% by more than 5', () => {
    setComputedParams({
      LOW_VOL: { r: 0.08, s: 0.05 },
      HIGH_VOL: { r: 0.15, s: 0.50 },
    })
    setRealCorrelations({ LOW_VOL: { HIGH_VOL: 0.2 } })

    const positions2 = [
      { symbol: 'LOW_VOL', weight: 0.5 },
      { symbol: 'HIGH_VOL', weight: 0.5 },
    ]
    const contributions = getRiskContribution(positions2)
    const highVol = contributions.find((c) => c.symbol === 'HIGH_VOL')
    expect(highVol.riskPct).toBeGreaterThan(highVol.weightPct + 5)
    expect(highVol.flag).toBe('outsized')
  })

  it('flags a position as efficient when its risk% is well below its weight%', () => {
    setComputedParams({
      LOW_VOL: { r: 0.08, s: 0.05 },
      HIGH_VOL: { r: 0.15, s: 0.50 },
    })
    setRealCorrelations({ LOW_VOL: { HIGH_VOL: 0.2 } })

    const positions2 = [
      { symbol: 'LOW_VOL', weight: 0.5 },
      { symbol: 'HIGH_VOL', weight: 0.5 },
    ]
    const contributions = getRiskContribution(positions2)
    const lowVol = contributions.find((c) => c.symbol === 'LOW_VOL')
    expect(lowVol.riskPct).toBeLessThan(lowVol.weightPct - 5)
    expect(lowVol.flag).toBe('efficient')
  })
})

describe('getStressTests', () => {
  it('returns all 6 fixed scenarios with a portfolio-level move', () => {
    const positions = [
      { symbol: 'SPY', weight: 1, marketValue: 10000 },
    ]
    const results = getStressTests(positions)
    expect(results.map((r) => r.name)).toEqual(['Bull Run', 'Mild Pullback', 'Correction', 'Bear Market', 'Crash', '2008-Level'])
    expect(results[0].marketMove).toBe(0.20)
  })

  it('sorts per-position impacts most-negative first', () => {
    const positions = [
      { symbol: 'LOW_BETA', weight: 0.5, marketValue: 5000 },
      { symbol: 'HIGH_BETA', weight: 0.5, marketValue: 5000 },
    ]
    setComputedParams({ LOW_BETA: { r: 0.08, s: 0.05 }, HIGH_BETA: { r: 0.20, s: 0.50 } })
    const results = getStressTests(positions)
    const bearMarket = results.find((r) => r.name === 'Bear Market')
    expect(bearMarket.perPosition[0].impact).toBeLessThanOrEqual(bearMarket.perPosition[1].impact)
  })

  describe('with option positions', () => {
    const stockPositions = [{ symbol: 'SPY', weight: 1, marketValue: 10000 }]

    it('shows full capital-at-risk impact for a long call in down-move scenarios, $0 in Bull Run', () => {
      const optionPositions = [{ symbol: 'AAPL', optionType: 'call', optionDirection: 'long', capitalAtRisk: 500 }]
      const results = getStressTests(stockPositions, optionPositions)
      const bullRun = results.find((r) => r.name === 'Bull Run')
      const correction = results.find((r) => r.name === 'Correction')
      expect(bullRun.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(0)
      expect(correction.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(-500)
    })

    it('shows full capital-at-risk impact for a long put in Bull Run, $0 in down-move scenarios', () => {
      const optionPositions = [{ symbol: 'AAPL', optionType: 'put', optionDirection: 'long', capitalAtRisk: 400 }]
      const results = getStressTests(stockPositions, optionPositions)
      const bullRun = results.find((r) => r.name === 'Bull Run')
      const crash = results.find((r) => r.name === 'Crash')
      expect(bullRun.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(-400)
      expect(crash.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(0)
    })

    it('shows full capital-at-risk impact for a short cash secured put in down-move scenarios', () => {
      const optionPositions = [{ symbol: 'AAPL', optionType: 'put', optionDirection: 'short', capitalAtRisk: 38000 }]
      const results = getStressTests(stockPositions, optionPositions)
      const bearMarket = results.find((r) => r.name === 'Bear Market')
      expect(bearMarket.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(-38000)
    })

    it('shows full capital-at-risk impact for a call credit spread in Bull Run', () => {
      const optionPositions = [{ symbol: 'AAPL', optionType: 'call', optionDirection: 'short', capitalAtRisk: 100 }]
      const results = getStressTests(stockPositions, optionPositions)
      const bullRun = results.find((r) => r.name === 'Bull Run')
      const correction = results.find((r) => r.name === 'Correction')
      expect(bullRun.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(-100)
      expect(correction.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(0)
    })

    it('shows $0 impact for a covered call in every scenario', () => {
      const optionPositions = [{ symbol: 'AAPL', optionType: 'call', optionDirection: 'short', capitalAtRisk: 0 }]
      const results = getStressTests(stockPositions, optionPositions)
      for (const scenario of results) {
        expect(scenario.perPosition.find((p) => p.symbol === 'AAPL').impact).toBe(0)
      }
    })

    it('sets totalImpact to the sum of all perPosition impacts including options', () => {
      const optionPositions = [{ symbol: 'AAPL', optionType: 'call', optionDirection: 'long', capitalAtRisk: 500 }]
      const results = getStressTests(stockPositions, optionPositions)
      for (const scenario of results) {
        const expectedTotal = scenario.perPosition.reduce((sum, p) => sum + p.impact, 0)
        expect(scenario.totalImpact).toBeCloseTo(expectedTotal, 6)
      }
    })
  })
})
