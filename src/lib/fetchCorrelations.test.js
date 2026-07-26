import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeAssetParams, pearson, fetchCorrelations } from './fetchCorrelations'

function mockYahooResponse(closes) {
  return {
    ok: true,
    text: async () => JSON.stringify({ chart: { result: [{ indicators: { quote: [{ close: closes }] } }] } }),
  }
}

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

describe('fetchCorrelations', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('skips known crypto symbols entirely', async () => {
    global.fetch = vi.fn()
    const { corrMap, paramsMap } = await fetchCorrelations(['BTC', 'ETH'])
    expect(global.fetch).not.toHaveBeenCalled()
    expect(paramsMap).toEqual({})
    expect(corrMap).toEqual({})
  })

  it('fetches and computes params/correlations for non-crypto symbols', async () => {
    const closesA = Array.from({ length: 20 }, (_, i) => 100 + i)
    const closesB = Array.from({ length: 20 }, (_, i) => 200 + i * 2)
    global.fetch = vi.fn((url) => {
      if (url.includes('AAPL')) return Promise.resolve(mockYahooResponse(closesA))
      return Promise.resolve(mockYahooResponse(closesB))
    })

    const { corrMap, paramsMap } = await fetchCorrelations(['AAPL', 'MSFT'])

    expect(paramsMap.AAPL).toBeDefined()
    expect(paramsMap.MSFT).toBeDefined()
    expect(corrMap.AAPL.MSFT).toBeCloseTo(1, 3)
    expect(corrMap.MSFT.AAPL).toBeCloseTo(1, 3)
  })

  it('uses the localStorage cache instead of fetching when fresh', async () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    localStorage.setItem('bt_returns_cache_v2', JSON.stringify({
      AAPL: { returns: closes.slice(1).map((c, i) => c / closes[i] - 1), _ts: Date.now() },
    }))
    global.fetch = vi.fn()

    await fetchCorrelations(['AAPL'])

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('refetches when the cache entry is older than 24h', async () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    localStorage.setItem('bt_returns_cache_v2', JSON.stringify({
      AAPL: { returns: [0.01], _ts: Date.now() - 25 * 60 * 60 * 1000 },
    }))
    global.fetch = vi.fn(() => Promise.resolve(mockYahooResponse(closes)))

    await fetchCorrelations(['AAPL'])

    expect(global.fetch).toHaveBeenCalled()
  })

  it('omits a symbol whose fetch fails, without throwing', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('network error')))

    const { corrMap, paramsMap } = await fetchCorrelations(['AAPL'])

    expect(paramsMap.AAPL).toBeUndefined()
    expect(corrMap.AAPL).toBeUndefined()
  })
})
