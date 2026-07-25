import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchQuote } from './finnhub'

describe('fetchQuote', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the current price from a successful quote response', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ c: 165.2 }) })

    const price = await fetchQuote('AAPL', 'key123')

    expect(price).toBe(165.2)
    expect(global.fetch).toHaveBeenCalledWith('https://finnhub.io/api/v1/quote?symbol=AAPL&token=key123')
  })

  it('throws when the response is not ok', async () => {
    global.fetch.mockResolvedValue({ ok: false })
    await expect(fetchQuote('AAPL', 'key123')).rejects.toThrow(/AAPL/)
  })

  it('throws when the payload has no price', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await expect(fetchQuote('AAPL', 'key123')).rejects.toThrow(/AAPL/)
  })
})
