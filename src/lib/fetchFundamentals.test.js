import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchFundamentals, fetchPeers } from './fetchFundamentals'

describe('fetchFundamentals', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  function jsonResponse(body) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
  }

  it('fetches all 7 pieces and shapes the result', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/stock/profile2')) return jsonResponse({ name: 'Apple Inc' })
      if (url.includes('/quote')) return jsonResponse({ c: 150 })
      if (url.includes('/stock/metric')) return jsonResponse({ metric: { peTTM: 25 } })
      if (url.includes('/stock/recommendation')) return jsonResponse([{ buy: 10 }, { buy: 5 }])
      if (url.includes('/stock/price-target')) return jsonResponse({ targetMean: 200 })
      if (url.includes('/company-news')) return jsonResponse(Array.from({ length: 12 }, (_, i) => ({ id: i })))
      if (url.includes('/stock/earnings')) return jsonResponse({ earnings: [{ actual: 1 }] })
      return jsonResponse({})
    })

    const result = await fetchFundamentals('AAPL', 'key123')

    expect(result.profile).toEqual({ name: 'Apple Inc' })
    expect(result.quote).toEqual({ c: 150 })
    expect(result.metrics).toEqual({ peTTM: 25 })
    expect(result.recs).toEqual({ buy: 10 })
    expect(result.targets).toEqual({ targetMean: 200 })
    expect(result.news).toHaveLength(8)
    expect(result.earnings).toEqual({ earnings: [{ actual: 1 }] })
  })

  it('resolves with null for a piece whose request fails, without rejecting the whole call', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/stock/profile2')) return Promise.reject(new Error('network error'))
      return jsonResponse({})
    })

    const result = await fetchFundamentals('AAPL', 'key123')
    expect(result.profile).toBeNull()
  })
})

describe('fetchPeers', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('returns the peers array', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(['MSFT', 'GOOGL']) })
    const peers = await fetchPeers('AAPL', 'key123')
    expect(peers).toEqual(['MSFT', 'GOOGL'])
  })
})
