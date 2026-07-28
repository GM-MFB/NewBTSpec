import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWatchlistQuote } from './fetchWatchlistQuotes'

describe('fetchWatchlistQuote', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('maps Finnhub c/dp to price/changePct', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ c: 150.25, d: 2.5, dp: 1.69, h: 152, l: 148, o: 149, pc: 147.75 }),
    })

    const result = await fetchWatchlistQuote('AAPL', 'key123')

    expect(result).toEqual({ price: 150.25, changePct: 1.69 })
  })

  it('throws when the Finnhub request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    await expect(fetchWatchlistQuote('AAPL', 'key123')).rejects.toThrow()
  })
})
