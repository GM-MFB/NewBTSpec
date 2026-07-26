import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSharedCache, saveSharedCache } from './financialsSharedCache'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

describe('getSharedCache', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the cached data for a ticker', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { data: { annual: [{ date: '2024-12-31' }], quarterly: [] } }, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    const result = await getSharedCache('AAPL')

    expect(supabase.from).toHaveBeenCalledWith('financials_cache')
    expect(eq).toHaveBeenCalledWith('ticker', 'AAPL')
    expect(result).toEqual({ annual: [{ date: '2024-12-31' }], quarterly: [] })
  })

  it('returns null when there is no cached row', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    expect(await getSharedCache('ZZZZ')).toBeNull()
  })
})

describe('saveSharedCache', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts the ticker with data/fetched_at/user_id', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ upsert })

    await saveSharedCache('AAPL', { annual: [], quarterly: [] }, 'u1')

    expect(supabase.from).toHaveBeenCalledWith('financials_cache')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'AAPL', data: { annual: [], quarterly: [] }, user_id: 'u1' }),
      { onConflict: 'ticker' }
    )
  })
})
